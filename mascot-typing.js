/**
 * agent-story-widget.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Your blue-and-green AI agent acts out a little story, on a loop:
 * types on a laptop while facing you → turns excited → waves → closes the laptop →
 * jumps → falls → vanishes → (pause) → reappears and starts again.
 *
 * Usage — one line before </body>:
 * <script src="agent-story-widget.js"></script>
 *
 * Optional config (set BEFORE the script tag):
 * window.AGENT_STORY_CONFIG = {
 * corner:  'bottom-right',  // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
 * scale:   1,               // size multiplier (default 1)
 * frameMs: 150,             // ms per animation frame
 * bgColor: 'transparent',   // widget background
 * };
 *
 * Note: uses its own config key (AGENT_STORY_CONFIG) so it can coexist with
 * agent-wave-widget.js (AGENT_CONFIG) and agent-type-widget.js (AGENT_TYPE_CONFIG).
 */
(function () {
  'use strict';

  const cfg = Object.assign({
    corner: 'bottom-right',
    scale: 1,
    frameMs: 150,
    bgColor: 'transparent',
  }, window.AGENT_STORY_CONFIG || {});

  // ── Palette ────────────────────────────────────────────────────────────────
  const B = '#3D8DEC';
  const G = '#25D18A';
  const _ = null;

  // ── Layout ─────────────────────────────────────────────────────────────────
  const BLOCK = Math.round(16 * cfg.scale);
  const COLS = 12, ROWS = 11;
  const PAD = BLOCK;
  const CW = COLS * BLOCK + PAD * 6;

  // Extra headroom above the body so the jump has somewhere to go
  const Y_OFFSET = 10 * BLOCK;
  const BASE_Y = Y_OFFSET + PAD + ROWS / 2 * BLOCK;

  const SY = Y_OFFSET + PAD + 5.5 * BLOCK;
  const LS_X = PAD + 3 + 1.5 * BLOCK;
  const RS_X = LS_X + COLS * BLOCK;

  const ARM_PX = 4.25 * BLOCK;
  const ANGLE_L = 100, ANGLE_R = 80; // degrees; 0° = pointing right, clockwise positive

  const radL = ANGLE_L * Math.PI / 180;
  const radR = ANGLE_R * Math.PI / 180;
  const LHX = LS_X + ARM_PX * Math.cos(radL);
  const LHY = SY + ARM_PX * Math.sin(radL);
  const RHX = RS_X + ARM_PX * Math.cos(radR);

  const KCX = (LHX + RHX) / 2;
  const KCY = LHY;

  const KW = 8 * BLOCK, KH = 2.2 * BLOCK;     // keyboard tray
  const SW = KW * 0.92, SH = 3.5 * BLOCK;     // screen panel
  const CH = Math.ceil(KCY + KH / 2 + PAD * 1.5);

  const KEY_COLS = 8, KEY_ROWS = 2, KEY_GAP = 2;
  const KEY_W = (KW - (KEY_COLS + 1) * KEY_GAP) / KEY_COLS;
  const KEY_H = (KH - (KEY_ROWS + 1) * KEY_GAP) / KEY_ROWS;

  const MAX_LINES = 5;
  const LINE_GROW = 0.16;
  const ARM_INSET = BLOCK * 0.5;
  const PRESS_EXT = BLOCK * 0.3;

  // ── Body sprites (same character throughout) ──────────────────────────────
  const BODY_FOCUS = [
    [_, _, _, B, _, _, _, _, G, _, _, _],
    [_, _, _, B, _, _, _, _, G, _, _, _],
    [_, _, _, _, G, _, _, B, _, _, _, _],
    [_, _, _, G, B, G, B, B, G, _, _, _],
    [_, _, _, B, G, B, B, G, B, _, _, _],
    [_, _, G, B, _, G, B, _, B, G, _, _],
    [_, _, B, G, _, B, B, _, G, B, _, _],
    [_, _, _, G, B, G, B, B, G, _, _, _],
    [_, _, _, B, G, B, B, G, B, _, _, _],
    [_, _, _, G, B, _, _, G, B, _, _, _],
    [_, _, _, G, _, _, _, G, _, _, _, _],
  ];

  const BODY_LOOKUP = [
    [_, _, B, _, _, _, _, _, _, G, _, _],
    [_, _, _, B, _, _, _, _, G, _, _, _],
    [_, _, _, _, G, _, _, B, _, _, _, _],
    [_, _, _, G, B, G, B, B, G, _, _, _],
    [_, _, _, B, G, B, B, G, B, _, _, _],
    [_, _, G, B, _, G, B, _, B, G, _, _],
    [_, _, B, G, _, B, B, _, G, B, _, _],
    [_, _, _, G, B, G, B, B, G, _, _, _],
    [_, _, _, B, G, B, B, G, B, _, _, _],
    [_, _, _, G, B, _, _, G, B, _, _, _],
    [_, _, _, G, _, _, _, G, _, _, _, _],
  ];

  const BODY_EXCITED = [
    [_, B, _, _, _, _, _, _, _, _, G, _],
    [_, _, B, _, _, _, _, _, _, G, _, _],
    [_, _, _, _, G, _, _, B, _, _, _, _],
    [_, _, _, G, B, G, B, B, G, _, _, _],
    [_, _, _, B, G, B, B, G, B, _, _, _],
    [_, _, G, B, _, G, B, _, B, G, _, _],
    [_, _, B, G, _, B, B, _, G, B, _, _],
    [_, _, _, G, B, G, B, B, G, _, _, _],
    [_, _, _, B, G, B, B, G, B, _, _, _],
    [_, _, _, G, B, _, _, G, B, _, _, _],
    [_, _, _, G, _, _, _, G, _, _, _, _],
  ];

  const BODIES = [BODY_FOCUS, BODY_LOOKUP, BODY_EXCITED];

  // ── Typing sub-cycle (reused while phase === 'type') ──────────────────────
  const TYPE_FRAMES = [
    { bi: 1, tilt: 0, bob: 0, press: 'L' },
    { bi: 1, tilt: 1, bob: -1, press: null },
    { bi: 1, tilt: 0, bob: 0, press: 'R' },
    { bi: 1, tilt: -1, bob: -1, press: null },
    { bi: 1, tilt: 0, bob: 0, press: 'L' },
    { bi: 1, tilt: 1, bob: -1, press: null },
    { bi: 1, tilt: 0, bob: 0, press: 'R' },
    { bi: 1, tilt: -1, bob: -1, press: null },
    { bi: 0, tilt: -2, bob: -1, press: null },  // brief glance down at keyboard
    { bi: 0, tilt: -1, bob: 0, press: null },
    { bi: 1, tilt: 0, bob: 0, press: 'L' },
    { bi: 1, tilt: 1, bob: -1, press: null },
    { bi: 1, tilt: 0, bob: 0, press: 'R' },
    { bi: 1, tilt: -1, bob: -1, press: null },
    { bi: 1, tilt: 0, bob: 0, press: 'L' },
    { bi: 1, tilt: 1, bob: -1, press: null },
    { bi: 1, tilt: 0, bob: 0, press: 'R' },
    { bi: 1, tilt: -1, bob: -1, press: null },
  ];

  const WAVE_SEQ = [20, -50, -70, -45, -70, -45, -70, -45, -70, -45, 30, 50, 80, 80, 80, 80];

  // ── Story phases ────────────────────────────────────────────────────────────
  const PHASES = [
    { name: 'type', frames: 36 },
    { name: 'turn', frames: 8 },
    { name: 'wave', frames: 16 },
    { name: 'close', frames: 10 },
    { name: 'jump', frames: 8 },
    { name: 'fall', frames: 6 },
    { name: 'vanish', frames: 8 },
    { name: 'gone', frames: 10 },
  ];
  const TOTAL_FRAMES = PHASES.reduce((s, p) => s + p.frames, 0);

  function getPhase(t) {
    let acc = 0;
    for (const p of PHASES) {
      if (t < acc + p.frames) return { name: p.name, i: t - acc, n: p.frames };
      acc += p.frames;
    }
    return PHASES[0] ? { name: PHASES[0].name, i: 0, n: PHASES[0].frames } : null;
  }

  // ── DOM setup ──────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  const [v, h] = cfg.corner.split('-');
  Object.assign(wrap.style, {
    position: 'fixed',
    [v]: '0px',
    [h]: '0px',
    zIndex: '9999',
    pointerEvents: 'none',
    background: cfg.bgColor,
    lineHeight: '0',
  });

  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  Object.assign(canvas.style, {
    width: CW + 'px',
    height: CH + 'px',
    imageRendering: 'pixelated',
  });

  wrap.appendChild(canvas);
  document.body.appendChild(wrap);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ── Draw helpers ───────────────────────────────────────────────────────────
  function drawGrid(grid, ox, oy) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const col = grid[r][c];
        if (!col) continue;
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
        ctx.fillStyle = col;
        ctx.fillRect(ox + c * BLOCK, oy + r * BLOCK, BLOCK - 1, BLOCK - 1);
      }
    }
    ctx.shadowBlur = 0;
  }

  function drawArm(px, py, angleDeg) {
    const ARM = [[G, B, G, B, G], [B, G, B, G, B]];
    const ARM_T = BLOCK * 0.75;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angleDeg * Math.PI / 180);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.shadowColor = ARM[r][c];
        ctx.shadowBlur = 7;
        ctx.fillStyle = ARM[r][c];
        ctx.fillRect(c * BLOCK, (r - 1) * ARM_T, BLOCK - 1, ARM_T - 1);
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function shiftPivot(px, py, angleDeg, amount) {
    const r = angleDeg * Math.PI / 180;
    return [px + amount * Math.cos(r), py + amount * Math.sin(r)];
  }

  function drawSparkle(x, y, phase) {
    const r = BLOCK * (0.8 + 0.4 * Math.sin(phase));
    [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]].forEach(([dx, dy]) => {
      const col = Math.random() > 0.5 ? G : B;
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 6;
      ctx.fillRect(x + dx * r - 3, y + dy * r - 3, 5, 5);
    });
    ctx.shadowBlur = 0;
  }

  function drawKeyboard(pressSide, activeCol, activeRow) {
    ctx.fillStyle = '#262B33';
    ctx.fillRect(-KW / 2, -KH / 2, KW, KH - 1);

    for (let r = 0; r < KEY_ROWS; r++) {
      for (let c = 0; c < KEY_COLS; c++) {
        const kx = -KW / 2 + KEY_GAP + c * (KEY_W + KEY_GAP);
        const ky = -KH / 2 + KEY_GAP + r * (KEY_H + KEY_GAP);
        const active = pressSide && c === activeCol && r === activeRow;
        if (active) {
          const col = (c + r) % 2 ? G : B;
          ctx.shadowColor = col;
          ctx.shadowBlur = 6;
          ctx.fillStyle = col;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#3A4150';
        }
        ctx.fillRect(kx, ky, KEY_W, KEY_H);
      }
    }
    ctx.shadowBlur = 0;
  }

  function drawScreen(lines, cursorOn, lidAngle) {
    ctx.save();
    ctx.translate(0, -KH / 2);              // hinge point
    ctx.rotate(lidAngle * Math.PI / 180);

    const bezel = 3;
    if (lidAngle < 90) {
      ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
      ctx.fillRect(-KW / 2 + 3, -SH, KW, SH); ctx.restore();

      ctx.fillStyle = '#161B22';
      ctx.fillRect(-KW / 2, -SH - 3, KW, SH + 3);
      ctx.fillStyle = '#0B0F14';
      ctx.fillRect(-SW / 2, -SH, SW, SH - bezel);

      const margin = BLOCK * 0.4;
      const lineH = (SH - bezel - 2 * margin) / MAX_LINES;
      const innerW = SW - 2 * margin;

      for (let i = 0; i < lines.length; i++) {
        const w = Math.max(2, lines[i] * innerW);
        const ly = -SH + margin + i * lineH;
        const col = i % 2 ? G : B;
        ctx.shadowColor = col; ctx.shadowBlur = 3; ctx.fillStyle = col;
        ctx.fillRect(-SW / 2 + margin, ly, w, Math.max(2, lineH * 0.45));
      }
      ctx.shadowBlur = 0;

      if (cursorOn) {
        const last = lines.length - 1;
        const w = Math.max(2, lines[last] * innerW);
        const lx = -SW / 2 + margin + w + 2;
        const ly = -SH + margin + last * lineH;
        ctx.shadowColor = G; ctx.shadowBlur = 5; ctx.fillStyle = G;
        ctx.fillRect(lx, ly, 3, Math.max(2, lineH * 0.45));
        ctx.shadowBlur = 0;
      }
    } else {
      // Closed: back of the lid, with a small sleep-indicator glow.
      ctx.fillStyle = '#1B2330';
      ctx.fillRect(-KW / 2, -SH, KW, SH);
      const col = cursorOn ? G : B;
      ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.fillStyle = col;
      ctx.fillRect(-4, -SH / 2 - 2, 8, 4);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // ── Per-frame pose computation ─────────────────────────────────────────────
  function computeState(phase, i, n) {
    const t = n > 1 ? i / (n - 1) : 0;
    const s = {
      bi: 0, tilt: 0, bob: 0, scaleX: 1, scaleY: 1, alpha: 1,
      lidAngle: 0, La: ANGLE_L, Ra: ANGLE_R, lExt: 0, rExt: 0,
      press: null, drawLaptop: true, drawBody: true,
    };

    if (phase === 'type') {
      const f = TYPE_FRAMES[i % TYPE_FRAMES.length];
      s.bi = f.bi; s.tilt = f.tilt; s.bob = f.bob; s.press = f.press;
      if (f.press === 'L') s.lExt = PRESS_EXT;
      if (f.press === 'R') s.rExt = PRESS_EXT;
    } else if (phase === 'turn') {
      s.bi = t < 0.5 ? 1 : 2;
      s.scaleX = 1 - 0.3 * Math.sin(Math.PI * t);
    } else if (phase === 'wave') {
      const wa = WAVE_SEQ[i % WAVE_SEQ.length];
      s.bi = 2; // excited / waving sprite
      s.tilt = (i % 2 === 0) ? -2 : -1;
      s.bob = -1;
      s.La = 180 - wa;
      s.Ra = ANGLE_R;
      s._wa = wa;
    } else if (phase === 'close') {
      s.lidAngle = t * 180;
      s.bi = 0;
      s.tilt = 2 * (1 - t);
      const push = Math.sin(Math.PI * t) * PRESS_EXT;
      s.lExt = push; s.rExt = push;
    } else if (phase === 'jump') {
      s.lidAngle = 180;
      s.bi = 2;
      s.La = -70; s.Ra = 180 - s.La;
      if (i < 2) {
        s.bob = 1; s.scaleX = 1.15; s.scaleY = 0.85;
      } else {
        const tt = (i - 1) / (n - 2);
        s.bob = -9 * Math.sin(Math.PI * tt / 2);
        s.scaleX = 0.92; s.scaleY = 1.12;
      }
    } else if (phase === 'fall') {
      s.lidAngle = 180;
      s.bi = 2;
      s.La = -70; s.Ra = 180 - s.La;
      s.bob = -9 * (1 - t);
      s.scaleX = 0.92 + 0.08 * t;
      s.scaleY = 1.12 - 0.12 * t;
      if (i === n - 1) { s.scaleX = 1.2; s.scaleY = 0.8; }
    } else if (phase === 'vanish') {
      s.lidAngle = 180;
      s.bi = 0;
      s.alpha = 1 - t;
      s.scaleX = 1 - 0.3 * t;
      s.scaleY = 1 - 0.3 * t;
    } else if (phase === 'gone') {
      s.drawLaptop = false;
      s.drawBody = false;
    }

    return s;
  }

  // ── Animation loop ─────────────────────────────────────────────────────────
  let tick = 0, last = 0;
  let lines = [0.5, 0.8, 0.3, 0.65, 0];
  let activeCol = 0, activeRow = 0;
  let sparkPhase = 0;

  function loop(ts) {
    const el = ts - last;
    let advanced = false;
    if (el >= cfg.frameMs) {
      last = ts - (el % cfg.frameMs);
      tick = (tick + 1) % TOTAL_FRAMES;
      advanced = true;
    }
    sparkPhase += 0.25;

    const { name: phase, i, n } = getPhase(tick);
    const s = computeState(phase, i, n);

    if (advanced && phase === 'type') {
      const f = TYPE_FRAMES[i % TYPE_FRAMES.length];
      if (f.press) {
        lines[lines.length - 1] += LINE_GROW;
        if (lines[lines.length - 1] >= 1) {
          lines[lines.length - 1] = 1;
          lines.push(0);
          if (lines.length > MAX_LINES) lines.shift();
        }
        const half = f.press === 'L' ? 0 : KEY_COLS / 2;
        activeCol = half + Math.floor(Math.random() * (KEY_COLS / 2));
        activeRow = Math.floor(Math.random() * KEY_ROWS);
      }
    }
    const cursorOn = tick % 8 < 4;

    ctx.clearRect(0, 0, CW, CH);

    ctx.save();
    ctx.globalAlpha = 0.055;
    const bg = ctx.createRadialGradient(CW / 2, CH / 2.4, 0, CW / 2, CH / 2.4, CW * 0.7);
    bg.addColorStop(0, G); bg.addColorStop(0.5, B); bg.addColorStop(1, 'transparent');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
    ctx.restore();

    const floorY = Y_OFFSET + PAD + ROWS * BLOCK + BLOCK * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.14;
    const sg = ctx.createRadialGradient(CW / 2, floorY, 0, CW / 2, floorY, BLOCK * 3);
    sg.addColorStop(0, G); sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(CW / 2, floorY, BLOCK * 3.2, BLOCK * 0.45, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();

    const tiltRad = s.tilt * Math.PI / 180;
    const bodyCX = CW / 2;
    const bodyCY = BASE_Y + s.bob * BLOCK;

    ctx.save();
    ctx.translate(bodyCX, bodyCY);
    ctx.rotate(tiltRad);

    const ls_rel = LS_X - bodyCX;
    const rs_rel = RS_X - bodyCX;
    const sy_rel = SY - BASE_Y;
    const la_rel = ls_rel + ARM_INSET;
    const ra_rel = rs_rel - ARM_INSET;

    const kcx_rel = KCX - bodyCX;
    const kcy_rel = KCY - BASE_Y - s.bob * BLOCK;

    if (s.drawBody) {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.scale(s.scaleX, s.scaleY);

      const [lpx, lpy] = shiftPivot(la_rel, sy_rel, s.La, s.lExt);
      const [rpx, rpy] = shiftPivot(ra_rel, sy_rel, s.Ra, s.rExt);
      drawArm(rpx, rpy, s.Ra);
      drawArm(lpx, lpy, s.La);

      if (phase === 'wave' && s._wa < -40) {
        const wr = s.La * Math.PI / 180;
        drawSparkle(la_rel + ARM_PX * Math.cos(wr), sy_rel + ARM_PX * Math.sin(wr), sparkPhase);
      }

      drawGrid(BODIES[s.bi], -COLS / 2 * BLOCK, -ROWS / 2 * BLOCK);
      ctx.restore();
    }

    if (s.drawLaptop) {
      ctx.save();
      ctx.translate(kcx_rel, kcy_rel);
      drawScreen(lines, cursorOn, s.lidAngle);
      if (s.lidAngle < 90) drawKeyboard(s.press, activeCol, activeRow);
      ctx.restore();
    }

    ctx.restore();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();