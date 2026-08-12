/* =============================================================
   petals.js · lightweight canvas of drifting flower petals
   Respects prefers-reduced-motion, pauses when tab is hidden,
   and scales density to screen size for performance.
   ============================================================= */
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("petals");
  if (!canvas || reduce) return;

  const ctx = canvas.getContext("2d");
  let w, h, petals, raf;
  const COLORS = ["#e6cf9c", "#e7c9bd", "#c39b52", "#f0dcc0", "#d8a679"];

  function size() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function count() {
    // fewer petals on small / low-power screens
    const area = w * h;
    return Math.max(10, Math.min(34, Math.round(area / 60000)));
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function makePetal() {
    return {
      x: rand(0, w),
      y: rand(-h, 0),
      size: rand(6, 14),
      speedY: rand(0.4, 1.3),
      speedX: rand(-0.6, 0.6),
      sway: rand(0.005, 0.02),
      swayPhase: rand(0, Math.PI * 2),
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-0.02, 0.02),
      color: COLORS[(Math.random() * COLORS.length) | 0],
      opacity: rand(0.35, 0.85)
    };
  }

  function build() {
    petals = Array.from({ length: count() }, makePetal);
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    // simple petal shape (two arcs)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(p.size / 2, -p.size / 2, p.size / 2, -p.size * 1.5, 0, -p.size * 2);
    ctx.bezierCurveTo(-p.size / 2, -p.size * 1.5, -p.size / 2, -p.size / 2, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const p of petals) {
      p.swayPhase += p.sway;
      p.x += p.speedX + Math.sin(p.swayPhase) * 0.6;
      p.y += p.speedY;
      p.rot += p.rotSpeed;

      if (p.y > h + 30) {           // recycle to the top
        p.y = rand(-60, -10);
        p.x = rand(0, w);
      }
      if (p.x > w + 30) p.x = -20;
      if (p.x < -30) p.x = w + 20;

      drawPetal(p);
    }
    raf = requestAnimationFrame(tick);
  }

  function start() { if (!raf) tick(); }
  function stop() { cancelAnimationFrame(raf); raf = null; }

  // Pause when the tab is not visible (saves battery)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else start();
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { size(); build(); }, 200);
  });

  size();
  build();
  start();
})();
