# DocBrief — AI Document Summarizer

Upload a PDF or image and get a structured AI summary, streamed in real time.

## Tech stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Python 3.9+ · Flask · google-genai  |
| Frontend | Vanilla HTML / CSS / JS             |
| AI model | Gemini 2.0 Flash                    |

---

## Quick start

### 1 · Prerequisites

- Python 3.9 or newer
- A Gemini API key → https://aistudio.google.com/apikey

### 2 · Install dependencies

```bash
pip install -r requirements.txt
```

### 3 · Set your API key

**Option A — environment variable:**
```bash
export GEMINI_API_KEY=AIza...
```

**Option B — `.env` file:**
```
# .env
GEMINI_API_KEY=AIza...
```

### 4 · Run the server

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

---

## Usage

1. Drag & drop a file onto the upload zone — or click to browse.
2. Supported formats: **PDF**, **JPEG**, **PNG**, **GIF**, **WEBP** (max 20 MB).
3. Click **Summarize with AI →**.
4. The summary streams in live, then renders as formatted markdown.
5. Use **Copy** or **Download** to export the result.

---

## Customisation

| What             | Where                                    |
|------------------|------------------------------------------|
| AI model         | `app.py` → `model=` in `generate_content_stream` |
| Summary prompt   | `app.py` → `SUMMARY_PROMPT_PDF / IMAGE` constants |
| Max file size    | `app.py` → `MAX_FILE_BYTES`             |
| Port             | `PORT` env variable (default `5000`)    |
| Colours          | `index.html` → `:root { … }` CSS vars  |

---

## Project structure

```
docbrief/
├── app.py           # Flask backend (upload handling + SSE streaming)
├── index.html       # Frontend (served by Flask at /)
├── requirements.txt # Python dependencies
└── README.md        # This file
```

---

## How it works

1. The browser POSTs the file as `multipart/form-data` to `/summarize`.
2. Flask resolves the MIME type, reads the raw bytes, and passes them directly to the Gemini API as a `types.Part.from_bytes()` object alongside the summary prompt — no base64 encoding required.
3. Gemini streams its response; Flask wraps each chunk as a Server-Sent Event (`text/event-stream`).
4. The browser reads the SSE stream, appending text in real time, then re-renders the full response as markdown when streaming completes.
# DocBrief
