/* =============================================================
   main.js · Vaibhav & Nishita wedding site
   Vanilla JS — no dependencies. Organised into small modules
   that each run on DOMContentLoaded.
   ============================================================= */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ==========================================================
     0 · PRELOADER  +  hero intro
     ========================================================== */
  function initPreloader() {
    // The curtain/scratch loader (loader.js) drives the intro when present —
    // it sets window.WED.loader and toggles body.is-loaded itself. In that
    // case main.js must not run its own preloader or lock scrolling.
    if (window.WED && window.WED.loader) return;

    const pre = $("#preloader");
    // No legacy preloader either → just enable the hero animations.
    if (!pre) { document.body.classList.add("is-loaded"); return; }

    document.body.classList.add("is-loading");

    const finish = () => {
      pre.classList.add("is-done");
      document.body.classList.remove("is-loading");
      requestAnimationFrame(() => document.body.classList.add("is-loaded"));
      pre.addEventListener("transitionend", () => pre.remove(), { once: true });
    };

    const MIN = reduceMotion ? 200 : 1500;
    const start = performance.now();
    window.addEventListener("load", () => {
      const elapsed = performance.now() - start;
      setTimeout(finish, Math.max(0, MIN - elapsed));
    });
    setTimeout(finish, 4000);   // safety net if 'load' never fires
  }

  /* ==========================================================
     1 · SPLIT HERO NAMES into animated characters
     ========================================================== */
  function initSplitText() {
    $$("[data-split]").forEach((el) => {
      const text = el.textContent;
      el.textContent = "";
      el.setAttribute("aria-label", text);
      [...text].forEach((ch, i) => {
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = ch;
        span.style.setProperty("--ci", i);
        span.setAttribute("aria-hidden", "true");
        el.appendChild(span);
      });
    });
  }

  /* ==========================================================
     2 · CUSTOM CURSOR (desktop pointers only)
     ========================================================== */
  function initCursor() {
    if (isTouch) return;
    const ring = $("#cursor");
    const dot  = $("#cursorDot");
    if (!ring || !dot) return;

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;

    document.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    });

    (function follow() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(follow);
    })();

    // Hover states based on data-cursor attribute
    const map = { link: "is-hover", card: "is-hover", view: "is-view", text: "is-text" };
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest("[data-cursor]");
      ring.classList.remove("is-hover", "is-view", "is-text");
      if (t) ring.classList.add(map[t.dataset.cursor] || "is-hover");
    });

    document.addEventListener("mouseleave", () => ring.classList.add("is-hidden"));
    document.addEventListener("mouseenter", () => ring.classList.remove("is-hidden"));
  }

  /* ==========================================================
     3 · HEADER show/hide + scrolled state + scroll progress
     ========================================================== */
  function initHeader() {
    const header = $("#header");
    const progress = $("#scrollProgress");
    const tabbar = $("#tabbar");
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.width = (docH > 0 ? (y / docH) * 100 : 0) + "%";

      if (header) {
        header.classList.toggle("is-scrolled", y > 40);
        // hide on scroll-down, show on scroll-up (but not while menu open)
        if (!document.body.classList.contains("menu-open")) {
          if (y > lastY && y > 400) header.classList.add("is-hidden");
          else header.classList.remove("is-hidden");
        }
      }
      // tabbar hides on scroll down, shows on up
      if (tabbar) {
        if (y > lastY && y > 300) tabbar.classList.add("is-hidden");
        else tabbar.classList.remove("is-hidden");
      }
      lastY = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ==========================================================
     4 · OVERLAY MENU (hamburger)
     ========================================================== */
  function initMenu() {
    const toggle = $("#navToggle");
    const overlay = $("#menuOverlay");
    if (!toggle || !overlay) return;

    const close = () => {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    };
    const open = () => {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("menu-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
    };

    toggle.addEventListener("click", () =>
      document.body.classList.contains("menu-open") ? close() : open()
    );
    $$(".menu-overlay__link", overlay).forEach((a) => a.addEventListener("click", close));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) close();
    });
  }

  /* ==========================================================
     5 · SCROLL REVEAL (IntersectionObserver)
     ========================================================== */
  function initReveal() {
    const items = $$("[data-reveal]").filter((el) => !el.closest(".hero"));
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    items.forEach((el) => io.observe(el));

    // Gallery items get an index-based stagger
    const gItems = $$(".gallery__item");
    gItems.forEach((el, i) => el.style.setProperty("--i", i % 4));
    const gio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          gio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    gItems.forEach((el) => gio.observe(el));
  }

  /* ==========================================================
     6 · PARALLAX (hero + countdown backgrounds)
     ========================================================== */
  function initParallax() {
    if (reduceMotion) return;
    const layers = $$("[data-parallax]");
    if (!layers.length) return;

    let ticking = false;
    const update = () => {
      layers.forEach((layer) => {
        const speed = parseFloat(layer.dataset.parallax) || 0.2;
        const rect = layer.getBoundingClientRect();
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * -speed;
        layer.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ==========================================================
     7 · STORY horizontal scroll (desktop) via pinned section
     On mobile the CSS turns it into a vertical timeline, so we
     only wire up the scroll-jacking above the mobile breakpoint.
     ========================================================== */
  function initStoryScroll() {
    const pin = $("#storyPin");
    const track = $("#storyTrack");
    const section = $("#story");
    if (!pin || !track || !section) return;

    const isDesktop = () => window.matchMedia("(min-width: 721px)").matches;

    // We convert vertical scroll within the pinned area into
    // horizontal movement of the track. The section height is
    // extended so there's "room" to scroll through.
    let maxShift = 0;

    function measure() {
      if (!isDesktop() || reduceMotion) {
        section.style.height = "";
        track.style.transform = "";
        return;
      }
      // scrollWidth already includes the track's left+right padding, so the
      // right-hand gutter falls out naturally — no need to add it back.
      maxShift = Math.max(0, track.scrollWidth - window.innerWidth);
      const intro = $(".story__intro");
      const introH = intro ? intro.offsetHeight : 0;
      // Extend the section so vertical scroll distance == horizontal travel.
      section.style.height = window.innerHeight + maxShift + introH + "px";
    }

    function onScroll() {
      if (!isDesktop() || reduceMotion || maxShift <= 0) return;
      const rect = section.getBoundingClientRect();
      const intro = $(".story__intro");
      const introH = intro ? intro.offsetHeight : 0;
      // progress through the pinned range (0 → 1)
      const start = -rect.top - introH;
      const progress = Math.min(Math.max(start / maxShift, 0), 1);
      track.style.transform = `translate3d(${-progress * maxShift}px, 0, 0)`;
    }

    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) { requestAnimationFrame(() => { onScroll(); ticking = false; }); ticking = true; }
    }, { passive: true });

    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { measure(); onScroll(); }, 200);
    });

    // Images may change track width once loaded
    window.addEventListener("load", () => { measure(); onScroll(); });
    measure();
    onScroll();
  }

  /* ==========================================================
     8 · COUNTDOWN timer
     ========================================================== */
  function initCountdown() {
    const section = $("#countdown");
    if (!section) return;
    const target = new Date(section.dataset.date || "2026-12-10T19:00:00").getTime();
    const units = {
      days:    $('[data-unit="days"]', section),
      hours:   $('[data-unit="hours"]', section),
      minutes: $('[data-unit="minutes"]', section),
      seconds: $('[data-unit="seconds"]', section)
    };
    const prev = { days: null, hours: null, minutes: null, seconds: null };

    const pad = (n, len = 2) => String(Math.max(0, n)).padStart(len, "0");

    function tick() {
      const now = Date.now();
      let diff = Math.max(0, target - now);

      const d = Math.floor(diff / 86400000); diff -= d * 86400000;
      const h = Math.floor(diff / 3600000);  diff -= h * 3600000;
      const m = Math.floor(diff / 60000);    diff -= m * 60000;
      const s = Math.floor(diff / 1000);

      const vals = { days: pad(d, 3), hours: pad(h), minutes: pad(m), seconds: pad(s) };
      Object.keys(units).forEach((k) => {
        if (units[k] && prev[k] !== vals[k]) {
          units[k].textContent = vals[k];
          if (!reduceMotion) {
            units[k].classList.remove("is-tick");
            void units[k].offsetWidth;   // reflow to restart animation
            units[k].classList.add("is-tick");
          }
          prev[k] = vals[k];
        }
      });

      if (target - now <= 0) {
        clearInterval(timer);
        const note = $(".countdown__note", section);
        if (note) note.textContent = "Today is the day ♥";
      }
    }
    tick();
    const timer = setInterval(tick, 1000);
  }

  /* ==========================================================
     9 · EVENT CARD tilt + glow (pointer aware)
     ========================================================== */
  function initTilt() {
    if (isTouch || reduceMotion) return;
    $$("[data-tilt]").forEach((card) => {
      const glow = $(".event-card__glow", card);
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rx = (0.5 - py) * 8;
        const ry = (px - 0.5) * 8;
        card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
        if (glow) {
          glow.style.setProperty("--mx", px * 100 + "%");
          glow.style.setProperty("--my", py * 100 + "%");
        }
      });
      card.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
  }

  /* ==========================================================
     10 · GALLERY lightbox
     ========================================================== */
  function initLightbox() {
    const grid = $("#galleryGrid");
    const box = $("#lightbox");
    if (!grid || !box) return;

    const img = $("#lightboxImg");
    const cap = $("#lightboxCaption");
    const btnClose = $("#lightboxClose");
    const btnPrev = $("#lightboxPrev");
    const btnNext = $("#lightboxNext");
    const figures = $$(".gallery__item", grid);
    let index = 0;
    let lastFocus = null;

    function show(i) {
      index = (i + figures.length) % figures.length;
      const source = figures[index].querySelector("img");
      const full = source.dataset.full || source.src;
      img.src = full;
      img.alt = source.alt || "";
      cap.textContent = `${index + 1} / ${figures.length}`;
    }
    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.classList.add("is-open");
      box.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      btnClose.focus();
    }
    function close() {
      box.classList.remove("is-open");
      box.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }

    figures.forEach((fig, i) => {
      fig.addEventListener("click", () => open(i));
      fig.setAttribute("tabindex", "0");
      fig.setAttribute("role", "button");
      fig.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); }
      });
    });
    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", () => show(index - 1));
    btnNext.addEventListener("click", () => show(index + 1));
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    document.addEventListener("keydown", (e) => {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "ArrowLeft") show(index - 1);
    });

    // Swipe support on touch
    let sx = 0;
    box.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* ==========================================================
     11 · FAQ accordion (animated height)
     ========================================================== */
  function initFaq() {
    $$(".faq__item").forEach((item) => {
      const btn = $(".faq__q", item);
      const ans = $(".faq__a", item);
      if (!btn || !ans) return;
      btn.addEventListener("click", () => {
        const open = item.classList.contains("is-open");
        // close siblings for an accordion feel
        $$(".faq__item.is-open").forEach((other) => {
          if (other !== item) {
            other.classList.remove("is-open");
            $(".faq__q", other).setAttribute("aria-expanded", "false");
            $(".faq__a", other).style.height = "0px";
          }
        });
        if (open) {
          item.classList.remove("is-open");
          btn.setAttribute("aria-expanded", "false");
          ans.style.height = "0px";
        } else {
          item.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          ans.style.height = ans.scrollHeight + "px";
        }
      });
    });
  }

  /* ==========================================================
     12 · RSVP form — validation, conditional fields, success
     ========================================================== */
  function initRsvp() {
    const form = $("#rsvpForm");
    if (!form) return;
    const success = $("#rsvpSuccess");
    const guestField = $("#guestCountField");
    const mealField = $("#mealField");

    const setError = (field, msg) => {
      field.classList.toggle("has-error", !!msg);
      const el = $("[data-error]", field);
      if (el) el.textContent = msg || "";
    };
    const fieldOf = (input) => input.closest(".field");

    // Toggle conditional fields based on attendance
    function updateConditional() {
      const yes = form.querySelector('input[name="attending"]:checked')?.value === "yes";
      [guestField, mealField].forEach((f) => f && f.classList.toggle("is-visible", yes));
    }
    $$('input[name="attending"]', form).forEach((r) =>
      r.addEventListener("change", () => {
        updateConditional();
        setError(fieldOf(r), "");
      })
    );

    // Live-clear errors as the guest types
    ["guestName", "guestEmail"].forEach((id) => {
      const el = $("#" + id);
      if (el) el.addEventListener("input", () => setError(fieldOf(el), ""));
    });

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;

      const name = $("#guestName");
      const email = $("#guestEmail");
      const attending = form.querySelector('input[name="attending"]:checked');
      const attendingField = $(".field--choice", form);

      if (!name.value.trim()) { setError(fieldOf(name), "Please tell us your name."); ok = false; }
      if (!email.value.trim()) { setError(fieldOf(email), "We need an email to reach you."); ok = false; }
      else if (!emailRe.test(email.value.trim())) { setError(fieldOf(email), "That email looks off — mind checking?"); ok = false; }
      if (!attending) { setError(attendingField, "Let us know if you can make it."); ok = false; }

      if (!ok) {
        const firstErr = $(".has-error", form);
        if (firstErr) firstErr.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      // "Submit" — here we just simulate success. Wire this up to your
      // backend / Google Form / Formspree endpoint as needed.
      const data = Object.fromEntries(new FormData(form).entries());
      console.log("RSVP submitted:", data);

      const firstName = data.name.trim().split(/\s+/)[0];
      const nameSpan = $("#successName");
      const msg = $("#successMsg");
      if (nameSpan) nameSpan.textContent = firstName;
      if (msg) {
        msg.textContent = data.attending === "yes"
          ? "Your RSVP is in. We can't wait to celebrate with you!"
          : "We'll miss you dearly — thank you for letting us know.";
      }
      if (success) {
        success.classList.add("is-visible");
        success.setAttribute("aria-hidden", "false");
      }
    });

    const reset = $("#rsvpReset");
    if (reset) reset.addEventListener("click", () => {
      success.classList.remove("is-visible");
      success.setAttribute("aria-hidden", "true");
    });
  }

  /* ==========================================================
     13 · ACTIVE section highlight (nav + tabbar) via observer
     ========================================================== */
  function initScrollSpy() {
    const sections = $$("main section[id]");
    const navLinks = $$(".nav__link");
    const tabs = $$("[data-tab]");
    if (!sections.length) return;

    const setActive = (id) => {
      navLinks.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === "#" + id));
      tabs.forEach((t) => t.classList.toggle("is-active", t.getAttribute("href") === "#" + id));
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { threshold: 0.35, rootMargin: "-20% 0px -40% 0px" });
    sections.forEach((s) => io.observe(s));
  }

  /* ==========================================================
     14 · Smooth-scroll for in-page anchors (offset for header)
     ========================================================== */
  function initAnchors() {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const y = target.getBoundingClientRect().top + window.scrollY - (id === "#home" ? 0 : 10);
        window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  /* ==========================================================
     BOOT
     ========================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    initPreloader();
    initSplitText();
    initCursor();
    initHeader();
    initMenu();
    initReveal();
    initParallax();
    initStoryScroll();
    initCountdown();
    initTilt();
    initLightbox();
    initFaq();
    initRsvp();
    initScrollSpy();
    initAnchors();
  });
})();
