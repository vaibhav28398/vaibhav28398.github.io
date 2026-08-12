/* =============================================================
   mixtape.js · "The First-Dance Mixtape" song-request wall
   Self-contained: does nothing unless #mixtape exists on the
   page. Vanilla JS, no dependencies, no network calls.

   Guests suggest songs for the sangeet/reception; each request
   lands on a shared tracklist and can be "+1'd" by anyone. The
   list lives in localStorage so it keeps growing across visits
   on the same browser — there's no server, so "shared" here just
   means "whatever this browser has seen," which is the honest
   scope of a static wedding site.
   ============================================================= */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  var STORAGE_KEY = "va_mixtape_v1";
  var MAX_TRACKS = 80;

  function init() {
    var root = document.getElementById("mixtape");
    if (!root) return; // this page doesn't have the mixtape — bail quietly

    var form = root.querySelector("#mixtapeForm");
    var songField = root.querySelector("#mixtapeSong");
    var artistField = root.querySelector("#mixtapeArtist");
    var nameField = root.querySelector("#mixtapeName");
    var list = root.querySelector("#mixtapeList");
    var countEl = root.querySelector("#mixtapeCount");
    var sortSelect = root.querySelector("#mixtapeSort");
    var emptyState = root.querySelector("#mixtapeEmpty");
    var record = root.querySelector("#mixtapeRecord");
    var deckCaption = root.querySelector("#mixtapeDeckCaption");

    if (!form || !list) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var songFieldWrap = songField ? songField.closest(".mixtape__field") : null;

    var state = loadState();
    var sortMode = "newest";
    var deck = root.querySelector("#mixtapeDeck");

    render();
    updateSpin();

    // the record only spins while the deck is actually on screen —
    // no point animating something nobody can see
    if (deck && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          deck.dataset.visible = entry.isIntersecting ? "1" : "0";
          updateSpin();
        });
      }, { threshold: 0.2 });
      io.observe(deck);
    } else if (deck) {
      deck.dataset.visible = "1";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var songRaw = songField ? songField.value : "";
      var song = songRaw.trim();
      if (!song) {
        nudgeSongField();
        return;
      }

      var artist = artistField ? artistField.value.trim() : "";
      var by = nameField ? nameField.value.trim() : "";

      var dupe = findDuplicate(song, artist);
      if (dupe) {
        likeTrack(dupe.id, { fromDuplicate: true });
        form.reset();
        if (songField) songField.focus();
        return;
      }

      var track = {
        id: makeId(),
        song: song,
        artist: artist,
        by: by,
        likes: 0,
        added: Date.now(),
        mine: true
      };

      state.tracks.unshift(track);
      if (state.tracks.length > MAX_TRACKS) {
        state.tracks = state.tracks.slice(0, MAX_TRACKS);
      }
      saveState();
      render(track.id);

      form.reset();
      if (songField) songField.focus();
    });

    if (songField && songFieldWrap) {
      songField.addEventListener("input", function () {
        songFieldWrap.classList.remove("is-nudged");
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", function () {
        sortMode = sortSelect.value === "loved" ? "loved" : "newest";
        render();
      });
    }

    list.addEventListener("click", function (e) {
      var likeBtn = e.target.closest(".mixtape__like");
      if (likeBtn) {
        likeTrack(likeBtn.dataset.id);
        return;
      }
      var removeBtn = e.target.closest(".mixtape__remove");
      if (removeBtn) {
        removeTrack(removeBtn.dataset.id);
      }
    });

    /* ------------------------------------------------------
       Rendering
       ------------------------------------------------------ */
    function render(justAddedId) {
      var sorted = sortedTracks();

      if (!sorted.length) {
        list.innerHTML = "";
        if (emptyState) emptyState.hidden = false;
        updateCount();
        return;
      }
      if (emptyState) emptyState.hidden = true;

      list.innerHTML = "";
      sorted.forEach(function (track, i) {
        list.appendChild(buildRow(track, i, track.id === justAddedId));
      });
      updateCount();
    }

    function buildRow(track, index, justMounted) {
      var li = document.createElement("li");
      li.className = "mixtape__track" + (!reduceMotion && justMounted ? " is-mounting" : "");
      li.dataset.id = track.id;

      var idxSpan = document.createElement("span");
      idxSpan.className = "mixtape__track-index";
      idxSpan.textContent = String(index + 1).padStart(2, "0");
      li.appendChild(idxSpan);

      var main = document.createElement("div");
      main.className = "mixtape__track-main";

      var songLine = document.createElement("p");
      songLine.className = "mixtape__track-song";
      songLine.textContent = track.song;
      if (track.artist) {
        var artistSpan = document.createElement("span");
        artistSpan.className = "mixtape__track-artist";
        artistSpan.textContent = " — " + track.artist;
        songLine.appendChild(artistSpan);
      }
      main.appendChild(songLine);

      var byLine = document.createElement("span");
      byLine.className = "mixtape__track-by";
      byLine.textContent = track.by ? "— " + track.by : "A guest";
      main.appendChild(byLine);

      li.appendChild(main);

      var actions = document.createElement("div");
      actions.className = "mixtape__track-actions";

      var liked = hasLiked(track.id);
      var likeBtn = document.createElement("button");
      likeBtn.type = "button";
      likeBtn.className = "mixtape__like";
      likeBtn.dataset.id = track.id;
      likeBtn.setAttribute("aria-pressed", liked ? "true" : "false");
      likeBtn.setAttribute("aria-label", "Like " + track.song + (track.artist ? " by " + track.artist : "") + ", " + track.likes + " like" + (track.likes === 1 ? "" : "s") + " so far");
      var heart = document.createElement("span");
      heart.className = "mixtape__like-heart";
      heart.setAttribute("aria-hidden", "true");
      heart.textContent = liked ? "♥" : "♡";
      var countSpan = document.createElement("span");
      countSpan.className = "mixtape__like-count";
      countSpan.textContent = String(track.likes);
      likeBtn.appendChild(heart);
      likeBtn.appendChild(countSpan);
      actions.appendChild(likeBtn);

      if (track.mine) {
        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "mixtape__remove";
        removeBtn.dataset.id = track.id;
        removeBtn.setAttribute("aria-label", "Remove " + track.song + " from the mixtape");
        removeBtn.textContent = "×";
        actions.appendChild(removeBtn);
      }

      li.appendChild(actions);
      return li;
    }

    function updateCount() {
      if (!countEl) return;
      var n = state.tracks.length;
      countEl.textContent = n + " song" + (n === 1 ? "" : "s") + " on the setlist";
    }

    function sortedTracks() {
      var copy = state.tracks.slice();
      if (sortMode === "loved") {
        copy.sort(function (a, b) {
          if (b.likes !== a.likes) return b.likes - a.likes;
          return b.added - a.added;
        });
      } else {
        copy.sort(function (a, b) { return b.added - a.added; });
      }
      return copy;
    }

    /* ------------------------------------------------------
       Likes
       ------------------------------------------------------ */
    function likeTrack(id, opts) {
      if (!id) return;
      var track = state.tracks.find(function (t) { return t.id === id; });
      if (!track) return;

      var already = hasLiked(id);
      if (already && !(opts && opts.fromDuplicate)) return; // one like per browser, per track

      if (!already) {
        state.likedIds.push(id);
      }
      track.likes += 1;
      saveState();
      render();

      if (opts && opts.fromDuplicate) {
        guardedToast("Someone already picked that — +1'd it for you");
      }
    }

    function hasLiked(id) {
      return state.likedIds.indexOf(id) !== -1;
    }

    function removeTrack(id) {
      if (!id) return;
      var idx = state.tracks.findIndex(function (t) { return t.id === id && t.mine; });
      if (idx === -1) return; // soft rule: only ever remove entries this browser added
      state.tracks.splice(idx, 1);
      saveState();
      render();
    }

    function findDuplicate(song, artist) {
      var songKey = song.toLowerCase();
      var artistKey = artist.toLowerCase();
      return state.tracks.find(function (t) {
        return t.song.toLowerCase() === songKey && (t.artist || "").toLowerCase() === artistKey;
      });
    }

    /* ------------------------------------------------------
       Turntable spin state
       ------------------------------------------------------ */
    function updateSpin() {
      if (!record) return;
      var visible = !deck || deck.dataset.visible !== "0";
      var shouldSpin = !reduceMotion && visible;
      record.classList.toggle("is-spinning", shouldSpin);
      if (deckCaption) {
        deckCaption.dataset.state = shouldSpin ? "spinning" : "paused";
        deckCaption.textContent = shouldSpin ? "Now spinning" : "Paused";
      }
    }

    function nudgeSongField() {
      if (!songFieldWrap) return;
      songFieldWrap.classList.remove("is-nudged");
      void songFieldWrap.offsetWidth; // re-trigger the wiggle even if it just played
      songFieldWrap.classList.add("is-nudged");
      if (songField) songField.focus();
    }

    /* ------------------------------------------------------
       Persistence
       ------------------------------------------------------ */
    function loadState() {
      var fallback = { tracks: defaultTracks(), likedIds: [] };
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return fallback;
        var parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.tracks)) return fallback;
        return {
          tracks: parsed.tracks,
          likedIds: Array.isArray(parsed.likedIds) ? parsed.likedIds : []
        };
      } catch (err) {
        return fallback; // private mode, corrupted JSON, whatever — start fresh in memory
      }
    }

    function saveState() {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        /* storage full or unavailable — the page still works, it just won't persist */
      }
    }

    function guardedToast(html) {
      if (window.WED && typeof window.WED.toast === "function") {
        try { window.WED.toast(html); } catch (err) { /* toast is a nice-to-have */ }
      }
    }
  }

  /* ==========================================================
     Seed data — a charming default setlist so the deck never
     looks empty on a fresh visit
     ========================================================== */
  function defaultTracks() {
    var now = Date.now();
    var seeds = [
      { song: "Perfect", artist: "Ed Sheeran", likes: 14 },
      { song: "Tum Se Hi", artist: "Mohit Chauhan", likes: 11 },
      { song: "Can't Help Falling in Love", artist: "Elvis Presley", likes: 9 },
      { song: "Raabta", artist: "Arijit Singh", likes: 8 },
      { song: "At Last", artist: "Etta James", likes: 6 },
      { song: "Kabira", artist: "Arijit Singh, Tochi Raina", likes: 5 }
    ];
    return seeds.map(function (seed, i) {
      return {
        id: makeId(),
        song: seed.song,
        artist: seed.artist,
        by: "",
        likes: seed.likes,
        added: now - (seeds.length - i) * 60000,
        mine: false
      };
    });
  }

  function makeId() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
})();
