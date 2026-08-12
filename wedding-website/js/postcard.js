/* =============================================================
   postcard.js · "Save-the-Date Postcard Studio"
   Self-contained: does nothing unless #postcard exists on the
   page. Vanilla JS, no dependencies, no network calls, no images.

   The guest types a greeting + their name, picks a colour palette
   and a stamp motif, toggles the gold-foil sparkle, and watches a
   vintage "Greetings from Lucknow" postcard redraw live on a
   canvas — then downloads it as a high-res PNG keepsake. Every
   pixel is drawn procedurally, so there's nothing to load and
   nothing to break. If the browser can't give us a 2D context we
   relax gracefully and let the fallback message show.
   ============================================================= */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  /* Only the :root tokens from style.css — the palettes below are
     built from these, and the couple of tints/shades we need are
     derived at runtime with shade()/rgba(), never hand-picked. */
  var T = {
    cream: "#fbf7f0", cream2: "#f4ece0",
    ink: "#2b2622", inkSoft: "#5c534b",
    gold: "#c39b52", goldDeep: "#a67c33", goldLight: "#e6cf9c",
    blush: "#e7c9bd", terracotta: "#b5623f", sage: "#8a9a7b", charcoal: "#1c1916"
  };

  /* Palette presets. Each one is a set of roles the renderer reads;
     `dark` flips a couple of texture decisions for the night card. */
  var PALETTES = [
    {
      id: "golden", name: "Golden Hour",
      mat: shade(T.terracotta, -0.5), paper: T.cream, paper2: T.cream2,
      frame: T.goldDeep, frameInner: T.gold, ink: T.ink, sub: T.inkSoft,
      headline: T.terracotta, stamp: T.terracotta, stampBg: shade(T.cream, -0.02),
      motif: T.terracotta, accent: T.goldDeep
    },
    {
      id: "pichola", name: "Twilight Blue",
      mat: "#000000", paper: T.charcoal, paper2: shade(T.charcoal, 0.14),
      frame: T.goldLight, frameInner: T.gold, ink: T.cream, sub: shade(T.goldLight, -0.02),
      headline: T.goldLight, stamp: T.goldLight, stampBg: shade(T.charcoal, 0.22),
      motif: T.goldLight, accent: T.gold, dark: true
    },
    {
      id: "marigold", name: "Marigold",
      mat: shade(T.sage, -0.45), paper: shade(T.cream2, 0.01), paper2: shade(T.goldLight, 0.28),
      frame: T.goldDeep, frameInner: T.terracotta, ink: T.ink, sub: T.inkSoft,
      headline: T.terracotta, stamp: T.sage, stampBg: shade(T.cream, -0.01),
      motif: T.sage, accent: T.goldDeep
    },
    {
      id: "rose", name: "Rose Quartz",
      mat: shade(T.blush, -0.4), paper: shade(T.blush, 0.55), paper2: shade(T.blush, 0.4),
      frame: T.gold, frameInner: T.goldLight, ink: T.ink, sub: T.inkSoft,
      headline: T.terracotta, stamp: T.terracotta, stampBg: shade(T.blush, 0.62),
      motif: T.terracotta, accent: T.gold
    }
  ];

  var MOTIFS = [
    { id: "palace", name: "Palace" },
    { id: "lantern", name: "Lantern" },
    { id: "peacock", name: "Peacock" },
    { id: "sun", name: "Sun over Water" }
  ];

  var GREETINGS = [
    "Wish you were here for every golden moment.",
    "Come dance with us under the Awadhi sky.",
    "Save the date — Lucknow is waiting for you.",
    "Two hearts, one city of nawabs, and a whole lot of love.",
    "Pack your dancing shoes. We'll save you a seat.",
    "Meet us under the December sun in Lucknow.",
    "Golden hour, forever after. See you there.",
    "From our city of nawabs to you, with love."
  ];
  var NAMES = ["with all our love", "your favourite guest", "a friend of V & N", "see you soon", "yours, always"];

  var MAX_GREETING = 90;

  function init() {
    var root = document.getElementById("postcard");
    if (!root) return; // no studio on this page — bail quietly

    var canvas = root.querySelector("#postcardCanvas");
    var greetingEl = root.querySelector("#postcardGreeting");
    var nameEl = root.querySelector("#postcardName");
    var swatchWrap = root.querySelector("#postcardSwatches");
    var chipWrap = root.querySelector("#postcardChips");
    var sparkleEl = root.querySelector("#postcardSparkle");
    var footEl = root.querySelector("#postcardGreetingFoot");
    var metaEl = root.querySelector("#postcardMeta");
    var downloadBtn = root.querySelector("#postcardDownload");
    var surpriseBtn = root.querySelector("#postcardSurprise");

    if (!canvas) return;

    var ctx = null;
    try { ctx = canvas.getContext("2d"); } catch (e) { ctx = null; }
    if (!ctx) {
      // no 2D context anywhere — show the fallback and leave the rest of the page alone
      root.classList.add("postcard--no-canvas");
      return;
    }

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Build the palette + motif controls so the JS owns its own DOM.
    buildSwatches(swatchWrap);
    buildChips(chipWrap);

    var state = {
      greeting: greetingEl ? greetingEl.value.trim() : "",
      name: nameEl ? nameEl.value.trim() : "",
      palette: PALETTES[0],
      motif: MOTIFS[0],
      sparkle: sparkleEl ? !!sparkleEl.checked : false
    };
    // seed the greeting so the very first render already looks composed
    if (greetingEl && !state.greeting) {
      greetingEl.value = GREETINGS[0];
      state.greeting = GREETINGS[0];
    }

    var W = 0, H = 0;

    /* Size the backing store to the displayed box × devicePixelRatio
       (never below 2×, so the exported PNG stays crisp on any screen)
       and draw in logical CSS-pixel coordinates. */
    function fit() {
      var box = canvas.parentNode;
      var cssW = (box && box.clientWidth) || canvas.clientWidth || 600;
      var cssH = Math.round(cssW * 2 / 3); // classic 3:2 landscape postcard
      var dpr = Math.max(2, Math.min(window.devicePixelRatio || 1, 3));
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      W = cssW; H = cssH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var scheduled = false;
    function requestRender() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        render();
      });
    }

    function render() {
      fit();
      drawPostcard(ctx, W, H, state);
      updateCounter();
      updateAria();
    }

    // ---- control wiring -------------------------------------------------
    if (greetingEl) {
      greetingEl.addEventListener("input", function () {
        var v = greetingEl.value;
        if (v.length > MAX_GREETING) {
          v = v.slice(0, MAX_GREETING);
          greetingEl.value = v;
        }
        state.greeting = v.trim();
        requestRender();
      });
    }

    if (nameEl) {
      nameEl.addEventListener("input", function () {
        state.name = nameEl.value.trim();
        requestRender();
      });
    }

    if (swatchWrap) {
      swatchWrap.addEventListener("change", function (e) {
        var input = e.target.closest("input[name='postcardPalette']");
        if (!input) return;
        state.palette = paletteById(input.value);
        requestRender();
      });
    }

    if (chipWrap) {
      chipWrap.addEventListener("change", function (e) {
        var input = e.target.closest("input[name='postcardMotif']");
        if (!input) return;
        state.motif = motifById(input.value);
        requestRender();
      });
    }

    if (sparkleEl) {
      sparkleEl.addEventListener("change", function () {
        state.sparkle = !!sparkleEl.checked;
        requestRender();
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener("click", function () {
        download();
      });
    }

    if (surpriseBtn) {
      surpriseBtn.addEventListener("click", function () {
        surprise();
      });
    }

    // redraw on resize so the relative layout re-measures cleanly
    var resizeTimer;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(requestRender, 150);
    });

    // first paint now, then again once the webfonts land (Cormorant/Jost)
    render();
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
      document.fonts.ready.then(requestRender).catch(function () {});
    }

    // ---- actions --------------------------------------------------------
    function download() {
      var url;
      try {
        url = canvas.toDataURL("image/png");
      } catch (err) {
        return; // tainted canvas shouldn't ever happen here (no external images), but never throw
      }
      var a = document.createElement("a");
      a.href = url;
      a.download = "lucknow-save-the-date.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (window.WED && typeof window.WED.confetti === "function") {
        try { window.WED.confetti({ count: 90 }); } catch (e) { /* confetti is a nice-to-have */ }
      }
    }

    function surprise() {
      var g = pick(GREETINGS);
      var pal = pick(PALETTES);
      var mot = pick(MOTIFS);

      state.greeting = g;
      state.palette = pal;
      state.motif = mot;

      if (greetingEl) greetingEl.value = g;
      if (nameEl && !state.name) {
        state.name = pick(NAMES);
        nameEl.value = state.name;
      }
      checkInput(swatchWrap, "postcardPalette", pal.id);
      checkInput(chipWrap, "postcardMotif", mot.id);

      requestRender();
    }

    // ---- small view helpers --------------------------------------------
    function updateCounter() {
      if (!footEl) return;
      var n = state.greeting.length;
      footEl.innerHTML = "";
      var strong = document.createElement("strong");
      strong.textContent = String(n);
      footEl.appendChild(strong);
      footEl.appendChild(document.createTextNode(" / " + MAX_GREETING + " characters"));
      footEl.classList.toggle("is-near-limit", n >= MAX_GREETING - 12);
      if (metaEl) metaEl.textContent = state.palette.name + " · " + state.motif.name;
    }

    function updateAria() {
      var parts = ["A save-the-date postcard reading “Greetings from Lucknow.”"];
      if (state.greeting) parts.push("Message: " + state.greeting);
      if (state.name) parts.push("Signed " + state.name + ".");
      parts.push(state.palette.name + " palette with a " + state.motif.name.toLowerCase() + " stamp,");
      parts.push("dated the 10th of December 2026.");
      canvas.setAttribute("aria-label", parts.join(" "));
    }
  }

  /* ==========================================================
     Control builders
     ========================================================== */
  function buildSwatches(wrap) {
    if (!wrap) return;
    wrap.innerHTML = "";
    PALETTES.forEach(function (p, i) {
      var label = document.createElement("label");
      label.className = "postcard__swatch";

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "postcardPalette";
      input.value = p.id;
      if (i === 0) input.checked = true;

      var span = document.createElement("span");
      var dot = document.createElement("span");
      dot.className = "postcard__swatch-dot";
      dot.style.background = "linear-gradient(135deg, " + p.paper + " 0 45%, " + p.accent + " 45% 72%, " + p.headline + " 72% 100%)";
      dot.setAttribute("aria-hidden", "true");
      span.appendChild(dot);
      span.appendChild(document.createTextNode(p.name));

      label.appendChild(input);
      label.appendChild(span);
      wrap.appendChild(label);
    });
  }

  function buildChips(wrap) {
    if (!wrap) return;
    wrap.innerHTML = "";
    MOTIFS.forEach(function (m, i) {
      var label = document.createElement("label");
      label.className = "postcard__chip";

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "postcardMotif";
      input.value = m.id;
      if (i === 0) input.checked = true;

      var span = document.createElement("span");
      span.textContent = m.name;

      label.appendChild(input);
      label.appendChild(span);
      wrap.appendChild(label);
    });
  }

  function checkInput(wrap, name, value) {
    if (!wrap) return;
    var input = wrap.querySelector("input[name='" + name + "'][value='" + value + "']");
    if (input) input.checked = true;
  }

  function paletteById(id) {
    for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) return PALETTES[i];
    return PALETTES[0];
  }
  function motifById(id) {
    for (var i = 0; i < MOTIFS.length; i++) if (MOTIFS[i].id === id) return MOTIFS[i];
    return MOTIFS[0];
  }

  /* ==========================================================
     The postcard renderer
     ========================================================== */
  function drawPostcard(ctx, W, H, state) {
    var P = state.palette;

    ctx.clearRect(0, 0, W, H);

    // mat / backdrop behind the card so the exported PNG has a tidy edge
    ctx.fillStyle = P.mat;
    ctx.fillRect(0, 0, W, H);

    // ---- paper ----
    var pad = Math.round(W * 0.045);
    var px = pad, py = pad, pw = W - pad * 2, ph = H - pad * 2;
    var pr = W * 0.02;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = W * 0.02;
    ctx.shadowOffsetY = H * 0.012;
    var grad = ctx.createLinearGradient(px, py, px, py + ph);
    grad.addColorStop(0, P.paper2);
    grad.addColorStop(0.55, P.paper);
    grad.addColorStop(1, P.paper2);
    ctx.fillStyle = grad;
    roundRect(ctx, px, py, pw, ph, pr);
    ctx.fill();
    ctx.restore();

    // clip everything else to the paper so speckle/ink never bleed out
    ctx.save();
    roundRect(ctx, px, py, pw, ph, pr);
    ctx.clip();

    drawSpeckle(ctx, px, py, pw, ph, P);
    // warm vignette in a corner for a sun-faded, aged feel
    var vg = ctx.createRadialGradient(px + pw, py, pw * 0.05, px + pw, py, pw * 0.9);
    vg.addColorStop(0, rgba(P.accent, P.dark ? 0.14 : 0.1));
    vg.addColorStop(1, rgba(P.accent, 0));
    ctx.fillStyle = vg;
    ctx.fillRect(px, py, pw, ph);

    // ---- double gold frame ----
    var f1 = W * 0.028;
    ctx.strokeStyle = P.frame;
    ctx.lineWidth = Math.max(1.5, W * 0.004);
    strokeRoundRect(ctx, px + f1, py + f1, pw - f1 * 2, ph - f1 * 2, pr * 0.6);
    var f2 = f1 + W * 0.012;
    ctx.strokeStyle = P.frameInner;
    ctx.lineWidth = Math.max(1, W * 0.0018);
    strokeRoundRect(ctx, px + f2, py + f2, pw - f2 * 2, ph - f2 * 2, pr * 0.45);

    // inner content box
    var ix = px + f2 + W * 0.02;
    var iy = py + f2 + H * 0.02;
    var iw = pw - (f2 + W * 0.02) * 2;
    var ih = ph - (f2 + H * 0.02) * 2;

    // split: left = the greeting, right = the correspondence / stamp side
    var splitX = ix + iw * 0.62;

    // faint divider
    ctx.strokeStyle = rgba(P.ink, P.dark ? 0.18 : 0.12);
    ctx.lineWidth = Math.max(1, W * 0.0016);
    dashedLine(ctx, splitX, iy + ih * 0.06, splitX, iy + ih * 0.94, W * 0.012, W * 0.008);

    drawLeft(ctx, ix, iy, splitX - ix - iw * 0.03, ih, state);
    drawRight(ctx, splitX + iw * 0.04, iy, ix + iw - (splitX + iw * 0.04), ih, state);

    if (state.sparkle) drawSparkle(ctx, px, py, pw, ph, P);

    ctx.restore();
  }

  function drawLeft(ctx, x, y, w, h, state) {
    var P = state.palette;

    // eyebrow — GREETINGS FROM
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = P.sub;
    var ebSize = Math.max(9, h * 0.062);
    ctx.font = "500 " + ebSize + "px " + SANS;
    drawTracked(ctx, "GREETINGS FROM", x, y + h * 0.13, ebSize * 0.28);

    // LUCKNOW — the hero word
    ctx.fillStyle = P.headline;
    var hy = y + h * 0.34;
    var hSize = fitFont(ctx, "LUCKNOW", "700", SERIF, w, h * 0.24, h * 0.1);
    ctx.font = "700 " + hSize + "px " + SERIF;
    drawTracked(ctx, "LUCKNOW", x, hy, hSize * 0.02);

    // little gold rule under the headline
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = Math.max(1.5, h * 0.008);
    line(ctx, x, hy + h * 0.05, x + w * 0.5, hy + h * 0.05);

    // greeting message — wrapped italic serif, auto-fitted to 3 lines
    var msg = state.greeting || "Write your note on the right…";
    ctx.fillStyle = P.ink;
    var para = fitParagraph(ctx, msg, "400", SERIF, true, w, h * 0.28, h * 0.105, h * 0.06, 3);
    ctx.font = "italic 400 " + para.size + "px " + SERIF;
    var my = y + h * 0.52;
    para.lines.forEach(function (ln, i) {
      ctx.fillText(ln, x, my + i * para.lineHeight);
    });

    // signature line
    var sigY = y + h * 0.9;
    ctx.strokeStyle = rgba(P.ink, 0.28);
    ctx.lineWidth = Math.max(1, h * 0.004);
    var sig = state.name ? "— " + state.name : "— your name here";
    ctx.fillStyle = state.name ? P.ink : rgba(P.ink, 0.45);
    var sigSize = Math.max(11, h * 0.085);
    ctx.font = "italic 500 " + sigSize + "px " + SERIF;
    ctx.fillText(sig, x, sigY);
  }

  function drawRight(ctx, x, y, w, h, state) {
    var P = state.palette;

    // stamp, tucked into the top-right
    var sw = w * 0.62;
    var sh = sw * 1.22;
    var sx = x + w - sw;
    var sy = y + h * 0.02;
    drawStamp(ctx, sx, sy, sw, sh, state);

    // postmark, overlapping the stamp's lower-left like a real cancel mark
    var pmR = sw * 0.62;
    var pmX = sx - pmR * 0.18;
    var pmY = sy + sh * 0.78;
    drawPostmark(ctx, pmX, pmY, pmR, P);

    // correspondence: a "TO" tag + a few ruled address lines
    var ry = y + h * 0.6;
    ctx.textAlign = "left";
    ctx.fillStyle = P.sub;
    var tagSize = Math.max(8, h * 0.05);
    ctx.font = "500 " + tagSize + "px " + SANS;
    drawTracked(ctx, "TO A DEAR FRIEND", x, ry, tagSize * 0.22);

    ctx.strokeStyle = rgba(P.ink, P.dark ? 0.22 : 0.16);
    ctx.lineWidth = Math.max(1, h * 0.004);
    var lines = 4;
    var gap = h * 0.088;
    for (var i = 0; i < lines; i++) {
      var ly = ry + h * 0.06 + i * gap;
      var lw = i === lines - 1 ? w * 0.6 : w;
      line(ctx, x, ly, x + lw, ly);
    }

    // monogram + date, sitting at the very bottom of the card
    var by = y + h * 0.985;
    drawMonogram(ctx, x, by, h, P);
    ctx.textAlign = "right";
    ctx.fillStyle = P.sub;
    var dSize = Math.max(8, h * 0.05);
    ctx.font = "500 " + dSize + "px " + SANS;
    drawTrackedRight(ctx, "10 · 12 · 2026 · LUCKNOW", x + w, by - h * 0.005, dSize * 0.16);
    ctx.textAlign = "left";
  }

  /* ---- the postage stamp (scalloped edge + motif) ---- */
  function drawStamp(ctx, x, y, w, h, state) {
    var P = state.palette;
    var teethX = 9, teethY = 11;
    var tooth = w / teethX;

    ctx.save();
    // scalloped silhouette as a clip, so the fill + motif share the shape
    scallopPath(ctx, x, y, w, h, teethX, teethY, tooth * 0.5);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = w * 0.05;
    ctx.shadowOffsetY = h * 0.015;
    ctx.fillStyle = P.stampBg;
    ctx.fill();
    ctx.restore();
    ctx.clip();

    // inner keyline
    var pad = w * 0.1;
    ctx.strokeStyle = rgba(P.stamp, 0.7);
    ctx.lineWidth = Math.max(1, w * 0.02);
    strokeRoundRect(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, w * 0.04);

    // motif art fills the upper portion
    drawMotif(ctx, state.motif.id, x + pad * 1.4, y + pad * 1.4, w - pad * 2.8, (h - pad * 2) * 0.66, P);

    // denomination-ish caption
    ctx.textAlign = "center";
    ctx.fillStyle = P.stamp;
    var cSize = Math.max(6, w * 0.11);
    ctx.font = "600 " + cSize + "px " + SANS;
    drawTrackedCenter(ctx, "LUCKNOW", x + w / 2, y + h - pad * 1.5, cSize * 0.18);
    ctx.font = "italic 400 " + (cSize * 1.15) + "px " + SERIF;
    ctx.fillText("Uttar Pradesh", x + w / 2, y + h - pad * 0.6);
    ctx.textAlign = "left";
    ctx.restore();
  }

  /* ---- motif line-art, drawn into a unit box (x,y,w,h) ---- */
  function drawMotif(ctx, id, x, y, w, h, P) {
    ctx.save();
    ctx.strokeStyle = P.motif;
    ctx.fillStyle = P.motif;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, w * 0.03);
    var cx = x + w / 2, cy = y + h / 2;

    if (id === "palace") {
      // Awadhi-style domed palace silhouette on water
      var baseY = y + h * 0.78;
      ctx.beginPath();
      // waterline
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + w, baseY);
      ctx.stroke();
      // main block
      ctx.beginPath();
      ctx.rect(x + w * 0.24, y + h * 0.4, w * 0.52, baseY - (y + h * 0.4));
      ctx.stroke();
      // central dome
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.4, w * 0.14, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.26);
      ctx.lineTo(cx, y + h * 0.16);
      ctx.stroke();
      // flanking towers
      [0.14, 0.86].forEach(function (fx) {
        var tx = x + w * fx;
        ctx.beginPath();
        ctx.rect(tx - w * 0.06, y + h * 0.34, w * 0.12, baseY - (y + h * 0.34));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tx, y + h * 0.34, w * 0.06, Math.PI, 0);
        ctx.stroke();
      });
      // reflection ripples
      ctx.beginPath();
      for (var r = 0; r < 3; r++) {
        var yy = baseY + h * (0.07 + r * 0.06);
        ctx.moveTo(x + w * 0.2, yy);
        ctx.lineTo(x + w * 0.8, yy);
      }
      ctx.stroke();
    } else if (id === "lantern") {
      // hanging festival lantern
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.02);
      ctx.lineTo(cx, y + h * 0.14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.14, y + h * 0.16);
      ctx.lineTo(cx + w * 0.14, y + h * 0.16);
      ctx.stroke();
      // body
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.2, y + h * 0.34);
      ctx.quadraticCurveTo(cx - w * 0.28, cy, cx - w * 0.2, y + h * 0.7);
      ctx.lineTo(cx + w * 0.2, y + h * 0.7);
      ctx.quadraticCurveTo(cx + w * 0.28, cy, cx + w * 0.2, y + h * 0.34);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.34, w * 0.2, h * 0.05, 0, 0, Math.PI * 2);
      ctx.stroke();
      // ribs
      [cx - w * 0.07, cx + w * 0.07].forEach(function (rx) {
        ctx.beginPath();
        ctx.moveTo(rx, y + h * 0.36);
        ctx.lineTo(rx, y + h * 0.68);
        ctx.stroke();
      });
      // tassel
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.7);
      ctx.lineTo(cx, y + h * 0.86);
      ctx.stroke();
    } else if (id === "peacock") {
      // stylised peacock — body arc + fanned plumes
      ctx.beginPath();
      ctx.arc(x + w * 0.34, cy + h * 0.12, w * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      // neck + head
      ctx.beginPath();
      ctx.moveTo(x + w * 0.34, cy + h * 0.02);
      ctx.quadraticCurveTo(x + w * 0.24, y + h * 0.2, x + w * 0.34, y + h * 0.16);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + w * 0.34, y + h * 0.14, w * 0.04, 0, Math.PI * 2);
      ctx.stroke();
      // crest
      ctx.beginPath();
      ctx.moveTo(x + w * 0.34, y + h * 0.1);
      ctx.lineTo(x + w * 0.34, y + h * 0.03);
      ctx.stroke();
      // fanned tail feathers
      var fx = x + w * 0.42, fy = cy + h * 0.14;
      for (var a = -2; a <= 2; a++) {
        var ang = -0.2 + a * 0.32;
        var ex = fx + Math.cos(ang) * w * 0.5;
        var ey = fy - Math.sin(ang) * h * 0.5;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo(fx + Math.cos(ang) * w * 0.28, fy - Math.sin(ang) * h * 0.34 - h * 0.05, ex, ey);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ex, ey, w * 0.035, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // sun over water
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.42, h * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      // rays
      for (var i = 0; i < 12; i++) {
        var ra = (i / 12) * Math.PI * 2;
        var r1 = h * 0.3, r2 = h * 0.42;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ra) * r1, y + h * 0.42 + Math.sin(ra) * r1);
        ctx.lineTo(cx + Math.cos(ra) * r2, y + h * 0.42 + Math.sin(ra) * r2);
        ctx.stroke();
      }
      // water ripples
      for (var k = 0; k < 3; k++) {
        var wy = y + h * (0.74 + k * 0.09);
        ctx.beginPath();
        ctx.moveTo(x + w * 0.08, wy);
        for (var t = 0; t <= 1.001; t += 0.25) {
          var wx = x + w * 0.08 + t * w * 0.84;
          ctx.quadraticCurveTo(wx + w * 0.06, wy + (t % 0.5 === 0 ? -h * 0.03 : h * 0.03), wx + w * 0.12, wy);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---- circular postmark with text around the ring ---- */
  function drawPostmark(ctx, cx, cy, r, P) {
    ctx.save();
    ctx.globalAlpha = P.dark ? 0.6 : 0.5;
    ctx.strokeStyle = P.stamp;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    arcText(ctx, "LUCKNOW · UTTAR PRADESH", cx, cy, r * 0.86, -Math.PI, 0, false, r * 0.2, P.stamp);
    arcText(ctx, "10 DEC 2026", cx, cy, r * 0.86, Math.PI * 0.75, Math.PI * 0.25, true, r * 0.2, P.stamp);

    // wavy cancellation lines through the centre
    ctx.lineWidth = Math.max(1, r * 0.03);
    for (var i = -1; i <= 1; i++) {
      var yy = cy + i * r * 0.16;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, yy);
      ctx.quadraticCurveTo(cx, yy - r * 0.12, cx + r * 0.5, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---- V & N monogram, an ampersand treatment ---- */
  function drawMonogram(ctx, x, baseline, h, P) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    var big = Math.max(14, h * 0.16);
    ctx.fillStyle = P.ink;
    ctx.font = "600 " + (big * 0.72) + "px " + SERIF;
    var v = "V";
    ctx.fillText(v, x, baseline);
    var vw = ctx.measureText(v).width;

    ctx.fillStyle = P.headline;
    ctx.font = "italic 500 " + (big * 1.15) + "px " + SCRIPT;
    var amp = "&";
    ctx.fillText(amp, x + vw + big * 0.06, baseline + big * 0.06);
    var aw = ctx.measureText(amp).width;

    ctx.fillStyle = P.ink;
    ctx.font = "600 " + (big * 0.72) + "px " + SERIF;
    ctx.fillText("N", x + vw + big * 0.12 + aw, baseline);
    ctx.restore();
  }

  /* ---- gold-foil sparkle (static; skipped for reduced motion by design) ---- */
  function drawSparkle(ctx, x, y, w, h, P) {
    // fixed positions so redraws don't make them jump around
    var pts = [
      [0.12, 0.2, 1], [0.3, 0.62, 0.7], [0.5, 0.14, 0.9], [0.68, 0.4, 0.6],
      [0.86, 0.24, 1], [0.2, 0.86, 0.75], [0.58, 0.82, 0.85], [0.92, 0.7, 0.7],
      [0.42, 0.44, 0.55], [0.76, 0.9, 0.6]
    ];
    ctx.save();
    ctx.fillStyle = P.frameInner;
    pts.forEach(function (p) {
      sparkleStar(ctx, x + w * p[0], y + h * p[1], (w * 0.014) * p[2]);
    });
    ctx.restore();
  }

  function sparkleStar(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.quadraticCurveTo(0, 0, 0, r);
    ctx.quadraticCurveTo(0, 0, -r, 0);
    ctx.quadraticCurveTo(0, 0, 0, -r);
    ctx.fill();
    ctx.restore();
  }

  /* ==========================================================
     Canvas / text utilities
     ========================================================== */
  var SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
  var SANS = '"Jost", "Helvetica Neue", Arial, sans-serif';
  var SCRIPT = '"Great Vibes", "Cormorant Garamond", cursive';

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function strokeRoundRect(ctx, x, y, w, h, r) {
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }
  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function dashedLine(ctx, x1, y1, x2, y2, dash, gap) {
    if (ctx.setLineDash) {
      ctx.save();
      ctx.setLineDash([dash, gap]);
      line(ctx, x1, y1, x2, y2);
      ctx.restore();
    } else {
      line(ctx, x1, y1, x2, y2);
    }
  }

  // draw text with manual letter-spacing (measureText per glyph)
  function drawTracked(ctx, text, x, y, spacing) {
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
  }
  function trackedWidth(ctx, text, spacing) {
    var w = 0;
    for (var i = 0; i < text.length; i++) w += ctx.measureText(text[i]).width + spacing;
    return w - spacing;
  }
  function drawTrackedRight(ctx, text, right, y, spacing) {
    var w = trackedWidth(ctx, text, spacing);
    var save = ctx.textAlign;
    ctx.textAlign = "left";
    drawTracked(ctx, text, right - w, y, spacing);
    ctx.textAlign = save;
  }
  function drawTrackedCenter(ctx, text, center, y, spacing) {
    var w = trackedWidth(ctx, text, spacing);
    var save = ctx.textAlign;
    ctx.textAlign = "left";
    drawTracked(ctx, text, center - w / 2, y, spacing);
    ctx.textAlign = save;
  }

  // shrink a single line's font until it fits maxWidth (down to minSize)
  function fitFont(ctx, text, weight, family, maxWidth, startSize, minSize) {
    var size = startSize;
    while (size > minSize) {
      ctx.font = weight + " " + size + "px " + family;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= Math.max(1, startSize * 0.03);
    }
    return size;
  }

  // wrap + fit a paragraph to a box, shrinking font until it fits maxLines
  function fitParagraph(ctx, text, weight, family, italic, maxWidth, maxHeight, startSize, minSize, maxLines) {
    var size = startSize;
    var prefix = (italic ? "italic " : "") + weight + " ";
    while (size >= minSize) {
      ctx.font = prefix + size + "px " + family;
      var lines = wrap(ctx, text, maxWidth);
      var lineHeight = size * 1.28;
      if (lines.length <= maxLines && lines.length * lineHeight <= maxHeight) {
        return { lines: lines, size: size, lineHeight: lineHeight };
      }
      size -= 1;
    }
    ctx.font = prefix + minSize + "px " + family;
    var finalLines = wrap(ctx, text, maxWidth).slice(0, maxLines);
    return { lines: finalLines, size: minSize, lineHeight: minSize * 1.28 };
  }

  function wrap(ctx, text, maxWidth) {
    var words = String(text).split(/\s+/);
    var lines = [];
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var test = current ? current + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = words[i];
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // text laid out along a circular arc, one glyph at a time
  function arcText(ctx, text, cx, cy, radius, startAngle, endAngle, flip, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = "600 " + size + "px " + SANS;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var n = text.length;
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      var ang = startAngle + (endAngle - startAngle) * t;
      ctx.save();
      ctx.translate(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
      ctx.rotate(ang + (flip ? -Math.PI / 2 : Math.PI / 2));
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // build the stamp perforation path (bumps out along each edge)
  function scallopPath(ctx, x, y, w, h, nx, ny, r) {
    ctx.beginPath();
    var i, cxp, cyp;
    var stepX = w / nx, stepY = h / ny;
    // top edge L→R
    for (i = 0; i < nx; i++) { cxp = x + stepX * (i + 0.5); ctx.arc(cxp, y, r, Math.PI, 0, false); }
    // right edge T→B
    for (i = 0; i < ny; i++) { cyp = y + stepY * (i + 0.5); ctx.arc(x + w, cyp, r, -Math.PI / 2, Math.PI / 2, false); }
    // bottom edge R→L
    for (i = 0; i < nx; i++) { cxp = x + w - stepX * (i + 0.5); ctx.arc(cxp, y + h, r, 0, Math.PI, false); }
    // left edge B→T
    for (i = 0; i < ny; i++) { cyp = y + h - stepY * (i + 0.5); ctx.arc(x, cyp, r, Math.PI / 2, Math.PI * 1.5, false); }
    ctx.closePath();
  }

  // fine paper speckle — many faint dots, seeded so it stays stable across redraws
  function drawSpeckle(ctx, x, y, w, h, P) {
    var rng = mulberry32(0x5a17ce);
    var count = Math.round((w * h) / 900);
    if (count > 1400) count = 1400;
    var dark = P.dark;
    ctx.save();
    for (var i = 0; i < count; i++) {
      var dx = x + rng() * w;
      var dy = y + rng() * h;
      var rr = rng() * 1.1 + 0.2;
      var a = (rng() * 0.05) + 0.015;
      ctx.fillStyle = dark ? "rgba(255,248,235," + a + ")" : "rgba(43,38,34," + a + ")";
      ctx.beginPath();
      ctx.arc(dx, dy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ==========================================================
     Colour helpers — derive tints/shades from the tokens only
     ========================================================== */
  function shade(hex, amt) {
    // amt > 0 lightens toward white, amt < 0 darkens toward black
    var c = hexToRgb(hex);
    var target = amt >= 0 ? 255 : 0;
    var f = Math.abs(amt);
    var r = Math.round(c.r + (target - c.r) * f);
    var g = Math.round(c.g + (target - c.g) * f);
    var b = Math.round(c.b + (target - c.b) * f);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
  }
  function hexToRgb(hex) {
    if (hex.charAt(0) !== "#") {
      // already rgb()/rgba() — pull the numbers back out
      var m = hex.match(/\d+/g) || [0, 0, 0];
      return { r: +m[0], g: +m[1], b: +m[2] };
    }
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  // deterministic PRNG for the speckle so it doesn't shimmer on every keystroke
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
})();
