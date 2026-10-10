/**
 * agent-wave-widget.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Your blue-and-green AI agent: reads a paper, then looks up and waves at you.
 *
 * Usage — one line before </body>:
 *   <script src="agent-wave-widget.js"></script>
 *
 * Optional config (set BEFORE the script tag):
 *   window.AGENT_CONFIG = {
 *     corner:  'bottom-right',  // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
 *     scale:   1,               // size multiplier (default 1)
 *     frameMs: 220,             // ms per animation frame
 *     bgColor: 'transparent',   // widget background
 *   };
 */
(function () {
  'use strict';

  const cfg = Object.assign({
    corner: 'bottom-left',
    scale: 1,
    frameMs: 220,
    bgColor: 'transparent',
  }, window.AGENT_CONFIG || {});

  // ── Palette ────────────────────────────────────────────────────────────────
  const B = '#3D8DEC';
  const G = '#25D18A';
  const _ = null;

  // ── Layout ─────────────────────────────────────────────────────────────────
  const BLOCK = Math.round(16 * cfg.scale);
  const COLS = 12, ROWS = 11;
  const PAD = BLOCK;
  const CW = COLS * BLOCK + PAD * 6;

  const SY = PAD + 5.5 * BLOCK;
  const LS_X = PAD + 3 + 1.5 * BLOCK;
  const RS_X = LS_X + COLS * BLOCK;

  const ARM_PX = 5 * BLOCK;
  const LA_RAD = 80 * Math.PI / 180;

  const LHX = LS_X + ARM_PX * Math.cos(LA_RAD);
  const LHY = SY + ARM_PX * Math.sin(LA_RAD);
  const RHX = RS_X + ARM_PX * Math.cos(Math.PI - LA_RAD);

  const PCX = (LHX + RHX) / 2;
  const PCY = LHY;
  const PW = 7 * BLOCK;
  const PH = 8 * BLOCK;
  const CH = Math.ceil(PCY + PH / 2 + PAD * 2.5);

  // ── Body sprites ───────────────────────────────────────────────────────────
  const BODY_READ = [
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

  const BODY_PERKED = [
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

  const BODY_WAVE = [
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

  const BODIES = [BODY_READ, BODY_PERKED, BODY_WAVE];

  // ── Animation frames ───────────────────────────────────────────────────────
  const FRAMES = [
    { bi: 0, tilt: 0, bob: 0, pt: 0, wave: false, wa: 80, ps: 0 },
    { bi: 0, tilt: -1, bob: 0, pt: 1, wave: false, wa: 80, ps: 0 },
    { bi: 0, tilt: 0, bob: -1, pt: 0, wave: false, wa: 80, ps: 0 },
    { bi: 0, tilt: 1, bob: 0, pt: -1, wave: false, wa: 80, ps: 0 },
    { bi: 1, tilt: -2, bob: -1, pt: 5, wave: false, wa: 80, ps: 0 },
    { bi: 2, tilt: -2, bob: -1, pt: 8, wave: true, wa: 20, ps: BLOCK * 0.5 },
    { bi: 2, tilt: -2, bob: -1, pt: 10, wave: true, wa: -50, ps: BLOCK },
    { bi: 2, tilt: -2, bob: -1, pt: 10, wave: true, wa: -70, ps: BLOCK },
    { bi: 2, tilt: -1, bob: 0, pt: 10, wave: true, wa: -45, ps: BLOCK },
    { bi: 2, tilt: -2, bob: -1, pt: 10, wave: true, wa: -70, ps: BLOCK },
    { bi: 2, tilt: -1, bob: 0, pt: 10, wave: true, wa: -45, ps: BLOCK },
    { bi: 1, tilt: -1, bob: 0, pt: 5, wave: true, wa: 30, ps: BLOCK * 0.5 },
    { bi: 0, tilt: 0, bob: 0, pt: 0, wave: false, wa: 80, ps: 0 },
  ];

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
    const ARM_T = BLOCK * 0.75; // thinner arm thickness
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

  function drawPaper(cx, cy, tiltDeg) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tiltDeg * Math.PI / 180);

    ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
    ctx.fillRect(-PW / 2 + 4, -PH / 2 + 4, PW, PH); ctx.restore();

    ctx.fillStyle = '#F5EDD8';
    ctx.fillRect(-PW / 2, -PH / 2, PW - 1, PH - 1);

    ctx.fillStyle = '#E2D8C0';
    ctx.fillRect(-PW / 2 + BLOCK, -PH / 2 + BLOCK, PW * 0.55, BLOCK - 1);

    ctx.fillStyle = '#D8D0B8';
    ctx.fillRect(-PW / 2 + BLOCK, -PH / 2 + 2.4 * BLOCK, PW * 0.35, Math.ceil(BLOCK * 0.4));

    ctx.fillStyle = '#C4B89A';
    const lh = Math.ceil(BLOCK * 0.35);
    for (let i = 0; i < 5; i++) {
      const w = i === 4 ? PW * 0.4 : PW - 2 * BLOCK - (i % 2) * BLOCK * 0.5;
      ctx.fillRect(-PW / 2 + BLOCK, -PH / 2 + (3.8 + i * 1.1) * BLOCK, w - 1, lh);
    }

    ctx.fillStyle = '#D4C8AA';
    ctx.beginPath();
    ctx.moveTo(PW / 2 - 1 - BLOCK, -PH / 2);
    ctx.lineTo(PW / 2 - 1, -PH / 2);
    ctx.lineTo(PW / 2 - 1, -PH / 2 + BLOCK);
    ctx.closePath(); ctx.fill();

    ctx.restore();
  }

  // ── Animation loop ─────────────────────────────────────────────────────────
  let fi = 0, last = 0, sparkPhase = 0;

  function loop(ts) {
    const el = ts - last;
    if (el >= cfg.frameMs) {
      last = ts - (el % cfg.frameMs);
      fi = (fi + 1) % FRAMES.length;
    }
    const f = FRAMES[fi];
    sparkPhase += 0.25;

    ctx.clearRect(0, 0, CW, CH);

    ctx.save();
    ctx.globalAlpha = 0.055;
    const bg = ctx.createRadialGradient(CW / 2, CH / 3, 0, CW / 2, CH / 3, CW * 0.7);
    bg.addColorStop(0, G); bg.addColorStop(0.5, B); bg.addColorStop(1, 'transparent');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
    ctx.restore();

    const floorY = PAD + ROWS * BLOCK + BLOCK * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.14;
    const sg = ctx.createRadialGradient(CW / 2, floorY, 0, CW / 2, floorY, BLOCK * 3);
    sg.addColorStop(0, G); sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(CW / 2, floorY, BLOCK * 3.2, BLOCK * 0.45, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();

    const tiltRad = f.tilt * Math.PI / 180;
    const bodyCX = CW / 2;
    const bodyCY = PAD + ROWS / 2 * BLOCK + f.bob * BLOCK;

    ctx.save();
    ctx.translate(bodyCX, bodyCY);
    ctx.rotate(tiltRad);

    const ls_rel = LS_X - bodyCX;
    const rs_rel = RS_X - bodyCX;
    const sy_rel = SY - (PAD + ROWS / 2 * BLOCK);

    const ARM_INSET = BLOCK * 0.5;       // pulls the arms in toward the torso
    const la_rel = ls_rel + ARM_INSET;
    const ra_rel = rs_rel - ARM_INSET;

    drawArm(ra_rel, sy_rel, 80);  // right arm always holds paper

    if (f.wave) {
      const lwa = 180 - f.wa;
      drawArm(la_rel, sy_rel, lwa);
      if (fi >= 7 && fi <= 10) {
        const wr = lwa * Math.PI / 180;
        drawSparkle(la_rel + ARM_PX * Math.cos(wr), sy_rel + ARM_PX * Math.sin(wr), sparkPhase);
      }
    } else {
      drawArm(la_rel, sy_rel, 100);
    }

    drawGrid(BODIES[f.bi], -COLS / 2 * BLOCK, -ROWS / 2 * BLOCK);
    drawPaper((PCX - bodyCX) + f.ps, PCY - (PAD + ROWS / 2 * BLOCK) - f.bob * BLOCK, f.pt);

    ctx.restore();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
