(function () {
  "use strict";

  var COUNTDOWN_SECONDS = 10;
  var TIMEOUT_REVEAL_SECONDS = 3;

  var PHASES = {
    COUNTDOWN: "countdown",
    TIMEOUT_REVEAL: "timeoutReveal",
    AWAITING_RESPONSE: "awaitingResponse",
    REVEALED: "revealed",
    RESULT_RECORDED: "resultRecorded"
  };

  var state = {
    clue: null,
    phase: PHASES.COUNTDOWN,
    countdown: COUNTDOWN_SECONDS,
    buzzedPlayer: null,
    scoreP1: 0,
    scoreP2: 0,
    error: null
  };

  var countdownIntervalId = null;
  var timeoutRevealTimerId = null;

  var els = {};

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function loadAllCluePartsThen(onDone) {
    var parts = window.JEOPARDY_CLUES_PARTS || [];
    if (parts.length === 0) {
      state.error = "clues_manifest.js not loaded, or lists no parts \u2014 run convert_clues_to_js.py first.";
      render();
      return;
    }
    var chain = Promise.resolve();
    parts.forEach(function (src) {
      chain = chain.then(function () { return loadScript(src); });
    });
    chain.then(onDone).catch(function (err) {
      state.error = "Failed to load clue data: " + err.message;
      render();
    });
  }

  function cacheEls() {
    els.category = document.getElementById("category");
    els.value = document.getElementById("value");
    els.clueText = document.getElementById("clueText");
    els.solution = document.getElementById("solution");
    els.scoreP1 = document.getElementById("scoreP1");
    els.scoreP2 = document.getElementById("scoreP2");
    els.countdown = document.getElementById("countdown");
    els.status = document.getElementById("status");
    els.buzzers = document.getElementById("buzzers");
    els.buzzP1 = document.getElementById("buzzP1");
    els.buzzP2 = document.getElementById("buzzP2");
    els.revealBtn = document.getElementById("revealBtn");
    els.correctIncorrect = document.getElementById("correctIncorrect");
    els.correctBtn = document.getElementById("correctBtn");
    els.incorrectBtn = document.getElementById("incorrectBtn");
    els.nextBtn = document.getElementById("nextBtn");
    els.resetBtn = document.getElementById("resetBtn");
  }

  function clearTimers() {
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
    if (timeoutRevealTimerId) {
      clearTimeout(timeoutRevealTimerId);
      timeoutRevealTimerId = null;
    }
  }

  function pickRandomClue() {
    var data = window.JEOPARDY_CLUES;
    if (!data || data.length === 0) return null;
    return data[Math.floor(Math.random() * data.length)];
  }

  function loadNewClue() {
    clearTimers();
    var data = window.JEOPARDY_CLUES;
    if (!data) {
      state.error = "clues_data.js not loaded \u2014 is it in the same folder as index.html?";
      state.clue = null;
      render();
      return;
    }
    if (data.length === 0) {
      state.error = "clues_data.js loaded but contains 0 clues.";
      state.clue = null;
      render();
      return;
    }
    state.error = null;
    state.clue = pickRandomClue();
    state.phase = PHASES.COUNTDOWN;
    state.countdown = COUNTDOWN_SECONDS;
    state.buzzedPlayer = null;
    render();
    startCountdown();
  }

  function startCountdown() {
    clearTimers();
    state.countdown = COUNTDOWN_SECONDS;
    render();
    countdownIntervalId = setInterval(function () {
      state.countdown -= 1;
      if (state.countdown <= 0) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
        if (state.phase === PHASES.COUNTDOWN) {
          state.phase = PHASES.TIMEOUT_REVEAL;
          render();
          timeoutRevealTimerId = setTimeout(loadNewClue, TIMEOUT_REVEAL_SECONDS * 1000);
        }
        return;
      }
      render();
    }, 1000);
  }

  function buzz(player) {
    if (state.phase !== PHASES.COUNTDOWN) return;
    clearTimers();
    state.buzzedPlayer = player;
    state.phase = PHASES.AWAITING_RESPONSE;
    render();
  }

  function revealSolution() {
    if (state.phase !== PHASES.AWAITING_RESPONSE) return;
    state.phase = PHASES.REVEALED;
    render();
  }

  function recordResult(correct) {
    if (state.phase !== PHASES.REVEALED || !state.clue || !state.buzzedPlayer) return;
    var delta = correct ? state.clue.value : -state.clue.value;
    if (state.buzzedPlayer === 1) {
      state.scoreP1 += delta;
    } else {
      state.scoreP2 += delta;
    }
    state.phase = PHASES.RESULT_RECORDED;
    render();
  }

  function nextClue() {
    loadNewClue();
  }

  function resetGame() {
    clearTimers();
    state.scoreP1 = 0;
    state.scoreP2 = 0;
    loadNewClue();
  }

  function render() {
    if (state.error) {
      els.category.textContent = "ERROR";
      els.clueText.textContent = state.error;
      els.value.textContent = "";
      els.solution.hidden = true;
    } else if (state.clue) {
      els.category.textContent = state.clue.category.toUpperCase();
      els.value.textContent = "$" + state.clue.value;
      els.clueText.textContent = state.clue.clue.toUpperCase();

      var solutionShown =
        state.phase === PHASES.REVEALED ||
        state.phase === PHASES.RESULT_RECORDED ||
        state.phase === PHASES.TIMEOUT_REVEAL;

      if (solutionShown) {
        els.solution.textContent = state.clue.answer.toUpperCase();
        els.solution.hidden = false;
      } else {
        els.solution.hidden = true;
      }
    }

    els.scoreP1.textContent = "Player 1: $" + state.scoreP1;
    els.scoreP2.textContent = "Player 2: $" + state.scoreP2;

    els.buzzers.hidden = true;
    els.revealBtn.hidden = true;
    els.correctIncorrect.hidden = true;
    els.nextBtn.hidden = true;
    els.status.hidden = true;
    els.countdown.hidden = true;

    switch (state.phase) {
      case PHASES.COUNTDOWN:
        els.buzzers.hidden = false;
        els.countdown.hidden = false;
        els.countdown.textContent = state.countdown;
        break;
      case PHASES.TIMEOUT_REVEAL:
        els.status.hidden = false;
        els.status.textContent = "Time's up! No one buzzed in.";
        break;
      case PHASES.AWAITING_RESPONSE:
        els.revealBtn.hidden = false;
        els.status.hidden = false;
        els.status.textContent = "Awaiting Player " + state.buzzedPlayer + "'s response";
        break;
      case PHASES.REVEALED:
        els.correctIncorrect.hidden = false;
        els.status.hidden = false;
        els.status.textContent = "Player " + state.buzzedPlayer + ": correct or incorrect?";
        break;
      case PHASES.RESULT_RECORDED:
        els.nextBtn.hidden = false;
        break;
    }
  }

  function attachHandlers() {
    els.buzzP1.addEventListener("click", function () { buzz(1); });
    els.buzzP2.addEventListener("click", function () { buzz(2); });
    els.revealBtn.addEventListener("click", revealSolution);
    els.correctBtn.addEventListener("click", function () { recordResult(true); });
    els.incorrectBtn.addEventListener("click", function () { recordResult(false); });
    els.nextBtn.addEventListener("click", nextClue);
    els.resetBtn.addEventListener("click", resetGame);

    document.addEventListener("keydown", function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      var key = e.key.toLowerCase();
      if (key === "z") {
        buzz(1);
      } else if (key === "m") {
        buzz(2);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    cacheEls();
    attachHandlers();
    loadAllCluePartsThen(loadNewClue);
  });
})();
