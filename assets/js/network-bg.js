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

  /* ===== READABILITY SHIELDS (NO LINES THROUGH TEXT) =====
     We "punch holes" in the canvas behind readable text so the
     network lines never pass through text.

     This keeps visuals identical (no new boxes, no opacity overlays),
     but removes lines underneath.
  */

  const EXCLUDE_PADDING = 10; // px around text bounding box

  // Candidate elements that typically represent readable content.
  // Keep this reasonably broad, but avoid super-nested spans.
  const TEXT_SELECTORS = [
    'h1','h2','h3','h4','h5','h6',
    'p','li','dt','dd','blockquote','figcaption','label',
    'a','button',
    '.eyebrow','.brand-name','.brand-tagline',
    '.footer-brand','.footer-note','.footer-copy'
  ].join(',');

  let canvas, ctx;
  let w = 0, h = 0, dpr = 1;
  let raf = 0;

  let excludeRects = [];
  let excludeRaf = 0;

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

    // Recompute shields because coordinates changed.
    scheduleExcludeRecalc();
  }

  /* =========================================================
     Exclusion zones (text shields)
     ========================================================= */

  function isElementVisible(el, cs) {
    if (!cs) cs = window.getComputedStyle(el);
    if (cs.display === 'none') return false;
    if (cs.visibility === 'hidden') return false;
    if (Number(cs.opacity) === 0) return false;
    return true;
  }

  function hasReadableText(el) {
    // Fast check: non-empty trimmed text.
    // (We deliberately keep this simple; exact heuristics here are risky.)
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length > 0;
  }

  function isTriviallySmallRect(r) {
    return r.width < 6 || r.height < 6;
  }

  function buildExcludeRects() {
    const candidates = Array.from(document.querySelectorAll(TEXT_SELECTORS));

    // Filter out deeply nested items when a parent already exists.
    // This reduces rectangle count and prevents over-clearing.
    const accepted = [];

    for (const el of candidates) {
      // Skip if it is contained by an already accepted element.
      let contained = false;
      for (let i = 0; i < accepted.length; i++) {
        if (accepted[i].contains(el)) { contained = true; break; }
      }
      if (contained) continue;

      const cs = window.getComputedStyle(el);
      if (!isElementVisible(el, cs)) continue;
      if (!hasReadableText(el)) continue;

      // Skip elements that are "screen reader only".
      if (el.classList && el.classList.contains('sr-only')) continue;

      const rect = el.getBoundingClientRect();
      if (!rect || isTriviallySmallRect(rect)) continue;

      // Keep only things in the viewport-ish range (small margin).
      if (rect.bottom < -200 || rect.top > h + 200) continue;

      accepted.push(el);
    }

    const rects = [];
    for (const el of accepted) {
      const r = el.getBoundingClientRect();
      rects.push({
        x: r.left - EXCLUDE_PADDING,
        y: r.top - EXCLUDE_PADDING,
        w: r.width + EXCLUDE_PADDING * 2,
        h: r.height + EXCLUDE_PADDING * 2
      });
    }
    return rects;
  }

  function scheduleExcludeRecalc() {
    if (excludeRaf) return;
    excludeRaf = requestAnimationFrame(() => {
      excludeRaf = 0;
      // Only compute once canvas exists; safe no-op otherwise.
      try {
        excludeRects = buildExcludeRects();
      } catch (_) {
        excludeRects = [];
      }
    });
  }

  function applyExclusions() {
    if (!excludeRects || excludeRects.length === 0) return;
    ctx.save();
    // Fully erase the drawn pixels in those zones.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';

    for (let i = 0; i < excludeRects.length; i++) {
      const r = excludeRects[i];
      // Clamp to canvas bounds (in CSS pixels).
      const x = Math.max(-50, Math.min(w + 50, r.x));
      const y = Math.max(-50, Math.min(h + 50, r.y));
      const rw = Math.max(0, Math.min(w + 100, r.w));
      const rh = Math.max(0, Math.min(h + 100, r.h));
      ctx.fillRect(x, y, rw, rh);
    }
    ctx.restore();
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
    applyExclusions();
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

    // Build shields after the page has mounted dynamic CMS content.
    scheduleExcludeRecalc();

    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);

  // Recompute shields when layout moves (scroll) or content is injected.
  window.addEventListener('scroll', scheduleExcludeRecalc, { passive: true });

  const mo = new MutationObserver(() => scheduleExcludeRecalc());
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
