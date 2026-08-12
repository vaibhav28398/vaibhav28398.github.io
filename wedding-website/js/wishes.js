/* =============================================================
   wishes.js · "The Wishing Sky" — a sky-lantern guestbook
   Self-contained: does nothing unless #wishes exists on the page.
   Vanilla JS, no dependencies, no network calls.

   Guests write a short blessing for Vaibhav & Nishita, sign it, and
   "release" a glowing kandeel that lifts off into a dusk sky over
   Lucknow, gently swaying, before joining the ambient drift.

   Every released wish is saved to localStorage (key "va_wishes_v1")
   so the sky keeps filling up across visits — a living guestbook.
   Returning visitors find the lanterns already floating; tap any
   one to read that wish. The look of a lantern (size, speed, tint)
   is derived deterministically from its text via the same xmur3 +
   mulberry32 PRNG the fortune teller uses, so a given wish always
   looks the same.
   ============================================================= */
(function () {
  "use strict";

  var STORE_KEY = "va_wishes_v1";
  var MAX_STORED = 60;   // keep the newest N wishes so storage stays sane
  var MAX_VISIBLE = 14;  // cap ambient lanterns in the DOM; extras cycle in
  var MAX_LEN = 140;     // character cap on a wish
  var NAME_FALLBACK = "A friend of the couple";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    var root = document.getElementById("wishes");
    if (!root) return; // this page doesn't have the wishing sky — bail quietly

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var sky = root.querySelector("#wishesSky");
    var form = root.querySelector("#wishesForm");
    var text = root.querySelector("#wishesText");
    var name = root.querySelector("#wishesName");
    var counter = root.querySelector("#wishesCounter");
    var countLine = root.querySelector("#wishesCount");
    if (!sky || !form || !text) return; // markup we depend on is missing — bail quietly

    var textField = text.closest(".wishes__field");

    // The full, ordered list of wishes (newest last). The sky shows a
    // rolling window of MAX_VISIBLE; when there are more, we cycle them
    // in as lanterns finish a loop, so nothing is ever lost.
    var wishes = loadWishes();
    if (!wishes.length) {
      wishes = seedWishes();
      saveWishes(wishes); // persist the pre-seeded sky so it's stable on return
    }

    var visibleCount = 0; // how many of `wishes` are currently in the sky
    var nextIndex = 0;     // pointer into `wishes` for the cycling window

    if (reduce) {
      renderStatic();
    } else {
      renderAmbient();
      wireVisibilityPausing();
    }

    updateCount();
    wireCounter();
    wireForm();

    /* =========================================================
       Rendering the ambient sky
       ========================================================= */
    function renderAmbient() {
      sky.innerHTML = "";
      appendSkyDecor();
      // show the most recent wishes first, capped at MAX_VISIBLE
      var start = Math.max(0, wishes.length - MAX_VISIBLE);
      nextIndex = start;
      visibleCount = 0;
      for (var i = start; i < wishes.length; i++) {
        addLantern(wishes[i], (i - start) * 1.6, false); // stagger start times
      }
      nextIndex = wishes.length % Math.max(1, wishes.length);
    }

    function renderStatic() {
      sky.classList.add("wishes__sky--static");
      sky.innerHTML = "";
      appendSkyDecor();
      // a tasteful static cluster — most recent wishes, no drifting
      var start = Math.max(0, wishes.length - MAX_VISIBLE);
      for (var i = start; i < wishes.length; i++) {
        addLantern(wishes[i], 0, false);
      }
    }

    // horizon glow, palace skyline silhouette and water shimmer
    function appendSkyDecor() {
      var horizon = document.createElement("div");
      horizon.className = "wishes__horizon";
      horizon.setAttribute("aria-hidden", "true");

      var water = document.createElement("div");
      water.className = "wishes__water";
      water.setAttribute("aria-hidden", "true");

      var skyline = document.createElement("div");
      skyline.className = "wishes__skyline";
      skyline.setAttribute("aria-hidden", "true");
      skyline.innerHTML = PALACE_SVG;

      sky.appendChild(horizon);
      sky.appendChild(water);
      sky.appendChild(skyline);
    }

    /* =========================================================
       A single lantern
       ========================================================= */
    function addLantern(wish, delaySeconds, isLaunch) {
      var look = lanternLook(wish);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wishes__lantern";
      btn.setAttribute("data-cursor", "link");
      var who = wish.name || NAME_FALLBACK;
      btn.setAttribute("aria-label", "Read the wish from " + who);
      btn.style.setProperty("--x", look.x + "%");
      btn.style.setProperty("--scale", look.scale);
      btn.style.setProperty("--dur", look.dur + "s");
      btn.style.setProperty("--sway", look.sway + "s");
      btn.style.setProperty("--drift", look.drift + "px");
      btn.style.setProperty("--tint", look.tint);
      if (!isLaunch) btn.style.setProperty("--delay", "-" + delaySeconds + "s");

      var sway = document.createElement("span");
      sway.className = "wishes__lantern-sway";

      var halo = document.createElement("span");
      halo.className = "wishes__lantern-halo";
      halo.setAttribute("aria-hidden", "true");

      var body = document.createElement("span");
      body.className = "wishes__lantern-body";

      var flame = document.createElement("span");
      flame.className = "wishes__lantern-flame";
      flame.setAttribute("aria-hidden", "true");
      body.appendChild(flame);

      var label = document.createElement("span");
      label.className = "wishes__lantern-name";
      label.textContent = who;

      sway.appendChild(halo);
      sway.appendChild(body);
      sway.appendChild(label);
      btn.appendChild(sway);

      btn.addEventListener("click", function () { openWish(wish, btn); });

      if (isLaunch && !reduce) {
        btn.classList.add("is-launching");
        // once it has flown up, hand it over to the endless ambient drift
        btn.addEventListener("animationend", function handoff(e) {
          if (e.animationName !== "wishesLaunch") return;
          btn.removeEventListener("animationend", handoff);
          btn.classList.remove("is-launching");
          btn.style.removeProperty("bottom");
          // trim the oldest lantern if we're over the visible cap
          trimVisible();
        });
      }

      sky.appendChild(btn);
      visibleCount++;
      return btn;
    }

    // keep the DOM count reasonable — drop the oldest ambient lantern
    function trimVisible() {
      var lanterns = sky.querySelectorAll(".wishes__lantern:not(.is-launching)");
      while (lanterns.length > MAX_VISIBLE) {
        lanterns[0].parentNode.removeChild(lanterns[0]);
        lanterns = sky.querySelectorAll(".wishes__lantern:not(.is-launching)");
      }
    }

    /* =========================================================
       Reading a wish — WED.openModal if present, else a popover
       ========================================================= */
    function openWish(wish, sourceBtn) {
      var who = wish.name || NAME_FALLBACK;
      if (window.WED && typeof window.WED.openModal === "function") {
        try {
          window.WED.openModal({
            tag: "A wish for the couple",
            title: 'From <span class="script">the sky</span>',
            body: "<p>" + escapeHtml(wish.text) + "</p>",
            sign: "— " + escapeHtml(who)
          });
          return;
        } catch (err) { /* fall through to the local popover */ }
      }
      showPopover(wish, sourceBtn);
    }

    var popover, popScrim, popLastFocus;
    function showPopover(wish, sourceBtn) {
      closePopover();
      popLastFocus = sourceBtn || document.activeElement;

      popScrim = document.createElement("div");
      popScrim.className = "wishes__popover-scrim";
      popScrim.addEventListener("click", closePopover);

      popover = document.createElement("div");
      popover.className = "wishes__popover";
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-modal", "false");
      popover.setAttribute("aria-label", "A wish for the couple");

      var who = wish.name || NAME_FALLBACK;
      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "wishes__popover-close";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", closePopover);

      var p = document.createElement("p");
      p.className = "wishes__popover-text";
      p.textContent = "“" + wish.text + "”";

      var sig = document.createElement("span");
      sig.className = "wishes__popover-name";
      sig.textContent = "— " + who;

      popover.appendChild(closeBtn);
      popover.appendChild(p);
      popover.appendChild(sig);
      document.body.appendChild(popScrim);
      document.body.appendChild(popover);

      positionPopover(sourceBtn);
      requestAnimationFrame(function () { popover.classList.add("is-open"); });
      closeBtn.focus({ preventScroll: true });
      document.addEventListener("keydown", onPopoverKey);
    }

    function positionPopover(sourceBtn) {
      if (!popover) return;
      var rect = popover.getBoundingClientRect();
      var top, left;
      if (sourceBtn) {
        var r = sourceBtn.getBoundingClientRect();
        left = r.left + r.width / 2 - rect.width / 2;
        top = r.bottom + 12;
        // if it would spill off the bottom, place it above the lantern
        if (top + rect.height > window.innerHeight - 12) {
          top = r.top - rect.height - 12;
        }
      } else {
        left = window.innerWidth / 2 - rect.width / 2;
        top = window.innerHeight / 2 - rect.height / 2;
      }
      left = Math.max(12, Math.min(left, window.innerWidth - rect.width - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - rect.height - 12));
      popover.style.left = left + "px";
      popover.style.top = top + "px";
    }

    function onPopoverKey(e) {
      if (e.key === "Escape") closePopover();
    }

    function closePopover() {
      document.removeEventListener("keydown", onPopoverKey);
      if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
      if (popScrim && popScrim.parentNode) popScrim.parentNode.removeChild(popScrim);
      popover = null;
      popScrim = null;
      if (popLastFocus && typeof popLastFocus.focus === "function") {
        popLastFocus.focus({ preventScroll: true });
        popLastFocus = null;
      }
    }

    /* =========================================================
       The form — releasing a lantern
       ========================================================= */
    function wireForm() {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var wishText = (text.value || "").trim();
        if (!wishText) {
          nudge();
          return;
        }
        if (wishText.length > MAX_LEN) wishText = wishText.slice(0, MAX_LEN);

        var wish = {
          text: wishText,
          name: (name && name.value ? name.value.trim() : "") || "",
          ts: stamp(),
          seed: wishText + "|" + (name && name.value ? name.value.trim() : "")
        };

        wishes.push(wish);
        if (wishes.length > MAX_STORED) wishes = wishes.slice(-MAX_STORED);
        saveWishes(wishes);

        release(wish);
        updateCount();

        // a small celebratory burst, only if the host page wired one up
        if (window.WED && typeof window.WED.confetti === "function") {
          try {
            var r = form.getBoundingClientRect();
            window.WED.confetti({ x: r.left + r.width / 2, y: r.top, count: 46, spread: 1.1 });
          } catch (err) { /* never let a bad confetti hook break the release */ }
        }

        form.reset();
        syncCounter();
      });
    }

    function release(wish) {
      if (reduce) {
        // no flight — just add the lantern to the static cluster and read it
        addLantern(wish, 0, false);
        if (window.WED && typeof window.WED.toast === "function") {
          try { window.WED.toast("Your wish has joined the sky <b>✨</b>"); } catch (e) {}
        }
        return;
      }
      addLantern(wish, 0, true);
    }

    function nudge() {
      if (!textField) { if (text) text.focus(); return; }
      textField.classList.remove("is-nudged");
      void textField.offsetWidth; // re-trigger the wiggle even if just shown
      textField.classList.add("is-nudged");
      if (text) text.focus();
    }

    /* =========================================================
       Character counter
       ========================================================= */
    function wireCounter() {
      if (!text) return;
      text.setAttribute("maxlength", String(MAX_LEN));
      text.addEventListener("input", function () {
        if (textField) textField.classList.remove("is-nudged");
        syncCounter();
      });
      syncCounter();
    }

    function syncCounter() {
      if (!counter) return;
      var len = (text.value || "").length;
      counter.textContent = len + " / " + MAX_LEN;
      counter.classList.toggle("is-limit", len >= MAX_LEN);
    }

    /* =========================================================
       The live counter line
       ========================================================= */
    function updateCount() {
      if (!countLine) return;
      var n = wishes.length;
      countLine.innerHTML =
        "<b>" + n + "</b> " + (n === 1 ? "wish" : "wishes") +
        " released into the Lucknow sky";
    }

    /* =========================================================
       Pause the drift when offscreen or the tab is hidden
       ========================================================= */
    function wireVisibilityPausing() {
      var onscreen = true;

      function apply() {
        var paused = !onscreen || document.hidden;
        sky.classList.toggle("is-paused", paused);
      }

      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { onscreen = entry.isIntersecting; });
          apply();
        }, { threshold: 0.01 });
        io.observe(sky);
      }

      document.addEventListener("visibilitychange", apply);
      apply();
    }
  }

  /* ===========================================================
     Deterministic look per wish
     Reuses the fortune teller's xmur3 + mulberry32 pair so a given
     wish always drifts, glows and tints the same way, forever.
     =========================================================== */
  function lanternLook(wish) {
    var seedStr = (wish.seed || wish.text || "") + "|" + (wish.ts || 0);
    var rand = mulberry32(xmur3(seedStr)());
    var range = function (min, max) { return min + rand() * (max - min); };

    // warm palette only — golds through terracotta (hue 26–48)
    var tint = Math.round(range(26, 48));
    return {
      x: Math.round(range(8, 92)),        // horizontal launch position, %
      scale: +range(0.75, 1.5).toFixed(2), // size
      dur: Math.round(range(22, 40)),      // seconds for a full rise
      sway: +range(5, 9).toFixed(1),       // sway period
      drift: Math.round(range(8, 22)),     // sway amplitude, px
      tint: tint
    };
  }

  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ===========================================================
     Storage — always wrapped, degrades gracefully in private mode
     =========================================================== */
  function loadWishes() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (w) {
        return w && typeof w.text === "string" && w.text.trim();
      }).slice(-MAX_STORED);
    } catch (err) {
      return []; // storage unavailable or corrupt — start from an empty sky
    }
  }

  function saveWishes(list) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-MAX_STORED)));
    } catch (err) {
      /* private mode or quota — the sky still works this session, just isn't saved */
    }
  }

  // Charming defaults so the sky is never empty on a first visit.
  function seedWishes() {
    var base = 1765000000000; // fixed timestamps → deterministic seeded look
    var seeds = [
      { text: "May your love be as endless as the lights over Lucknow tonight.", name: "Priya" },
      { text: "Wishing you a lifetime of shared chai and stolen desserts. So happy for you both!", name: "Rohan" },
      { text: "Beta, may your home always be full of laughter, good food, and open doors.", name: "Aunty Meera" },
      { text: "To Vaibhav & Nishita — here's to growing old and still being each other's favourite.", name: "The Sharmas" },
      { text: "Two hearts, one beautiful adventure. Can't wait to dance at your sangeet!", name: "Kabir" },
      { text: "May every Lucknow evening remind you of how bright your love began.", name: "Tara" }
    ];
    return seeds.map(function (s, i) {
      return { text: s.text, name: s.name, ts: base + i * 1000, seed: s.text + "|" + s.name };
    });
  }

  /* ===========================================================
     Small helpers
     =========================================================== */
  // A monotonic-ish timestamp without tripping over environments where
  // Date is stubbed; falls back to a fixed base so seeding stays stable.
  function stamp() {
    try { return Date.now(); } catch (e) { return 1765000000000; }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // A tasteful Awadhi skyline (Lucknow-style domes & chhatris),
  // drawn as a filled silhouette so it needs no image asset.
  var PALACE_SVG =
    '<svg viewBox="0 0 1200 96" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">' +
      '<path d="M0,96 L0,64 L60,64 L60,52 L96,52 L96,64 L150,64 L150,40 ' +
      'Q160,20 170,40 L170,64 L210,64 L210,48 L206,48 L206,40 L214,40 L214,48 L210,48 ' +
      'L210,64 L250,64 L250,30 Q262,6 274,30 L274,64 L300,64 L300,50 L340,50 L340,64 ' +
      'L360,64 L360,44 Q372,22 384,44 L384,64 L430,64 L430,56 L470,56 L470,38 ' +
      'Q482,16 494,38 L494,64 L540,64 L540,26 Q560,-6 580,26 L580,64 L620,64 L620,26 ' +
      'Q640,-6 660,26 L660,64 L706,64 L706,38 Q718,16 730,38 L730,56 L770,56 L770,64 ' +
      'L816,64 L816,44 Q828,22 840,44 L840,64 L860,64 L860,50 L900,50 L900,64 L926,64 ' +
      'L926,30 Q938,6 950,30 L950,64 L990,64 L990,48 L986,48 L986,40 L994,40 L994,48 ' +
      'L990,48 L990,64 L1030,64 L1030,40 Q1040,20 1050,40 L1050,64 L1104,64 L1104,52 ' +
      'L1140,52 L1140,64 L1200,64 L1200,96 Z" />' +
    '</svg>';
})();
