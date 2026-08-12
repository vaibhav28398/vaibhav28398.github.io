# Vaibhav & Nishita — Wedding Website

A handcrafted, single-page wedding site with a warm "golden-hour / destination
wedding" editorial aesthetic. No build step, no dependencies — just open
`index.html` in a browser (or serve the folder).

```
wedding-website/
├── index.html            ← all the markup
├── css/
│   ├── style.css         ← design system + layout
│   ├── animations.css    ← keyframes, reveals
│   ├── loader.css        ← "The Unveiling" curtain + scratch loader
│   ├── easter.css        ← hidden eggs, confetti, modal, cat
│   ├── fortune.css       ← Fortune Teller
│   ├── quiz.css          ← Couple Quiz
│   └── responsive.css    ← breakpoints + mobile-only elements
├── js/
│   ├── loader.js         ← scratch-card + curtain reveal
│   ├── easter.js         ← easter-egg engine + confetti API
│   ├── petals.js         ← drifting-petals canvas
│   ├── main.js           ← core interactivity
│   ├── fortune.js        ← Fortune Teller
│   └── quiz.js           ← Couple Quiz
└── README.md
```

## Run it

Just open the file:

```bash
open index.html
```

Or serve locally (nicer for testing, avoids any file:// quirks):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Feature highlights

- **"The Unveiling" loader** — velvet theatre curtains with a gold **scratch-to-reveal**
  Save-the-Date card. Scratch the foil (mouse or finger) to uncover the date, then
  "Enter" parts the curtains onto the site. Falls back gracefully for reduced-motion
  and no-JS visitors.
- **Split-text hero** — each letter of the names flies in.
- **Custom cursor** that morphs on hover (desktop pointers only).
- **Drifting petals** canvas (pauses when the tab is hidden; off for
  reduced-motion users).
- **Horizontal-scroll "Our Story"** on desktop that becomes a **vertical
  timeline** on mobile.
- **Live countdown** with a flip animation on each tick.
- **3D-tilt event cards** with a cursor-following glow.
- **Masonry gallery** with a full lightbox (keyboard + swipe navigation).
- **Animated FAQ accordion**.
- **RSVP form** with inline validation, conditional fields, and a success state.
- **Mobile bottom tab-bar** — a unique navigation element just for phones.
- Fully **responsive**, and honours **`prefers-reduced-motion`**.

## The fun, hidden layer 🎉

- **Wedding Fortune Teller** (`#fortune`) — a glowing CSS crystal ball. Guests type
  their name, pick which "side" they're on (Bride / Groom / Friend / Family), and get
  a personalised, funny prophecy. Same name + side always yields the same fortune
  (seeded PRNG), so it's shareable. Copy button included.
- **Couple Quiz** (`#quiz`) — a 10-question "How well do you know us?" card game with
  instant feedback, quips, a scored finale, and a witty verdict.
- **Easter eggs** — there are **four** secrets, tracked by a badge on the floating ring:
  1. **Click the ring** (bottom-left) → a secret love note + confetti.
  2. **Konami code** `↑ ↑ ↓ ↓ ← → ← → B A` → unlocks the hidden "off-camera" album.
     (You can also open it by typing the code `1 0 1 2 2 6`.)
  3. Type **`MISO`** → the couple's cat pads across the screen.
  4. Type **`FOREVER`** → a confetti downpour.

  Find all four and a little celebration fires. There's also a hidden message in the
  browser **console** for the truly curious.
- **Confetti engine** — a reusable heart + petal confetti burst exposed as
  `window.WED.confetti(opts)`; the Fortune Teller and Quiz call it on happy moments.

## Make it yours

Everything you'll want to change is plain text in `index.html`:

| What | Where |
|------|-------|
| Names | `.hero__names`, `.nav__brand`, footer, RSVP seal |
| Date | `.hero__date`, marquee, `data-date="2026-12-10T19:00:00"` on `#countdown`, footer |
| Photos | every `<img src="https://picsum.photos/...">` — swap for your own files, e.g. `img/hero.jpg` |
| Story timeline | the `.story-card` articles |
| Events | the `.event-card` articles |
| Travel / FAQ | the `.travel-info` and `.faq__item` blocks |
| Colours & fonts | CSS variables at the top of `css/style.css` (`:root`) |

### Hooking up the RSVP

The form currently logs the submission to the console and shows a success
message. To actually collect responses, point it at a backend — a
[Formspree](https://formspree.io) endpoint or Google Form is easiest:

1. In `index.html`, set `<form id="rsvpForm" action="https://formspree.io/f/XXeXXXXX" method="POST">`.
2. In `js/main.js`, inside the submit handler (after validation passes),
   replace the simulated success with a `fetch(form.action, { method: 'POST', body: new FormData(form) })`
   call, then show the success state on the resolved promise.

All the placeholder photos come from [picsum.photos](https://picsum.photos) —
replace them with your own and the layout stays intact.
