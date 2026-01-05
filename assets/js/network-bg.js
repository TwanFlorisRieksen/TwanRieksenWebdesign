(() => {
  'use strict';

  /* =========================================================
     STRUCTURED LINE NETWORK (STRAIGHT / CONTINUOUS)
     ========================================================= */

  const DPR_CAP = 2;

  /* ===== VISUAL ===== */
  const LINE_WIDTH = 2;
  const COLOR = 'rgba(29,78,216,0.25)';

  /* ===== BEHAVIOUR ===== */
  const MAX_LINES = 16;
  const STEP_LENGTH = 2.2;        // hoe snel lijnen groeien
  const MAX_SEGMENTS = 220;       // hoe lang lijnen worden
  const BRANCH_CHANCE = 0.015;    // kans op vertakking per frame
  const ERASE_ALPHA = 0.03;       // fade snelheid (globaal)

  let canvas, ctx;
  let w = 0, h = 0, dpr = 1;
  let raf = 0;

  /* =========================================================
     Line model
     ========================================================= */

  const lines = [];

  function randomDirection() {
    return Math.floor(Math.random() * 8) * (Math.PI / 4);
  }

  function createLine(x, y, angle) {
    return {
      points: [{ x, y }],
      angle,
      segments: 0
    };
  }

  /* =========================================================
     Canvas
     ========================================================= */

  function ensureCanvas() {
    canvas = document.getElementById('network-bg');
    if (!canvas) return false;
    ctx = canvas.getContext('2d', { alpha: true });
    return true;
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* =========================================================
     Init
     ========================================================= */

  function spawnInitial() {
    if (lines.length > 0) return;

    lines.push(
      createLine(
        Math.random() * w,
        Math.random() * h,
        randomDirection()
      )
    );
  }

  /* =========================================================
     Simulation
     ========================================================= */

  function step() {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const last = line.points[line.points.length - 1];

      const nx = last.x + Math.cos(line.angle) * STEP_LENGTH;
      const ny = last.y + Math.sin(line.angle) * STEP_LENGTH;

      line.points.push({ x: nx, y: ny });
      line.segments++;

      /* Draw full straight line */
      ctx.strokeStyle = COLOR;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(line.points[0].x, line.points[0].y);
      for (let k = 1; k < line.points.length; k++) {
        ctx.lineTo(line.points[k].x, line.points[k].y);
      }
      ctx.stroke();

      /* Branch ONLY from existing line ends */
      if (
        lines.length < MAX_LINES &&
        Math.random() < BRANCH_CHANCE
      ) {
        const branchAngle =
          line.angle +
          (Math.random() < 0.5 ? -1 : 1) *
          (Math.PI / 2);

        lines.push(
          createLine(nx, ny, branchAngle)
        );
      }

      /* End of life */
      if (
        line.segments > MAX_SEGMENTS ||
        nx < -100 || nx > w + 100 ||
        ny < -100 || ny > h + 100
      ) {
        lines.splice(i, 1);
      }
    }

    spawnInitial();
  }

  /* =========================================================
     TRUE FADE (NO RESET, NO GHOSTS)
     ========================================================= */

  function fade() {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${ERASE_ALPHA})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /* =========================================================
     Loop
     ========================================================= */

  function loop() {
    fade();
    step();
    raf = requestAnimationFrame(loop);
  }

  /* =========================================================
     Start
     ========================================================= */

  function start() {
    if (!ensureCanvas()) return;
    resize();
    ctx.clearRect(0, 0, w, h);
    spawnInitial();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
