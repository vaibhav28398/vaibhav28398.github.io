/* =============================================================
   easter.js · the hidden layer
   Everything here is optional delight. Nothing blocks the site.

   Public API (window.WED):
     WED.confetti(opts)  → burst of heart/petal confetti
     WED.toast(html)     → transient bottom toast
     WED.openModal(cfg)  → the ornate secret modal
     WED.findSecret(id)  → registers a discovered easter egg

   Eggs:
     • Click the floating ring  → a secret love note + confetti
     • Konami code              → unlocks the hidden "vault" album
     • Type  MISO               → the cat pads across the screen
     • Type  FOREVER            → confetti downpour
     • Secret code in vault     → typing 101226 also opens the vault
     • Console love-letter for the curious
   ============================================================= */
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.WED = window.WED || {};

  const $ = (s, c = document) => c.querySelector(s);

  /* =========================================================
     CONFETTI ENGINE  (hearts + petals, physics-lite)
     ========================================================= */
  const confetti = (function () {
    const canvas = $("#confettiCanvas");
    if (!canvas) return function () {};
    const ctx = canvas.getContext("2d");
    let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let pieces = [];
    let raf = null;
    const GOLD = ["#c39b52", "#e6cf9c", "#a67c33", "#e7c9bd", "#b5623f", "#f0dcc0"];

    function size() {
      W = canvas.width = window.innerWidth * dpr;
      H = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }
    size();
    window.addEventListener("resize", size);

    function heart(ctx, x, y, s, rot, color, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(s, s);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.bezierCurveTo(0, 1.5, -1, 0, -2.5, 0);
      ctx.bezierCurveTo(-5, 0, -5, 3.2, -5, 3.2);
      ctx.bezierCurveTo(-5, 5, -3, 7, 0, 9);
      ctx.bezierCurveTo(3, 7, 5, 5, 5, 3.2);
      ctx.bezierCurveTo(5, 3.2, 5, 0, 2.5, 0);
      ctx.bezierCurveTo(1, 0, 0, 1.5, 0, 3);
      ctx.fill();
      ctx.restore();
    }

    function spawn(opts) {
      const o = opts || {};
      const count = o.count || 90;
      const originX = (o.x != null ? o.x : window.innerWidth / 2) * dpr;
      const originY = (o.y != null ? o.y : window.innerHeight / 2) * dpr;
      const spread = o.spread || 1;
      for (let i = 0; i < count; i++) {
        const angle = (o.downpour ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * (o.downpour ? 0.6 : 2.4) * spread;
        const speed = (o.downpour ? 2 : 6 + Math.random() * 7) * dpr;
        pieces.push({
          x: o.downpour ? Math.random() * W : originX,
          y: o.downpour ? -20 : originY,
          vx: Math.cos(angle) * speed * (o.downpour ? 0.4 : 1),
          vy: Math.sin(angle) * speed - (o.downpour ? 0 : Math.random() * 4 * dpr),
          g: (0.12 + Math.random() * 0.1) * dpr,
          s: (0.8 + Math.random() * 1.6),
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          color: GOLD[(Math.random() * GOLD.length) | 0],
          life: 0,
          maxLife: 120 + Math.random() * 80,
          isHeart: Math.random() > 0.45
        });
      }
      if (pieces.length > 700) pieces = pieces.slice(-700);
      if (!raf) loop();
    }

    function loop() {
      ctx.clearRect(0, 0, W, H);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.995;
        p.rot += p.vr;
        p.life++;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (p.isHeart) {
          heart(ctx, p.x, p.y, p.s * dpr * 1.4, p.rot, p.color, alpha);
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(-3 * dpr, -5 * dpr, 6 * dpr * p.s, 10 * dpr * p.s);
          ctx.restore();
        }
        if (p.life > p.maxLife || p.y > H + 40) pieces.splice(i, 1);
      }
      if (pieces.length) raf = requestAnimationFrame(loop);
      else { ctx.clearRect(0, 0, W, H); raf = null; }
    }

    return function (opts) {
      if (reduce) return;         // keep it calm for reduced-motion folks
      spawn(opts);
    };
  })();
  window.WED.confetti = confetti;

  /* =========================================================
     TOAST
     ========================================================= */
  let toastEl, toastTimer;
  function toast(html, ms) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "egg-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = html;
    requestAnimationFrame(() => toastEl.classList.add("is-visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), ms || 3600);
  }
  window.WED.toast = toast;

  /* =========================================================
     SECRET MODAL  (shared ornate dialog)
     ========================================================= */
  const modal = $("#eggModal");
  const modalBox = modal ? $(".egg-modal__box", modal) : null;
  let lastFocus = null;

  function openModal(cfg) {
    if (!modal) return;
    lastFocus = document.activeElement;
    modalBox.innerHTML = `
      <button class="egg-modal__close" aria-label="Close">&times;</button>
      <div class="egg-modal__seal">V&amp;N</div>
      <span class="egg-modal__tag">${cfg.tag || "A little secret"}</span>
      <h3 class="egg-modal__title">${cfg.title || ""}</h3>
      <div class="egg-modal__body">${cfg.body || ""}</div>
      ${cfg.sign ? `<div class="egg-modal__sign">${cfg.sign}</div>` : ""}
      ${cfg.extra || ""}
    `;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const closeBtn = $(".egg-modal__close", modalBox);
    closeBtn.addEventListener("click", closeModal);
    closeBtn.focus({ preventScroll: true });
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal || e.target.classList.contains("egg-modal__scrim")) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });
  }
  window.WED.openModal = openModal;
  window.WED.closeModal = closeModal;

  /* =========================================================
     SECRET TRACKER  (little badge on the ring)
     ========================================================= */
  const TOTAL_SECRETS = 4;
  const found = new Set();
  const ring = $("#ringEgg");
  const badge = ring ? $(".ring-egg__badge", ring) : null;
  function findSecret(id) {
    if (found.has(id)) return false;
    found.add(id);
    if (ring && badge) {
      ring.classList.add("has-finds");
      badge.textContent = found.size;
      ring.style.animation = "none"; void ring.offsetWidth; ring.style.animation = "";
    }
    if (found.size === TOTAL_SECRETS) {
      setTimeout(() => {
        toast("You found every hidden secret — you truly know us <b>♥</b>");
        confetti({ count: 140 });
      }, 900);
    }
    return true;
  }
  window.WED.findSecret = findSecret;

  /* =========================================================
     EGG 1 · the floating ring → love note
     ========================================================= */
  if (ring) {
    ring.addEventListener("click", () => {
      const r = ring.getBoundingClientRect();
      confetti({ x: r.left + r.width / 2, y: r.top, count: 70, spread: 1.2 });
      findSecret("ring");
      openModal({
        tag: "You found the ring",
        title: 'A note, just <span class="script">between us</span>',
        body: `
          <p>If you're reading this, you're the curious sort — the kind who
          notices the little things. We love that about you.</p>
          <p>Marriage, we're told, is mostly about noticing: the second cup of
          chai made without asking, the song hummed off-key, the umbrella
          shared in the rain. Thank you for noticing us.</p>`,
        sign: "— V &amp; N"
      });
    });
    ring.setAttribute("tabindex", "0");
    ring.setAttribute("role", "button");
    ring.setAttribute("aria-label", "A little secret");
    ring.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ring.click(); } });
  }

  /* =========================================================
     THE HIDDEN VAULT  (album unlocked by Konami / code)
     ========================================================= */
  let vaultUnlocked = false;
  function openVault(via) {
    // The "off-camera" album — kept exclusive from the public gallery.
    // These files aren't shown in the gallery grid, so the vault stays a surprise.
    const imgs = ["vault-2", "vault-4", "vault-7", "gallery-1", "gallery-8"].map((name, i) =>
      `<img src="img/${name}.jpg" alt="Behind-the-scenes ${i + 1}" loading="lazy" />`
    ).join("");
    findSecret("vault");
    openModal({
      tag: via === "konami" ? "↑↑↓↓←→←→ B A" : "Vault unlocked",
      title: 'The <span class="script">off-camera</span> album',
      body: `<p>The photos we didn't post — burnt toast, bad hair days, the
             faces we make when nobody's looking. The real us.</p>`,
      extra: `<div class="egg-modal__grid">${imgs}</div>
              <p class="egg-modal__note">Psst — you can also open this any time by typing <kbd>1 0 1 2 2 6</kbd>.</p>`
    });
    if (!vaultUnlocked) { vaultUnlocked = true; confetti({ count: 110 }); }
  }

  /* =========================================================
     KEYBOARD SECRETS  (Konami + typed words + code)
     ========================================================= */
  const KONAMI = ["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];
  let kIdx = 0;
  let typed = "";
  let codeBuf = "";

  document.addEventListener("keydown", (e) => {
    // ignore while typing in a field
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;

    const key = e.key.toLowerCase();

    // Konami
    if (key === KONAMI[kIdx]) {
      kIdx++;
      if (kIdx === KONAMI.length) { kIdx = 0; openVault("konami"); }
    } else {
      kIdx = (key === KONAMI[0]) ? 1 : 0;
    }

    // Word triggers (letters only)
    if (/^[a-z]$/.test(key)) {
      typed = (typed + key).slice(-8);
      if (typed.endsWith("miso")) { summonMiso(); }
      if (typed.endsWith("forever")) {
        findSecret("forever");
        confetti({ count: 60, downpour: true });
        setTimeout(() => confetti({ count: 60, downpour: true }), 400);
        setTimeout(() => confetti({ count: 60, downpour: true }), 800);
        toast("Forever it is. <b>♥</b>");
      }
    }

    // Numeric code 101226 → vault
    if (/^[0-9]$/.test(key)) {
      codeBuf = (codeBuf + key).slice(-6);
      if (codeBuf === "101226") openVault("code");
    }
  });

  /* =========================================================
     EGG 3 · MISO the cat pads across the screen
     ========================================================= */
  const miso = $("#miso");
  function summonMiso() {
    if (!miso) return;
    if (miso.classList.contains("is-walking")) return;
    findSecret("miso");
    toast("Miso demands your attention. <b>🐾</b>");
    miso.classList.add("is-walking");
    if (reduce) { setTimeout(() => miso.classList.remove("is-walking"), 2500); return; }
    miso.addEventListener("animationend", function done() {
      miso.classList.remove("is-walking");
      miso.removeEventListener("animationend", done);
    });
  }
  // let people click the cat too, for a purr
  if (miso) miso.style.pointerEvents = "auto";
  if (miso) miso.addEventListener("click", () => {
    const r = miso.getBoundingClientRect();
    confetti({ x: r.left + r.width / 2, y: r.top, count: 24, spread: 1.4 });
  });

  /* =========================================================
     FLOATING "MAGIC" DOCK
     The Konami code, typing MISO / FOREVER, and the numeric vault
     code are lovely for the curious — but most guests will never
     stumble on them. This always-on-screen dock fans out the exact
     same delights so nobody misses out. The typed codes still work.
     ========================================================= */
  const funDock = $("#funDock");
  const funDockToggle = $("#funDockToggle");

  function closeDock() {
    if (!funDock) return;
    funDock.classList.remove("is-open");
    if (funDockToggle) funDockToggle.setAttribute("aria-expanded", "false");
  }
  function openDock() {
    if (!funDock) return;
    funDock.classList.add("is-open");
    if (funDockToggle) funDockToggle.setAttribute("aria-expanded", "true");
  }

  if (funDockToggle && funDock) {
    funDockToggle.addEventListener("click", () => {
      funDock.classList.contains("is-open") ? closeDock() : openDock();
    });
    // click anywhere outside the dock closes it
    document.addEventListener("click", (e) => {
      if (funDock.classList.contains("is-open") && !funDock.contains(e.target)) closeDock();
    });
    // Escape closes it (but not while the secret modal is up — that owns Escape)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && funDock.classList.contains("is-open") &&
          !(modal && modal.classList.contains("is-open"))) closeDock();
    });
  }

  const funMiso = $("#funMiso");
  if (funMiso) funMiso.addEventListener("click", () => { summonMiso(); closeDock(); });

  const funForever = $("#funForever");
  if (funForever) funForever.addEventListener("click", () => {
    findSecret("forever");
    confetti({ count: 60, downpour: true });
    setTimeout(() => confetti({ count: 60, downpour: true }), 400);
    setTimeout(() => confetti({ count: 60, downpour: true }), 800);
    toast("Forever it is. <b>♥</b>");
    closeDock();
  });

  const funVault = $("#funVault");
  if (funVault) funVault.addEventListener("click", () => { openVault("button"); closeDock(); });

  /* =========================================================
     Console love-letter for developers who peek
     ========================================================= */
  try {
    const big = "font-family:Georgia,serif;font-size:26px;color:#a67c33;font-style:italic";
    const small = "font-family:monospace;font-size:12px;color:#5c534b";
    console.log("%cVaibhav & Nishita  ✦  10·12·2026", big);
    console.log("%cCurious, are we? There are 4 secrets hidden on this page.\n• Click the ring, bottom-left\n• Try the Konami code ↑↑↓↓←→←→BA\n• Type MISO … or FOREVER\n• There's a numeric code somewhere too 😉", small);
  } catch (e) {}

  // Gentle first-visit nudge toward the ring (once things settle)
  setTimeout(() => {
    if (!found.size) toast("Tip: there are hidden secrets here — start with the <b>ring</b> ✦");
  }, 9000);
})();
