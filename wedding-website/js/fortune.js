/* =============================================================
   fortune.js · "Wedding Fortune Teller" mini-feature
   Self-contained: does nothing unless #fortune exists on the
   page. Vanilla JS, no dependencies, no network calls.

   The fun trick here is that the fortune is deterministic — the
   same name + side always produces the same reading, so guests
   can compare notes ("wait, you also got 46 gulab jamuns?!")
   without us storing anything anywhere.
   ============================================================= */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    var root = document.getElementById("fortune");
    if (!root) return; // this page doesn't have the fortune teller — bail quietly

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var form = root.querySelector("#fortuneForm");
    var box = root.querySelector("#fortuneBox");
    var orbWrap = root.querySelector("#fortuneOrbWrap");
    var nameField = root.querySelector("#fortuneName");
    var nameFieldWrap = nameField ? nameField.closest(".fortune__field") : null;
    var card = root.querySelector("#fortuneCard");
    var cardHeader = root.querySelector("#fortuneCardHeader");
    var cardBody = root.querySelector("#fortuneCardBody");
    var copyBtn = root.querySelector("#fortuneCopyBtn");
    var resetBtn = root.querySelector("#fortuneResetBtn");
    var copiedMsg = root.querySelector("#fortuneCopiedMsg");

    if (!form || !box) return;

    var lastFortuneText = ""; // kept around so the Copy button has something to grab

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var rawName = nameField ? nameField.value : "";
      if (!rawName.trim()) {
        nudgeNameField();
        return;
      }

      var side = getSelectedSide(form);
      var fortune = buildFortune(rawName, side);

      revealFortune(fortune);
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        box.classList.remove("is-revealed");
        if (card) card.classList.remove("is-visible");
        if (copiedMsg) copiedMsg.classList.remove("is-visible");
        if (nameField) nameField.focus();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        copyToClipboard(lastFortuneText, function () {
          if (!copiedMsg) return;
          copiedMsg.classList.add("is-visible");
          window.clearTimeout(copyBtn._copiedTimer);
          copyBtn._copiedTimer = window.setTimeout(function () {
            copiedMsg.classList.remove("is-visible");
          }, 1800);
        });
      });
    }

    // clear the gentle nudge as soon as the guest starts typing
    if (nameField) {
      nameField.addEventListener("input", function () {
        if (nameFieldWrap) nameFieldWrap.classList.remove("is-nudged");
      });
    }

    function nudgeNameField() {
      if (!nameFieldWrap) return;
      nameFieldWrap.classList.remove("is-nudged");
      // re-trigger the wiggle even if it was just shown
      void nameFieldWrap.offsetWidth;
      nameFieldWrap.classList.add("is-nudged");
      if (nameField) nameField.focus();
    }

    function revealFortune(fortune) {
      lastFortuneText = fortune.header + "\n\n" + fortune.lines.join("\n");

      var finish = function () {
        if (cardHeader) cardHeader.textContent = fortune.header;
        if (cardBody) {
          cardBody.innerHTML = "";
          fortune.lines.forEach(function (line) {
            var p = document.createElement("p");
            p.className = "fortune__line";
            p.textContent = line;
            cardBody.appendChild(p);
          });
        }
        box.classList.add("is-revealed");
        if (copiedMsg) copiedMsg.classList.remove("is-visible");
        // little re-trigger so the card fades/rises in even on a second reading
        if (card) {
          card.classList.remove("is-visible");
          void card.offsetWidth;
          card.classList.add("is-visible");
        }
        // optional confetti hook — only fire if the host page actually wired one up
        if (window.WED && typeof window.WED.confetti === "function") {
          try { window.WED.confetti(); } catch (err) { /* never let a bad confetti hook break the reveal */ }
        }
      };

      if (reduceMotion || !orbWrap) {
        finish();
        return;
      }

      // let the ball swirl for a beat before the card appears — matches the
      // 1.1s "casting" animation defined in fortune.css
      orbWrap.classList.add("is-casting");
      window.setTimeout(function () {
        orbWrap.classList.remove("is-casting");
        finish();
      }, 900);
    }

    function getSelectedSide(form) {
      var checked = form.querySelector('input[name="side"]:checked');
      return checked ? checked.value : "friend";
    }
  }

  /* ==========================================================
     Deterministic PRNG
     xmur3 turns an arbitrary string into a 32-bit seed; mulberry32
     turns that seed into a fast, decent-quality stream of floats.
     Together they mean "vaibhav|friend" always yields the exact
     same fortune, forever, with zero storage required.
     ========================================================== */
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

  /* ==========================================================
     Fortune content
     ========================================================== */
  function buildFortune(rawName, side) {
    var name = titleCase(rawName.trim());
    var seed = xmur3(rawName.trim().toLowerCase() + "|" + side)();
    var rand = mulberry32(seed);

    var randInt = function (min, max) {
      return Math.floor(rand() * (max - min + 1)) + min;
    };
    var pick = function (arr) {
      return arr[Math.floor(rand() * arr.length)];
    };

    var openers = [
      function () { return "Gaze into the mist, " + name + " — the ball has seen your night at Vaibhav & Nishita's wedding."; },
      function () { return "Ah, " + name + ". The crystal stirs. It has something to tell you about December 10th."; },
      function () { return "The fog parts for you, " + name + ". Here is what Lucknow has in store."; },
      function () { return name + ", the oracle has been waiting for you. Sit closer to the glass."; }
    ];

    // Predictions anyone might get, regardless of which side they're on.
    var genericLines = [
      function () { return "You will dance at " + randInt(2, 5) + " sangeets and confidently fake the steps to every single one."; },
      function () { return "You are fated to eat exactly " + randInt(28, 72) + " gulab jamuns across the weekend, and regret none of them."; },
      function () { return "You will accidentally photobomb " + randInt(6, 19) + " strangers' wedding photos, and look great in all of them."; },
      function () { return "There is a " + randInt(60, 99) + "% chance you cry during the vows, no matter how tough you think you are."; },
      function () { return "You will misplace your phone " + randInt(1, 3) + " time(s) before the reception ends, and find it in your own pocket each time."; },
      function () { return "Exactly " + randInt(3, 8) + " people will ask if you're single at the sangeet. Choose your answers wisely."; }
    ];

    // At least one of these gets used, keyed to the side the guest picked.
    var sideLines = {
      bride: [
        function () { return "As part of Team Nishita, you will out-dance the groom's side by a solid " + randInt(10, 40) + "% margin, and everyone will see it happen."; },
        function () { return "You have been quietly deputised to guard Nishita's shoes — the joota chupai ransom will not settle for less than ₹" + randInt(21, 75) + ",000."; },
        function () { return "You will spend " + randInt(2, 4) + " hour(s) negotiating shoe-ransom terms with the groom's men, and enjoy every second of it."; }
      ],
      groom: [
        function () { return "As part of Team Vaibhav, you'll be personally responsible for guarding his shoes — brace for a ransom war worth ₹" + randInt(21, 75) + ",000."; },
        function () { return "You will hype Vaibhav so hard during the baraat that your voice gives out by hour " + randInt(1, 3) + "."; },
        function () { return "Baraat energy reading: " + randInt(85, 100) + "%. You will be seen dancing somewhere you shouldn't, at least once."; }
      ],
      friend: [
        function () { return "You will be roped into a surprise group dance with exactly " + randInt(1, 3) + " day(s) of rehearsal notice."; },
        function () { return "You are, canonically, the friend with the aux cord — expect it thrust into your hands " + randInt(2, 5) + " times against your will."; },
        function () { return "Someone will ask you to 'say a few words' with zero warning. You will somehow nail it in front of " + randInt(50, 200) + " people."; }
      ],
      family: [
        function () { return "You will be asked \"beta, when are YOU getting married?\" exactly " + randInt(3, 9) + " times."; },
        function () { return "A distant relative will attempt to set you up with someone at this very wedding — count on at least " + randInt(1, 2) + " attempt(s)."; },
        function () { return "You will be recruited into " + randInt(12, 30) + " family photos, roughly half of which you didn't know were happening."; }
      ]
    };

    var closings = [
      function () { return "Whatever else happens, " + name + ", save room on the dance floor — this one's going to be good."; },
      function () { return "However the night unfolds, " + name + ", you're exactly the kind of guest who turns a wedding into a celebration."; },
      function () { return "One thing is certain, " + name + ": you were made for nights like this one."; },
      function () { return "In the end, " + name + ", all that really matters is that you're there — everything else is just gold dust."; }
    ];

    var sidePool = sideLines[side] || sideLines.friend;

    var lines = [
      pick(openers)(),
      pick(genericLines)(),
      pick(sidePool)(),
      pick(closings)()
    ];

    return {
      header: name + "'s 2027 prophecy",
      lines: lines
    };
  }

  /* ==========================================================
     Small helpers
     ========================================================== */
  function titleCase(str) {
    return str.replace(/\S+/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  function copyToClipboard(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone, function () {
        legacyCopy(text, onDone);
      });
    } else {
      legacyCopy(text, onDone);
    }
  }

  // Fallback for browsers (or contexts) without the async Clipboard API
  function legacyCopy(text, onDone) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.setAttribute("aria-hidden", "true");
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      /* clipboard just isn't available here — silently skip the confirmation */
    }
    document.body.removeChild(ta);
    if (onDone) onDone();
  }
})();
