"""
DocBrief — AI Document Summarizer + Q&A
Flask backend using OpenRouter (free tier) via the OpenAI-compatible SDK.

Setup:
    pip install -r requirements.txt
    # Get a free key at https://openrouter.ai/keys (no credit card needed)
    export OPENROUTER_API_KEY=sk-or-...   (or add to a .env file)
    python app.py

Then open http://localhost:5000
"""

import base64
import json
import os
import uuid
import time

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_from_directory
from openai import OpenAI, RateLimitError

load_dotenv()

app = Flask(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB

ALLOWED_MIME_TYPES: dict[str, tuple[str, str]] = {
    "application/pdf":  ("document", "application/pdf"),
    "image/jpeg":       ("image",    "image/jpeg"),
    "image/jpg":        ("image",    "image/jpeg"),
    "image/png":        ("image",    "image/png"),
    "image/gif":        ("image",    "image/gif"),
    "image/webp":       ("image",    "image/webp"),
}

EXT_TO_MIME: dict[str, str] = {
    ".pdf":  "application/pdf",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".gif":  "image/gif",
    ".webp": "image/webp",
}

# Pinned to OpenRouter's dynamic free routing — this allows the router to pick
# the best available free vision model, reducing the likelihood of hitting
# a specific model's rate limit.
MODEL = "openrouter/free"

# In-memory document store: { doc_id -> { b64, kind, media_type, filename } }
# Lives as long as the server is running.
doc_store: dict[str, dict] = {}

SUMMARY_PROMPT_PDF = (
    "Provide a well-structured, thorough summary of this PDF document.\n\n"
    "## Overview\n"
    "2–3 sentences describing what this document is about and its purpose.\n\n"
    "## Key Points\n"
    "The most important information, arguments, or findings as concise bullet points.\n\n"
    "## Notable Details\n"
    "Specific data, figures, dates, names, or details worth highlighting.\n\n"
    "## Conclusions\n"
    "The main takeaways, conclusions, or action items from the document."
)

SUMMARY_PROMPT_IMAGE = (
    "Provide a detailed, structured analysis of this image.\n\n"
    "## Overview\n"
    "2–3 sentences describing what this image shows and its context.\n\n"
    "## Key Elements\n"
    "The main subjects, objects, people, or visual elements present.\n\n"
    "## Notable Details\n"
    "Specific details, any visible text, data visualisations, colours, or patterns.\n\n"
    "## Insights\n"
    "Any relevant context, purpose, or insights that can be drawn from this image."
)

SYSTEM_PROMPT = (
    "You are a helpful assistant that has been given a document or image to analyse. "
    "Answer the user's questions accurately and concisely, basing your answers only on the "
    "provided content. If the answer isn't in the document, say so clearly.\n"
    "IMPORTANT: Do not include any safety ratings, moderation labels, content warnings, "
    "or metadata prefixes (such as 'User Safety:', 'Content:', 'Safe:') in your response. "
    "Begin your reply directly with the answer."
)

# ── Helpers ───────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _make_client() -> OpenAI | None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)


def _call_openai_with_retry(call_func, max_retries=3):
    """Call an OpenAI API function with exponential backoff on rate limits."""
    for attempt in range(max_retries):
        try:
            return call_func()
        except RateLimitError:
            if attempt == max_retries - 1:
                raise
            # Exponential backoff: 2s, 4s, 8s...
            delay = 2 ** (attempt + 1)
            time.sleep(delay)
        except Exception:
            # Fail immediately for all other errors (Auth, etc.)
            raise


def _file_content_part(doc: dict) -> list:
    """Return the content block(s) that attach the stored file to a message."""
    if doc["kind"] == "document":
        return [{
            "type": "file",
            "file": {
                "filename": doc["filename"],
                "file_data": f"data:application/pdf;base64,{doc['b64']}",
            },
        }]
    else:
        return [{
            "type": "image_url",
            "image_url": {"url": f"data:{doc['media_type']};base64,{doc['b64']}"},
        }]


def _extra_body(doc: dict) -> dict:
    if doc["kind"] == "document":
        return {"plugins": [{"id": "file-parser", "pdf": {"engine": "cloudflare-ai"}}]}
    return {}


# Prefixes some models emit that we want to silently strip
_FILTER_PREFIXES = (
    "user safety:", "content safety:", "safety:", "safe:", "unsafe:",
    "content:", "moderation:", "rating:",
)

def _stream_response(stream_iter, extra_done: dict | None = None):
    """Yield SSE chunks from an OpenAI stream, filtering safety metadata."""
    leftover  = ""   # buffer for partial lines at chunk boundaries
    preamble  = True # still in the potential metadata header region

    for chunk in stream_iter:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if not delta:
            continue

        if preamble:
            # Accumulate until we have complete lines to inspect
            leftover += delta
            while "\n" in leftover:
                line, leftover = leftover.split("\n", 1)
                if line.lower().lstrip().startswith(_FILTER_PREFIXES):
                    continue          # drop the metadata line
                # Real content — emit any accumulated leftover as one chunk
                preamble = False
                emit = line + "\n" + leftover
                leftover = ""
                if emit.strip():
                    yield _sse({"type": "chunk", "text": emit})
                break
        else:
            yield _sse({"type": "chunk", "text": delta})

    # Flush any remaining buffered content
    if leftover.strip():
        yield _sse({"type": "chunk", "text": leftover})

    yield _sse({"type": "done", **(extra_done or {})})


def _handle_exc(exc: Exception):
    msg = str(exc)
    if "401" in msg or "auth" in msg.lower():
        return "Authentication failed — check your OPENROUTER_API_KEY."
    if "429" in msg:
        return "Rate limit hit. Wait a moment and try again."
    return f"Error: {msg}"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def serve_index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def serve_static(filename: str):
    # Serve sibling files of index.html (mascot.js, mascot-typing.js,
    # mascot-reading.js, etc.) so the widget animations actually load.
    return send_from_directory(BASE_DIR, filename)


@app.route("/summarize", methods=["POST"])
def summarize():
    # ── Validate upload ──────────────────────────────────────────────────────
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename."}), 400

    file_bytes = file.read()
    if len(file_bytes) > MAX_FILE_BYTES:
        return jsonify({"error": "File exceeds the 20 MB limit."}), 400

    mime = (file.content_type or "").split(";")[0].strip()
    if mime not in ALLOWED_MIME_TYPES:
        ext = os.path.splitext(file.filename)[1].lower()
        mime = EXT_TO_MIME.get(ext, "")

    if mime not in ALLOWED_MIME_TYPES:
        return jsonify({
            "error": "Unsupported file type. Please upload a PDF or image (JPEG, PNG, GIF, WEBP)."
        }), 400

    kind, media_type = ALLOWED_MIME_TYPES[mime]
    b64 = base64.standard_b64encode(file_bytes).decode()

    # Store the document for later Q&A
    doc_id = str(uuid.uuid4())
    doc_store[doc_id] = {
        "b64": b64,
        "kind": kind,
        "media_type": media_type,
        "filename": file.filename or "document",
    }

    doc = doc_store[doc_id]
    prompt = SUMMARY_PROMPT_PDF if kind == "document" else SUMMARY_PROMPT_IMAGE
    content = _file_content_part(doc) + [{"type": "text", "text": prompt}]

    def generate():
        client = _make_client()
        if not client:
            yield _sse({"type": "error", "content": "OPENROUTER_API_KEY is not set."})
            return
        try:
            stream = _call_openai_with_retry(lambda: client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": content}],
                stream=True,
                extra_body=_extra_body(doc) or None,
            ))
            yield from _stream_response(stream, extra_done={"doc_id": doc_id})
        except Exception as exc:  # noqa: BLE001
            yield _sse({"type": "error", "content": _handle_exc(exc)})

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    doc_id   = data.get("doc_id", "")
    messages = data.get("messages", [])   # [{role, content}] — plain text

    if not doc_id or doc_id not in doc_store:
        return jsonify({"error": "Document not found. Please re-summarise the file."}), 404
    if not messages:
        return jsonify({"error": "No messages provided."}), 400

    doc = doc_store[doc_id]

    # Build conversation for the API.
    # The file is injected into the very first user message only — every
    # subsequent turn is plain text so we don't blow the context window.
    api_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    first_user_seen = False

    for msg in messages:
        role    = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "user" and not first_user_seen:
            first_user_seen = True
            api_messages.append({
                "role": "user",
                "content": _file_content_part(doc) + [{"type": "text", "text": content}],
            })
        else:
            api_messages.append({"role": role, "content": content})

    def generate():
        client = _make_client()
        if not client:
            yield _sse({"type": "error", "content": "OPENROUTER_API_KEY is not set."})
            return
        try:
            stream = _call_openai_with_retry(lambda: client.chat.completions.create(
                model=MODEL,
                messages=api_messages,
                stream=True,
                extra_body=_extra_body(doc) or None,
            ))
            yield from _stream_response(stream)
        except Exception as exc:  # noqa: BLE001
            yield _sse({"type": "error", "content": _handle_exc(exc)})

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    print(f"\n  ✦ DocBrief running at http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)