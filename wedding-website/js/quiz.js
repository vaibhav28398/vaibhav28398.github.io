/* =============================================================
   quiz.js · "How well do you know the couple?" quiz
   Vanilla JS, no dependencies. Mirrors the pattern used in
   main.js: a self-contained IIFE that boots on DOMContentLoaded
   and quietly does nothing if the section isn't on the page.
   ============================================================= */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ==========================================================
     THE QUESTIONS
     Each entry: the prompt, its options, the index of the
     correct one, and a quip to show once it's been answered.
     ========================================================== */
  const QUESTIONS = [
    {
      q: "Who said “I love you” first?",
      options: ["Vaibhav", "Nishita", "They said it in the same breath"],
      correct: 0,
      quip: "He blurted it out mid-sentence and turned bright red."
    },
    {
      q: "Who takes longer to get ready before a night out?",
      options: ["Vaibhav", "Nishita", "Honestly, it's a tie"],
      correct: 1,
      quip: "In her defence, the results are always worth it."
    },
    {
      q: "Who's more likely to forget an anniversary?",
      options: ["Vaibhav", "Nishita", "Miso, probably"],
      correct: 0,
      quip: "Which is why there are now three calendar reminders."
    },
    {
      q: "Who got down on one knee?",
      options: ["Vaibhav", "Nishita", "They proposed to each other at once"],
      correct: 0,
      quip: "On a quiet evening by the Gomti. She said yes before he finished."
    },
    {
      q: "Where did they first meet?",
      options: ["A college lecture hall", "A rainy café in Bombay", "A mutual friend's wedding", "On a flight to Lucknow"],
      correct: 1,
      quip: "One umbrella, one missed last train, one great story."
    },
    {
      q: "What's their cat's name?",
      options: ["Mochi", "Miso", "Ladoo", "Chai"],
      correct: 1,
      quip: "Tiny, fluffy, and completely in charge of the household."
    },
    {
      q: "Which city is the wedding in?",
      options: ["Jaipur", "Lucknow", "Jodhpur", "Mumbai"],
      correct: 1,
      quip: "The city of nawabs, kebabs, and very good light."
    },
    {
      q: "Where was their first trip together?",
      options: ["Goa", "Himachal", "Kerala", "Ladakh"],
      correct: 1,
      quip: "Bad maps, big mountains, zero regrets."
    },
    {
      q: "Who's the better cook? Fair warning: this one's disputed.",
      options: ["Vaibhav", "Nishita"],
      correct: 1,
      quip: "Vaibhav strongly disputes this ruling."
    },
    {
      q: "Who really controls the TV remote?",
      options: ["Vaibhav", "Nishita", "Miso"],
      correct: 2,
      quip: "Democracy died the day Miso learned to sit on the remote."
    }
  ];

  const VERDICTS = [
    { min: 9, max: 10, text: "Soulmate-tier. Are you secretly one of us? 💍" },
    { min: 6, max: 8,  text: "Impressive — you've clearly been paying attention. 🎉" },
    { min: 3, max: 5,  text: "Not bad! Consider this your pre-wedding refresher. 😄" },
    { min: 0, max: 2,  text: "Clearly you don't know the couple well enough 😂 (We still love you.)" }
  ];

  function verdictFor(score) {
    const match = VERDICTS.find((v) => score >= v.min && score <= v.max);
    return match ? match.text : "";
  }

  function initQuiz() {
    const root = $("#quiz");
    if (!root) return; // nothing to do if the section isn't on the page

    const stage = $("#quizStage", root);
    if (!stage) return;

    // All the state for a single play-through lives here
    const state = { index: 0, score: 0, answered: false };

    /* ------------------------------------------------------
       Swap whatever's in the stage for a new panel. If the
       visitor hasn't asked for reduced motion we let the old
       panel fade/slide out first so it doesn't feel like a
       hard cut. onMount runs AFTER the new markup is actually
       in the DOM — that's where callers wire up listeners and
       set focus, so nothing ever binds to a panel that's about
       to be thrown away.
       ------------------------------------------------------ */
    function showPanel(html, onMount) {
      const outgoing = stage.firstElementChild;
      const isFirstPanel = !outgoing; // don't steal focus/scroll on the very first paint

      const mount = () => {
        stage.innerHTML = html;
        if (typeof onMount === "function") onMount(stage, isFirstPanel);
      };

      if (outgoing && !reduceMotion) {
        let done = false;
        const finish = () => { if (!done) { done = true; mount(); } };
        outgoing.classList.add("is-leaving");
        outgoing.addEventListener("transitionend", finish, { once: true });
        // belt-and-suspenders in case the transition never fires
        setTimeout(finish, 260);
      } else {
        mount();
      }
    }

    /* ------------------------------------------------------
       START PANEL
       ------------------------------------------------------ */
    function renderStart() {
      const html = `
        <div class="quiz__panel">
          <div class="quiz__monogram">V<span class="script">&amp;</span>N</div>
          <h3 class="quiz__panel-title">How well do you know <span class="script">us?</span></h3>
          <p class="quiz__panel-copy">10 questions about the two of us. No cheating 👀 (unless you ask Miso).</p>
          <div class="quiz__meta"><span>10 Questions</span><span>~2 Minutes</span></div>
          <button type="button" class="btn btn--fill" id="quizStartBtn"><span>Start the quiz</span></button>
        </div>
      `;
      showPanel(html, (s, isFirstPanel) => {
        const startBtn = $("#quizStartBtn", s);
        if (startBtn) {
          startBtn.addEventListener("click", () => {
            state.index = 0;
            state.score = 0;
            renderQuestion();
          });
          // only steal focus when replaying — on first load the visitor
          // hasn't scrolled to the quiz yet, so jumping focus here would
          // yank the page down to it uninvited
          if (!isFirstPanel) startBtn.focus();
        }
      });
    }

    /* ------------------------------------------------------
       QUESTION PANEL
       ------------------------------------------------------ */
    function renderQuestion() {
      const total = QUESTIONS.length;
      const item = QUESTIONS[state.index];
      state.answered = false;

      const optionsHtml = item.options
        .map((opt, i) => `<button type="button" class="quiz__option" data-idx="${i}"><span>${opt}</span></button>`)
        .join("");

      // fill reflects how many questions are already behind us
      const pct = Math.round((state.index / total) * 100);

      const html = `
        <div class="quiz__panel">
          <div class="quiz__progress">
            <span class="quiz__progress-label" aria-live="polite">Question ${state.index + 1} / ${total}</span>
            <span class="quiz__progress-track"><span class="quiz__progress-fill" style="width:${pct}%"></span></span>
          </div>
          <h3 class="quiz__question" id="quizQuestionHeading" tabindex="-1">${item.q}</h3>
          <div class="quiz__options">${optionsHtml}</div>
          <div class="quiz__feedback-slot" aria-live="polite"></div>
        </div>
      `;
      showPanel(html, (s) => {
        $$(".quiz__option", s).forEach((btn) => {
          btn.addEventListener("click", () => handleAnswer(btn));
        });
        const heading = $("#quizQuestionHeading", s);
        if (heading) heading.focus();
      });
    }

    function handleAnswer(picked) {
      if (state.answered) return; // one shot per question, no re-scoring
      state.answered = true;

      const item = QUESTIONS[state.index];
      const pickedIdx = Number(picked.dataset.idx);
      const gotItRight = pickedIdx === item.correct;
      if (gotItRight) state.score += 1;

      $$(".quiz__option", stage).forEach((btn, i) => {
        btn.disabled = true;
        if (i === item.correct) btn.classList.add("is-correct");
        else if (i === pickedIdx) btn.classList.add("is-wrong");
      });

      const isLast = state.index === QUESTIONS.length - 1;
      const slot = $(".quiz__feedback-slot", stage);
      if (slot) {
        slot.innerHTML = `
          <div class="quiz__feedback ${gotItRight ? "quiz__feedback--correct" : "quiz__feedback--wrong"}">
            <span class="quiz__feedback-lead">${gotItRight ? "Correct!" : "Not quite!"}</span>
            <p class="quiz__quip">${item.quip}</p>
            <button type="button" class="btn btn--outline" id="quizNextBtn">
              <span>${isLast ? "See my results" : "Next question"}</span>
            </button>
          </div>
        `;
        const nextBtn = $("#quizNextBtn", slot);
        if (nextBtn) {
          nextBtn.addEventListener("click", () => {
            if (isLast) renderResult();
            else { state.index += 1; renderQuestion(); }
          });
          nextBtn.focus(); // the answered option is now disabled, so hand focus onward
        }
      }
    }

    /* ------------------------------------------------------
       RESULT PANEL
       ------------------------------------------------------ */
    function renderResult() {
      const total = QUESTIONS.length;
      const score = state.score;

      const html = `
        <div class="quiz__panel">
          <h3 class="quiz__panel-title" id="quizResultHeading" tabindex="-1">Your <span class="script">results</span></h3>
          <div class="quiz__score">
            <span class="quiz__score-num" id="quizScoreNum">0</span>
            <span class="quiz__score-den">/ ${total}</span>
          </div>
          <p class="quiz__verdict">${verdictFor(score)}</p>
          <div class="quiz__result-actions">
            <button type="button" class="btn btn--fill" id="quizReplayBtn"><span>Play again</span></button>
            <button type="button" class="btn btn--outline" id="quizCopyBtn"><span>Copy my score</span></button>
          </div>
          <span class="quiz__copy-note" id="quizCopyNote" aria-live="polite">Copied to clipboard!</span>
        </div>
      `;
      showPanel(html, (s) => {
        const heading = $("#quizResultHeading", s);
        if (heading) heading.focus();

        animateScore(score, s);

        // A great score deserves a little fanfare, if the site has confetti wired up
        if (score >= 9 && window.WED && typeof window.WED.confetti === "function") {
          try { window.WED.confetti(); } catch (err) { /* confetti is a nice-to-have, never worth breaking the quiz */ }
        }

        const replayBtn = $("#quizReplayBtn", s);
        if (replayBtn) replayBtn.addEventListener("click", () => {
          state.index = 0;
          state.score = 0;
          renderStart();
        });

        const copyBtn = $("#quizCopyBtn", s);
        if (copyBtn) copyBtn.addEventListener("click", () => copyScore(score, total, s));
      });
    }

    function animateScore(score, panel) {
      const el = $("#quizScoreNum", panel);
      if (!el) return;
      if (reduceMotion || score === 0) { el.textContent = String(score); return; }

      const duration = 700;
      const start = performance.now();
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        el.textContent = String(Math.round(progress * score));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    function copyScore(score, total, panel) {
      const brag = `I scored ${score}/${total} on Vaibhav & Nishita's "How well do you know us?" quiz 💍 Think you can beat me?`;
      const note = $("#quizCopyNote", panel);

      const showNote = (text) => {
        if (!note) return;
        note.textContent = text;
        note.classList.add("is-visible");
        setTimeout(() => note.classList.remove("is-visible"), 2200);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(brag)
          .then(() => showNote("Copied to clipboard!"))
          .catch(() => showNote("Couldn't copy — screenshot it instead 📸"));
      } else {
        showNote("Couldn't copy — screenshot it instead 📸");
      }
    }

    /* ------------------------------------------------------
       Question panel's "Next" advances state.index before
       calling renderQuestion again, wired up inside
       handleAnswer above. Kick things off at the start card.
       ------------------------------------------------------ */
    renderStart();
  }

  document.addEventListener("DOMContentLoaded", initQuiz);
})();
