/**
 * mascot-widget.js
 * ─────────────────────────────────────────────────────────────
 * Drop this single file into any webpage and your dancing
 * AI agent mascot appears in the bottom-right corner.
 *
 * Usage — paste ONE line anywhere inside your <body> tag:
 *   <script src="mascot-widget.js"></script>
 *
 * Optional config (set BEFORE the script tag):
 *   window.MASCOT_CONFIG = {
 *     corner: 'bottom-right',   // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
 *     size: 180,                // canvas width/height in px (default 180)
 *     beatMs: 220,              // ms per dance frame (default 220)
 *     particles: true,          // confetti particles (default true)
 *     bgColor: 'transparent',   // widget background (default transparent)
 *   };
 */
(function () {
  const cfg = Object.assign({
    corner: 'top-right',
    size: 180,
    beatMs: 220,
    particles: true,
    bgColor: 'transparent',
  }, window.MASCOT_CONFIG || {});

  // ── Palette ──────────────────────────────────────────────────
  const B = '#3D8DEC';
  const G = '#25D18A';
  const _ = null;

  // ── Sprite frames ────────────────────────────────────────────
  const SPRITES = [
    // 0: neutral
    [[_, _, _, B, _, _, _, _, G, _, _, _], [_, _, _, B, _, _, _, _, G, _, _, _], [B, _, _, _, G, _, _, B, _, _, _, G], [B, _, _, G, B, G, B, B, G, _, _, B], [G, _, _, B, G, B, B, G, B, _, _, G], [_, B, G, B, _, G, B, _, B, G, B, _], [_, G, B, G, _, B, B, _, G, B, G, _], [_, _, _, G, B, G, B, B, G, _, _, _], [_, _, _, B, G, B, B, G, B, _, _, _], [_, _, _, G, B, _, _, G, B, _, _, _], [_, _, _, G, _, _, _, G, _, _, _, _]],
    // 1: arms up
    [[B, _, _, _, _, _, _, _, _, _, _, G], [_, B, _, B, _, _, _, _, G, _, G, _], [_, _, _, _, G, _, _, B, _, _, _, _], [_, _, _, G, B, G, B, B, G, _, _, _], [_, _, _, B, G, B, B, G, B, _, _, _], [_, B, G, B, _, G, B, _, B, G, B, _], [_, G, B, G, _, B, B, _, G, B, G, _], [_, _, _, G, B, G, B, B, G, _, _, _], [_, _, _, B, G, B, B, G, B, _, _, _], [_, _, _, G, B, _, _, G, B, _, _, _], [_, _, _, G, _, _, _, G, _, _, _, _]],
    // 2: arms wide
    [[_, _, _, B, _, _, _, _, G, _, _, _], [_, _, _, B, _, _, _, _, G, _, _, _], [_, _, _, _, G, _, _, B, _, _, _, _], [_, _, _, G, B, G, B, B, G, _, _, _], [B, _, _, B, G, B, B, G, B, _, _, G], [B, B, G, B, _, G, B, _, B, G, B, B], [_, G, B, G, _, B, B, _, G, B, G, _], [_, _, _, G, B, G, B, B, G, _, _, _], [_, _, _, B, G, B, B, G, B, _, _, _], [_, _, _, G, B, _, _, G, B, _, _, _], [_, _, _, G, _, _, _, G, _, _, _, _]],
    // 3: arms down-out
    [[_, _, _, B, _, _, _, _, G, _, _, _], [_, _, _, B, _, _, _, _, G, _, _, _], [_, _, _, _, G, _, _, B, _, _, _, _], [_, _, _, G, B, G, B, B, G, _, _, _], [_, _, _, B, G, B, B, G, B, _, _, _], [_, B, G, B, _, G, B, _, B, G, B, _], [B, G, B, G, _, B, B, _, G, B, G, G], [_, B, _, G, B, G, B, B, G, _, G, _], [_, _, _, B, G, B, B, G, B, _, _, _], [_, _, _, G, B, _, _, G, B, _, _, _], [_, _, _, G, _, _, _, G, _, _, _, _]],
    // 4: arms up-other-diagonal
    [[_, _, G, _, _, _, _, _, _, B, _, _], [_, G, _, B, _, _, _, _, G, _, B, _], [_, _, _, _, G, _, _, B, _, _, _, _], [_, _, _, G, B, G, B, B, G, _, _, _], [_, _, _, B, G, B, B, G, B, _, _, _], [_, B, G, B, _, G, B, _, B, G, B, _], [_, G, B, G, _, B, B, _, G, B, G, _], [_, _, _, G, B, G, B, B, G, _, _, _], [_, _, _, B, G, B, B, G, B, _, _, _], [_, _, _, G, B, _, _, G, B, _, _, _], [_, _, _, G, _, _, _, G, _, _, _, _]],
  ];

  const SEQ = [0, 1, 2, 1, 0, 3, 4, 3];

  const BLOCK = cfg.size / 14;
  const COLS = 12, ROWS = 11;
  const PAD = BLOCK * 1.2;
  const CW = COLS * BLOCK + PAD * 2;
  const CH = ROWS * BLOCK + PAD * 2;

  // ── Build wrapper ─────────────────────────────────────────────
  const wrap = document.createElement('div');
  const [v, h] = cfg.corner.split('-');
  Object.assign(wrap.style, {
    position: 'fixed',
    [v]: '16px',
    [h]: '16px',
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

  // ── Particles ─────────────────────────────────────────────────
  const parts = [];
  function spawn() {
    const colors = [B, G, '#fff', '#FFE566', '#FF6BCC'];
    parts.push({
      x: CW / 2 + (Math.random() - .5) * CW * .7,
      y: CH + 4,
      vx: (Math.random() - .5) * 2.5,
      vy: -(3 + Math.random() * 3.5),
      sz: 3 + Math.random() * 4,
      col: colors[Math.floor(Math.random() * colors.length)],
      life: 1, decay: .014 + Math.random() * .01,
      rot: Math.random() * Math.PI * 2, rv: (Math.random() - .5) * .18,
      circ: Math.random() > .5,
    });
  }

  let si = 0, last = 0;

  function draw(ts) {
    const el = ts - last;
    if (el >= cfg.beatMs) {
      last = ts - (el % cfg.beatMs);
      si = (si + 1) % SEQ.length;
      if (cfg.particles && Math.random() > .35) spawn();
      if (cfg.particles && Math.random() > .65) spawn();
    }
    const phase = (ts - last) / cfg.beatMs;
    const beat = Math.sin(phase * Math.PI);

    ctx.clearRect(0, 0, CW, CH);

    // bg pulse
    ctx.save();
    ctx.globalAlpha = .04 + beat * .04;
    const bg = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * .6);
    bg.addColorStop(0, '#25D18A'); bg.addColorStop(.5, '#3D8DEC'); bg.addColorStop(1, 'transparent');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
    ctx.restore();

    // shadow
    const sx = CW / 2, sy = ROWS * BLOCK + PAD + BLOCK * .4;
    ctx.save();
    ctx.globalAlpha = .16 * (1 - beat * .25);
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, BLOCK * 2.5 * (1 + beat * .15));
    sg.addColorStop(0, '#25D18A'); sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(sx, sy, BLOCK * 2.8 * (1 + beat * .12), BLOCK * .45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // sprite
    const bob = -Math.round(beat * BLOCK * .45);
    const spr = SPRITES[SEQ[si]];
    ctx.save();
    ctx.translate(PAD, PAD + bob);
    for (let r = 0; r < spr.length; r++) {
      for (let c = 0; c < spr[r].length; c++) {
        const col = spr[r][c];
        if (!col) continue;
        ctx.shadowColor = col;
        ctx.shadowBlur = 7 + beat * 5;
        ctx.fillStyle = col;
        ctx.fillRect(c * BLOCK, r * BLOCK, BLOCK - .8, BLOCK - .8);
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += .12; p.rot += p.rv; p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 5;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.circ) { ctx.beginPath(); ctx.arc(0, 0, p.sz / 2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz); }
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
