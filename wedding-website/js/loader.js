/* =============================================================
   loader.js · "The Unveiling"
   Draws a scratchable gold-foil layer over the Save-the-Date card.
   As the guest scratches, we measure how much foil is gone; past a
   threshold the card auto-clears, the "Enter" button appears, and
   clicking it parts the velvet curtains to reveal the site.

   Replaces the old preloader — main.js checks for window.WED.loader
   so the two never both lock the scroll.
   ============================================================= */
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const loader = document.getElementById("loader");

  // Expose a tiny handshake object so main.js knows the loader is driving intro.
  window.WED = window.WED || {};

  // If there's no loader in the DOM, let main.js run its own intro.
  if (!loader) { window.WED.loader = false; return; }
  window.WED.loader = true;

  const canvas   = document.getElementById("scratchCanvas");
  const enterBtn = document.getElementById("loaderEnter");
  const skipBtn  = document.getElementById("loaderSkip");
  const card     = loader.querySelector(".loader__card");

  document.body.classList.add("is-loading");

  let opened = false;

  /* ---- Reveal the actual site ---- */
  function openCurtains() {
    if (opened) return;
    opened = true;
    loader.classList.add("is-open");
    document.body.classList.remove("is-loading");
    // let main.js kick off the hero animations
    requestAnimationFrame(() => document.body.classList.add("is-loaded"));
    // tidy up after the curtain transition
    setTimeout(() => { loader.classList.add("is-done"); }, 1450);
    loader.addEventListener("transitionend", (e) => {
      if (e.target === loader && loader.classList.contains("is-done")) loader.remove();
    });
    window.removeEventListener("resize", onResize);
  }

  /* ---- Card cleared → show the Enter button, then drift into the site ---- */
  function cardCleared(openDelay) {
    if (loader.classList.contains("is-scratched")) return;
    loader.classList.add("is-scratched");
    if (enterBtn) enterBtn.focus({ preventScroll: true });
    // Once they've seen the date, don't leave them parked on this screen —
    // slip into the celebration after a short beat (the Enter button still
    // works instantly for anyone who'd rather not wait).
    setTimeout(openCurtains, typeof openDelay === "number" ? openDelay : 4000);
  }

  /* =========================================================
     Reduced motion / no-canvas path: skip the scratch entirely
     ========================================================= */
  if (reduce || !canvas || !canvas.getContext) {
    if (canvas) canvas.style.display = "none";
    cardCleared();
    if (enterBtn) enterBtn.addEventListener("click", openCurtains);
    if (skipBtn)  skipBtn.addEventListener("click", openCurtains);
    // Auto-open shortly so nobody is stranded
    setTimeout(openCurtains, reduce ? 400 : 6000);
    return;
  }

  /* =========================================================
     Scratch-card mechanic
     ========================================================= */
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let drawing = false;
  let lastPt = null;
  let cleared = false;
  let checkPending = false;
  let autoScratching = false;
  let autoTimer = null;

  function paintFoil() {
    const rect = card.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Brushed-gold gradient
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0.00, "#b8912f");
    g.addColorStop(0.25, "#e8c874");
    g.addColorStop(0.50, "#a9781f");
    g.addColorStop(0.75, "#f0d98f");
    g.addColorStop(1.00, "#c39b52");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Fine sparkle speckle so the foil reads as metallic
    for (let i = 0; i < (W * H) / 900; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.35)" : "rgba(120,80,20,0.25)";
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // Engraved prompt on the foil
    ctx.fillStyle = "rgba(60,38,10,0.55)";
    ctx.font = "600 13px 'Jost', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.setLineDash([]);
    ctx.fillText("S C R A T C H   T O   R E V E A L", W / 2, H / 2 - 8);
    ctx.font = "italic 15px 'Cormorant Garamond', serif";
    ctx.fillText("✦ our day ✦", W / 2, H / 2 + 14);
  }

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function scratch(x, y) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = Math.max(26, Math.min(W, H) * 0.12);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (lastPt) {
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    lastPt = { x, y };
    scheduleCheck();
  }

  // Sample the alpha channel to estimate how much has been cleared.
  function scheduleCheck() {
    if (checkPending || cleared) return;
    checkPending = true;
    setTimeout(() => {
      checkPending = false;
      const step = 8 * dpr;
      let clear = 0, total = 0;
      try {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4 * step) {
          total++;
          if (data[i] < 40) clear++;
        }
      } catch (err) { return; }        // canvas tainted — shouldn't happen, no external imgs
      if (total && clear / total > 0.30) {
        cleared = true;
        // fade the remaining foil away gracefully
        canvas.style.transition = "opacity 0.5s ease";
        canvas.style.opacity = "0";
        // Auto-scratched cards get a shorter beat before the curtains roll.
        cardCleared(autoScratching ? 1400 : undefined);
      }
    }, 60);
  }

  function markTouched() {
    loader.classList.add("is-touched");
    // The guest took over — call off the auto-scratch.
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  /* ---- Nobody scratched? Scratch it for them, then reveal. ----
     After a short wait we sweep the "brush" across the foil ourselves so
     the card visibly gets scratched open (rather than just vanishing),
     then drift into the site. Bails the moment a real scratch begins. */
  function autoScratch() {
    if (cleared || autoScratching || loader.classList.contains("is-touched")) return;
    autoScratching = true;

    const strokes = [
      { y: 0.30 }, { y: 0.44 }, { y: 0.58 }, { y: 0.72 }
    ];
    const stepMs = 130;

    strokes.forEach((s, row) => {
      // left-to-right on even rows, right-to-left on odd → a natural zig-zag
      const forward = row % 2 === 0;
      const segments = 14;
      for (let i = 0; i <= segments; i++) {
        setTimeout(() => {
          if (loader.classList.contains("is-touched") || cleared) return;
          const t = forward ? i / segments : 1 - i / segments;
          const jitter = (i % 2 ? 1 : -1) * H * 0.03;
          scratch(W * (0.06 + t * 0.88), H * s.y + jitter);
        }, row * (segments + 2) * (stepMs / segments) + i * (stepMs / segments));
      }
    });
    // If the sampling threshold hasn't already fired the reveal, force it.
    setTimeout(() => {
      if (cleared || loader.classList.contains("is-touched")) return;
      cleared = true;
      canvas.style.transition = "opacity 0.5s ease";
      canvas.style.opacity = "0";
      cardCleared(1400);
    }, strokes.length * (16) * (stepMs / 14) + 400);
  }

  function down(e) { drawing = true; lastPt = null; markTouched(); const p = pos(e); scratch(p.x, p.y); e.preventDefault(); }
  function move(e) { if (!drawing) return; const p = pos(e); scratch(p.x, p.y); e.preventDefault(); }
  function up()     { drawing = false; lastPt = null; }

  canvas.addEventListener("mousedown", down);
  window.addEventListener("mousemove", move, { passive: false });
  window.addEventListener("mouseup", up);
  canvas.addEventListener("touchstart", down, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", up);

  let rt;
  function onResize() {
    clearTimeout(rt);
    rt = setTimeout(() => { if (!cleared) { dpr = Math.min(window.devicePixelRatio || 1, 2); paintFoil(); } }, 200);
  }
  window.addEventListener("resize", onResize);

  // Buttons
  if (enterBtn) enterBtn.addEventListener("click", openCurtains);
  if (skipBtn)  skipBtn.addEventListener("click", () => { cardCleared(); openCurtains(); });

  // If the guest hasn't started scratching within a few seconds, scratch the
  // card for them and glide into the site — nobody gets stranded here.
  autoTimer = setTimeout(autoScratch, 4000);

  // Paint once fonts/layout settle.
  if (document.readyState === "complete") paintFoil();
  else window.addEventListener("load", paintFoil);
  // also paint now so there's no flash of the prize
  requestAnimationFrame(paintFoil);
})();
