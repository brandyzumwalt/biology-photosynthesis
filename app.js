(() => {
  const PHASES = [
    {
      id: "light",
      title: "Light-Dependent Reactions (Thylakoid Membrane)",
      introHint: "Arrange the light-dependent reaction steps in cause-and-effect order.",
      steps: [
        "Light energy is absorbed by chlorophyll in the thylakoid membrane.",
        "Light energy excites electrons in chlorophyll.",
        "Water molecules are split, releasing oxygen gas.",
        "Electrons move through the electron transport chain.",
        "Hydrogen ions build up inside the thylakoid.",
        "ATP synthase produces ATP.",
        "Electrons reduce NADP plus to form NADPH.",
        "ATP and NADPH move to the Calvin cycle."
      ]
    },
    {
      id: "calvin",
      title: "Calvin Cycle (Stroma)",
      introHint: "Arrange the Calvin cycle steps in order.",
      steps: [
        "CO₂ enters the Calvin cycle.",
        "CO₂ is fixed to RuBP by the enzyme RuBisCO.",
        "The unstable six-carbon molecule splits into two three-carbon molecules.",
        "ATP + NADPH used to energize the three-carbon molecules.",
        "Three-carbon molecules are converted into G3P.",
        "Some G3P molecules leave the cycle to help form glucose.",
        "Remaining G3P molecules regenerate RuBP."
      ]
    }
  ];

  const BASE_STEP_DURATION_MS = 2600;
  const BASE_STEP_PAUSE_MS = 600;

  const SCENE = {
    membrane: { x: 70, y: 120, width: 410, height: 110, radius: 48 },
    ps2: { x: 130, y: 175, r: 18 },
    ps1: { x: 390, y: 175, r: 18 },
    etcPoints: [
      [148, 176],
      [210, 150],
      [266, 180],
      [325, 205],
      [372, 176]
    ],
    synthaseBody: { x: 236, y: 246, width: 88, height: 58, radius: 16 },
    synthaseKnob: { x: 280, y: 322, r: 20 },
    calvin: { x: 600, y: 312, outer: 72, inner: 42 }
  };

  const els = {
    showLearnBtn: document.getElementById("showLearnBtn"),
    showReviewBtn: document.getElementById("showReviewBtn"),
    learnView: document.getElementById("learnView"),
    reviewView: document.getElementById("reviewView"),

    learnLightBtn: document.getElementById("learnLightBtn"),
    learnCalvinBtn: document.getElementById("learnCalvinBtn"),
    learnCaption: document.getElementById("learnCaption"),
    speedSelect: document.getElementById("speedSelect"),
    visualModeSelect: document.getElementById("visualModeSelect"),
    reducedMotionToggle: document.getElementById("reducedMotionToggle"),
    stepTimeline: document.getElementById("stepTimeline"),
    startResetBtn: document.getElementById("startResetBtn"),
    prevStepBtn: document.getElementById("prevStepBtn"),
    nextStepBtn: document.getElementById("nextStepBtn"),
    replayStepBtn: document.getElementById("replayStepBtn"),
    playFullBtn: document.getElementById("playFullBtn"),
    goToReviewBtn: document.getElementById("goToReviewBtn"),

    reviewPhaseTitle: document.getElementById("reviewPhaseTitle"),
    reviewLightBtn: document.getElementById("reviewLightBtn"),
    reviewCalvinBtn: document.getElementById("reviewCalvinBtn"),
    reviewHint: document.getElementById("reviewHint"),
    cardBank: document.getElementById("cardBank"),
    slotList: document.getElementById("slotList"),
    checkBtn: document.getElementById("checkBtn"),
    reviewReplayBtn: document.getElementById("reviewReplayBtn"),
    reviewNextCycleBtn: document.getElementById("reviewNextCycleBtn"),
    resetPhaseBtn: document.getElementById("resetPhaseBtn"),
    goToLearnBtn: document.getElementById("goToLearnBtn"),
    feedback: document.getElementById("feedback"),

    canvas: document.getElementById("animationCanvas")
  };

  const ctx = els.canvas.getContext("2d");

  const state = {
    view: "learn",
    learn: {
      phaseIndex: 0,
      stepIndex: 0,
      progressedByPhase: [false, false],
      completedStepsByPhase: PHASES.map((phase) => Array(phase.steps.length).fill(false)),
      settings: {
        speed: 1,
        visualMode: "normal",
        reducedMotion: false
      }
    },
    review: {
      phaseIndex: 0,
      phases: PHASES.map(createPhaseState)
    },
    drag: {
      cardId: null,
      fromSlot: null
    },
    animation: {
      running: false,
      phaseId: PHASES[0].id,
      stepIdx: 0,
      stepStartTs: 0,
      mode: "idle",
      frozen: null
    }
  };

  function createPhaseState(phase) {
    const cards = phase.steps.map((text, idx) => ({
      id: `${phase.id}-${idx}`,
      text,
      expectedSlot: idx
    }));

    return {
      cards: shuffle(cards),
      placements: Array(phase.steps.length).fill(null),
      solved: false,
      lastCheck: Array(phase.steps.length).fill(null)
    };
  }

  function shuffle(input) {
    const arr = [...input];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function currentMotionScale() {
    return state.learn.settings.reducedMotion ? 0.65 : 1;
  }

  function currentStepDurationMs() {
    const speed = clamp(state.learn.settings.speed, 0.5, 1.75);
    return Math.round((BASE_STEP_DURATION_MS * currentMotionScale()) / speed);
  }

  function currentStepPauseMs() {
    const speed = clamp(state.learn.settings.speed, 0.5, 1.75);
    return Math.round((BASE_STEP_PAUSE_MS * currentMotionScale()) / speed);
  }

  function currentVisualMode() {
    return state.learn.settings.visualMode === "colorblind" ? "colorblind" : "normal";
  }

  function currentPalette() {
    const mode = currentVisualMode();
    if (mode === "colorblind") {
      return {
        photonFill: "#ffd53f",
        photonStroke: "#8f6400",
        photonRay: "rgba(143, 100, 0, 0.56)",
        photosystemBase: "#d38a2d",
        photosystemHot: "#f0aa3e",
        photosystemStroke: "#7d4810",
        electronFill: "#3ea0e3",
        electronStroke: "#124a78",
        ionFill: "#9a83ff",
        ionStroke: "#4e3ea2",
        ionInk: "#2d1b6f"
      };
    }
    return {
      photonFill: "#ffe67a",
      photonStroke: "#bf8b12",
      photonRay: "rgba(204, 140, 27, 0.46)",
      photosystemBase: "#a0cf69",
      photosystemHot: "#b8e47c",
      photosystemStroke: "#4f7f2a",
      electronFill: "#8bb8ff",
      electronStroke: "#2f5f8f",
      ionFill: "#f8b8d4",
      ionStroke: "#9f4f72",
      ionInk: "#7d2f53"
    };
  }

  function isStepComplete(phaseIndex, stepIndex) {
    return Boolean(state.learn.completedStepsByPhase[phaseIndex]?.[stepIndex]);
  }

  function markStepComplete(phaseIndex, stepIndex) {
    if (!state.learn.completedStepsByPhase[phaseIndex]) {
      return;
    }
    state.learn.completedStepsByPhase[phaseIndex][stepIndex] = true;
  }

  function clearPhaseStepCompletion(phaseIndex) {
    if (!state.learn.completedStepsByPhase[phaseIndex]) {
      return;
    }
    state.learn.completedStepsByPhase[phaseIndex].fill(false);
  }

  function applyVisualModeClass() {
    document.body.classList.toggle("visual-colorblind", currentVisualMode() === "colorblind");
  }

  function phaseByIndex(idx) {
    return PHASES[idx];
  }

  function phaseIndexById(id) {
    return PHASES.findIndex((phase) => phase.id === id);
  }

  function currentReviewPhaseDef() {
    return PHASES[state.review.phaseIndex];
  }

  function currentReviewPhaseState() {
    return state.review.phases[state.review.phaseIndex];
  }

  function isCalvinReviewUnlocked() {
    return state.review.phases[0].solved;
  }

  function setView(view) {
    state.view = view;

    const isLearn = view === "learn";
    els.learnView.classList.toggle("hidden", !isLearn);
    els.reviewView.classList.toggle("hidden", isLearn);
    els.showLearnBtn.classList.toggle("active", isLearn);
    els.showReviewBtn.classList.toggle("active", !isLearn);

    if (!isLearn) {
      stopAnimation();
      renderReview();
    } else {
      renderLearn();
    }
  }

  function setLearnPhase(phaseIndex) {
    state.learn.phaseIndex = phaseIndex;
    state.learn.stepIndex = 0;
    stopAnimation(true);
    renderLearn();
  }

  function setLearnStep(stepIndex) {
    const phase = phaseByIndex(state.learn.phaseIndex);
    state.learn.stepIndex = clamp(stepIndex, 0, phase.steps.length - 1);
    if (state.learn.stepIndex > 0) {
      state.learn.progressedByPhase[state.learn.phaseIndex] = true;
    }
    renderLearn();
  }

  function setReviewPhase(phaseIndex) {
    if (phaseIndex === 1 && !isCalvinReviewUnlocked()) {
      return;
    }
    state.review.phaseIndex = phaseIndex;
    renderReview();
  }

  function resetReviewPhase(phaseIndex) {
    state.review.phases[phaseIndex] = createPhaseState(phaseByIndex(phaseIndex));
    if (phaseIndex === 0 && !state.review.phases[0].solved) {
      state.review.phases[1] = createPhaseState(phaseByIndex(1));
      if (state.review.phaseIndex === 1) {
        state.review.phaseIndex = 0;
      }
    }
    clearReviewFeedback();
    renderReview();
  }

  function stepCaption(phaseIndex, stepIndex) {
    const phase = phaseByIndex(phaseIndex);
    return `Step ${stepIndex + 1} of ${phase.steps.length}: ${phase.steps[stepIndex]}`;
  }

  function renderLearnPhaseTabs() {
    els.learnLightBtn.classList.toggle("active", state.learn.phaseIndex === 0);
    els.learnCalvinBtn.classList.toggle("active", state.learn.phaseIndex === 1);
  }

  function renderLearnActions() {
    const phase = phaseByIndex(state.learn.phaseIndex);
    const atFirst = state.learn.stepIndex === 0;
    const atLast = state.learn.stepIndex === phase.steps.length - 1;
    const progressed = state.learn.progressedByPhase[state.learn.phaseIndex];
    const isRunning = state.animation.running;

    els.startResetBtn.textContent = progressed ? "Reset" : "Start";
    els.startResetBtn.disabled = isRunning;
    els.prevStepBtn.disabled = isRunning || atFirst;
    els.nextStepBtn.disabled = isRunning || atLast;
    els.replayStepBtn.disabled = isRunning;
    els.playFullBtn.disabled = isRunning;
  }

  function renderLearnSettings() {
    const speedValue = String(state.learn.settings.speed);
    if (els.speedSelect.value !== speedValue) {
      els.speedSelect.value = speedValue;
    }

    const modeValue = currentVisualMode();
    if (els.visualModeSelect.value !== modeValue) {
      els.visualModeSelect.value = modeValue;
    }

    els.reducedMotionToggle.checked = state.learn.settings.reducedMotion;
  }

  function renderStepTimeline() {
    const phaseIndex = state.learn.phaseIndex;
    const phase = phaseByIndex(phaseIndex);
    const isRunning = state.animation.running;

    els.stepTimeline.innerHTML = "";
    phase.steps.forEach((_, stepIdx) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "timeline-step";
      item.textContent = String(stepIdx + 1);
      item.title = phase.steps[stepIdx];
      item.setAttribute("aria-label", `Step ${stepIdx + 1}`);

      const stepRunning =
        isRunning && state.animation.phaseId === phase.id && state.animation.stepIdx === stepIdx;
      if (stepRunning || (!isRunning && state.learn.stepIndex === stepIdx)) {
        item.classList.add("current");
      }
      if (isStepComplete(phaseIndex, stepIdx)) {
        item.classList.add("complete");
      }
      if (isRunning) {
        item.disabled = true;
      }

      item.addEventListener("click", () => {
        if (state.animation.running) {
          return;
        }
        setLearnStep(stepIdx);
        startSingleStepReplay();
      });

      els.stepTimeline.appendChild(item);
    });
  }

  function renderLearnCaption() {
    if (state.animation.running) {
      return;
    }
    els.learnCaption.textContent = stepCaption(state.learn.phaseIndex, state.learn.stepIndex);
  }

  function renderLearn() {
    renderLearnPhaseTabs();
    renderLearnSettings();
    renderLearnActions();
    renderStepTimeline();
    renderLearnCaption();
  }

  function renderReviewPhaseTabs() {
    const unlocked = isCalvinReviewUnlocked();

    els.reviewLightBtn.classList.toggle("active", state.review.phaseIndex === 0);
    els.reviewCalvinBtn.classList.toggle("active", state.review.phaseIndex === 1);
    els.reviewCalvinBtn.disabled = !unlocked;
  }

  function renderReviewHead() {
    els.reviewPhaseTitle.textContent = `Review: ${currentReviewPhaseDef().title}`;
  }

  function renderReviewHint() {
    const phase = currentReviewPhaseDef();
    const phaseState = currentReviewPhaseState();
    const placed = phaseState.placements.filter(Boolean).length;

    if (phaseState.solved) {
      els.reviewHint.textContent = "Cycle solved. Replay the full cycle or move to the next review cycle.";
      return;
    }

    els.reviewHint.textContent = `${phase.introHint} (${placed}/${phase.steps.length} placed)`;
  }

  function cardById(phaseState, id) {
    return phaseState.cards.find((card) => card.id === id) || null;
  }

  function makeCardEl(card, slotIdx) {
    const el = document.createElement("div");
    el.className = "card";
    el.draggable = true;
    el.dataset.cardId = card.id;

    if (slotIdx !== null) {
      el.dataset.fromSlot = String(slotIdx);
    }

    el.textContent = card.text;
    el.addEventListener("dragstart", onCardDragStart);
    el.addEventListener("dragend", onCardDragEnd);
    return el;
  }

  function renderReviewCards() {
    const phaseState = currentReviewPhaseState();
    const placedIds = new Set(phaseState.placements.filter(Boolean));

    els.cardBank.innerHTML = "";
    phaseState.cards
      .filter((card) => !placedIds.has(card.id))
      .forEach((card) => {
        els.cardBank.appendChild(makeCardEl(card, null));
      });

    els.slotList.innerHTML = "";

    phaseState.placements.forEach((cardId, slotIdx) => {
      const li = document.createElement("li");
      li.className = "slot";
      li.dataset.slot = String(slotIdx);

      const checkStatus = phaseState.lastCheck[slotIdx];
      if (checkStatus === "correct") {
        li.classList.add("slot-correct");
      }
      if (checkStatus === "wrong") {
        li.classList.add("slot-wrong");
      }

      const badge = document.createElement("div");
      badge.className = "slot-index";
      badge.textContent = String(slotIdx + 1);
      li.appendChild(badge);

      if (cardId) {
        const card = cardById(phaseState, cardId);
        li.appendChild(makeCardEl(card, slotIdx));
      } else {
        const empty = document.createElement("div");
        empty.className = "slot-empty";
        empty.textContent = "Drop card here";
        li.appendChild(empty);
      }

      li.addEventListener("dragover", onSlotDragOver);
      li.addEventListener("dragleave", onSlotDragLeave);
      li.addEventListener("drop", onSlotDrop);

      els.slotList.appendChild(li);
    });
  }

  function updateReviewActions() {
    const phaseState = currentReviewPhaseState();

    els.reviewReplayBtn.disabled = !phaseState.solved;

    if (state.review.phaseIndex === 0 && phaseState.solved) {
      els.reviewNextCycleBtn.hidden = false;
      els.reviewNextCycleBtn.disabled = false;
    } else {
      els.reviewNextCycleBtn.hidden = true;
      els.reviewNextCycleBtn.disabled = true;
    }
  }

  function renderReview() {
    renderReviewHead();
    renderReviewPhaseTabs();
    renderReviewHint();
    renderReviewCards();
    updateReviewActions();
  }

  function clearReviewFeedback() {
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
  }

  function setReviewFeedback(message, tone) {
    els.feedback.textContent = message;
    els.feedback.className = `feedback ${tone}`;
  }

  function onCardDragStart(event) {
    const target = event.currentTarget;
    state.drag.cardId = target.dataset.cardId || null;
    state.drag.fromSlot = target.dataset.fromSlot ? Number(target.dataset.fromSlot) : null;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", state.drag.cardId || "");
  }

  function onCardDragEnd() {
    state.drag.cardId = null;
    state.drag.fromSlot = null;
    clearDropTargetStyles();
  }

  function clearDropTargetStyles() {
    document.querySelectorAll(".drop-target").forEach((node) => {
      node.classList.remove("drop-target");
    });
  }

  function onSlotDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    event.currentTarget.classList.add("drop-target");
  }

  function onSlotDragLeave(event) {
    event.currentTarget.classList.remove("drop-target");
  }

  function onSlotDrop(event) {
    event.preventDefault();
    const slotEl = event.currentTarget;
    slotEl.classList.remove("drop-target");

    const toSlot = Number(slotEl.dataset.slot);
    if (!Number.isInteger(toSlot)) {
      return;
    }

    applyReviewDrop(toSlot);
  }

  function applyReviewDrop(toSlot) {
    const cardId = state.drag.cardId;
    if (!cardId) {
      return;
    }

    const phaseState = currentReviewPhaseState();
    const placements = phaseState.placements;

    const fromSlot = state.drag.fromSlot;
    const existing = placements[toSlot];
    const priorSlot = placements.indexOf(cardId);

    if (priorSlot !== -1 && priorSlot !== fromSlot) {
      placements[priorSlot] = null;
    }

    if (fromSlot !== null) {
      if (fromSlot === toSlot) {
        return;
      }
      placements[fromSlot] = existing || null;
    }

    placements[toSlot] = cardId;
    phaseState.solved = false;
    phaseState.lastCheck = Array(phaseState.placements.length).fill(null);
    clearReviewFeedback();
    renderReview();
  }

  function onCardBankDrop(event) {
    event.preventDefault();
    els.cardBank.classList.remove("drop-target");

    const cardId = state.drag.cardId;
    if (!cardId || state.drag.fromSlot === null) {
      return;
    }

    const phaseState = currentReviewPhaseState();
    phaseState.placements[state.drag.fromSlot] = null;
    phaseState.solved = false;
    phaseState.lastCheck = Array(phaseState.placements.length).fill(null);
    clearReviewFeedback();
    renderReview();
  }

  function checkReviewPhase() {
    const phase = currentReviewPhaseDef();
    const phaseState = currentReviewPhaseState();

    if (phaseState.placements.includes(null)) {
      setReviewFeedback("Place all cards before checking your sequence.", "warn");
      return;
    }

    const correctness = phaseState.placements.map((cardId, slotIdx) => cardId === `${phase.id}-${slotIdx}`);

    phaseState.lastCheck = correctness.map((isCorrect) => (isCorrect ? "correct" : "wrong"));

    const correctCount = correctness.filter(Boolean).length;
    const total = correctness.length;

    if (correctCount === total) {
      phaseState.solved = true;
      setReviewFeedback("Correct sequence. Great work.", "good");
      renderReview();
      return;
    }

    const firstWrongSlot = correctness.findIndex((isCorrect) => !isCorrect);
    const expected = phase.steps[firstWrongSlot];
    setReviewFeedback(
      `${correctCount} of ${total} steps are correct. Revisit slot ${firstWrongSlot + 1}: ${expected}`,
      "warn"
    );
    renderReview();
  }

  function startSingleStepReplay() {
    const phase = phaseByIndex(state.learn.phaseIndex);
    startAnimation(phase.id, state.learn.stepIndex, "single");
  }

  function startFromBeginning() {
    stopAnimation(true);
    state.learn.stepIndex = 0;
    startSingleStepReplay();
  }

  function resetLearnPhaseProgress() {
    stopAnimation(true);
    state.learn.stepIndex = 0;
    state.learn.progressedByPhase[state.learn.phaseIndex] = false;
    clearPhaseStepCompletion(state.learn.phaseIndex);
    renderLearn();
  }

  function startFullReplay(phaseIndex) {
    const phase = phaseByIndex(phaseIndex);
    state.learn.phaseIndex = phaseIndex;
    state.learn.stepIndex = 0;
    state.learn.progressedByPhase[phaseIndex] = true;
    startAnimation(phase.id, 0, "full");
  }

  function startAnimation(phaseId, stepIdx, mode) {
    state.animation.frozen = null;
    state.animation.running = true;
    state.animation.phaseId = phaseId;
    state.animation.stepIdx = stepIdx;
    state.animation.stepStartTs = performance.now();
    state.animation.mode = mode;

    const idx = phaseIndexById(phaseId);
    if (idx !== -1) {
      state.learn.phaseIndex = idx;
      state.learn.stepIndex = stepIdx;
    }

    const phase = phaseByIndex(state.learn.phaseIndex);
    els.learnCaption.textContent = stepCaption(state.learn.phaseIndex, state.learn.stepIndex);
    if (mode === "full") {
      els.learnCaption.textContent = `Cycle replay: ${phase.steps[stepIdx]}`;
    }

    renderLearn();
  }

  function stopAnimation(clearFrozen = false) {
    state.animation.running = false;
    state.animation.mode = "idle";
    if (clearFrozen) {
      state.animation.frozen = null;
    }
  }

  function replaySolvedReviewPhase() {
    const phaseState = currentReviewPhaseState();
    if (!phaseState.solved) {
      return;
    }

    const phaseIndex = state.review.phaseIndex;
    setView("learn");
    startFullReplay(phaseIndex);
  }

  function goToNextReviewCycle() {
    if (!isCalvinReviewUnlocked()) {
      return;
    }
    state.review.phaseIndex = 1;
    clearReviewFeedback();
    renderReview();
  }

  function animationTick(timestamp) {
    if (!state.animation.running) {
      if (state.animation.frozen) {
        drawStepFrame(
          state.animation.frozen.phaseId,
          state.animation.frozen.stepIdx,
          state.animation.frozen.progress,
          timestamp
        );
      } else {
        drawIdleScene(timestamp);
      }
      requestAnimationFrame(animationTick);
      return;
    }

    const phase = PHASES.find((entry) => entry.id === state.animation.phaseId);
    if (!phase) {
      stopAnimation(true);
      drawIdleScene(timestamp);
      requestAnimationFrame(animationTick);
      return;
    }

    const stepDuration = currentStepDurationMs();
    const stepPause = currentStepPauseMs();
    const elapsed = timestamp - state.animation.stepStartTs;
    const stepTotal = stepDuration + stepPause;

    if (elapsed >= stepTotal) {
      if (state.animation.mode === "single") {
        markStepComplete(state.learn.phaseIndex, state.learn.stepIndex);
        state.animation.frozen = {
          phaseId: state.animation.phaseId,
          stepIdx: state.animation.stepIdx,
          progress: 1
        };
        stopAnimation();
        els.learnCaption.textContent = `Step complete. ${stepCaption(state.learn.phaseIndex, state.learn.stepIndex)}`;
        renderLearn();
        drawStepFrame(state.animation.frozen.phaseId, state.animation.frozen.stepIdx, 1, timestamp);
        requestAnimationFrame(animationTick);
        return;
      }

      state.animation.stepIdx += 1;
      if (state.animation.stepIdx >= phase.steps.length) {
        state.learn.completedStepsByPhase[state.learn.phaseIndex].fill(true);
        state.animation.frozen = {
          phaseId: state.animation.phaseId,
          stepIdx: phase.steps.length - 1,
          progress: 1
        };
        stopAnimation();
        state.learn.stepIndex = phase.steps.length - 1;
        els.learnCaption.textContent = "Cycle replay complete. Use Review Sequencing when ready.";
        renderLearn();
        drawStepFrame(state.animation.frozen.phaseId, state.animation.frozen.stepIdx, 1, timestamp);
        requestAnimationFrame(animationTick);
        return;
      }

      state.animation.stepStartTs = timestamp;
      markStepComplete(state.learn.phaseIndex, state.animation.stepIdx - 1);
      state.learn.stepIndex = state.animation.stepIdx;
      if (state.learn.stepIndex > 0) {
        state.learn.progressedByPhase[state.learn.phaseIndex] = true;
      }
      els.learnCaption.textContent = `Cycle replay: ${phase.steps[state.animation.stepIdx]}`;
      renderLearn();
    }

    const withinStep = Math.min(elapsed, stepDuration);
    const progress = withinStep / stepDuration;
    drawStepFrame(state.animation.phaseId, state.animation.stepIdx, progress, timestamp);

    requestAnimationFrame(animationTick);
  }

  function wireEvents() {
    els.showLearnBtn.addEventListener("click", () => {
      setView("learn");
    });

    els.showReviewBtn.addEventListener("click", () => {
      setView("review");
    });

    els.learnLightBtn.addEventListener("click", () => {
      setLearnPhase(0);
    });

    els.learnCalvinBtn.addEventListener("click", () => {
      setLearnPhase(1);
    });

    els.speedSelect.addEventListener("change", () => {
      const parsed = Number(els.speedSelect.value);
      state.learn.settings.speed = Number.isFinite(parsed) ? clamp(parsed, 0.5, 1.75) : 1;
      renderLearn();
    });

    els.visualModeSelect.addEventListener("change", () => {
      state.learn.settings.visualMode = els.visualModeSelect.value === "colorblind" ? "colorblind" : "normal";
      applyVisualModeClass();
      renderLearn();
    });

    els.reducedMotionToggle.addEventListener("change", () => {
      state.learn.settings.reducedMotion = els.reducedMotionToggle.checked;
      renderLearn();
    });

    els.startResetBtn.addEventListener("click", () => {
      if (state.learn.progressedByPhase[state.learn.phaseIndex]) {
        resetLearnPhaseProgress();
        return;
      }
      startFromBeginning();
    });

    els.prevStepBtn.addEventListener("click", () => {
      setLearnStep(state.learn.stepIndex - 1);
      startSingleStepReplay();
    });

    els.nextStepBtn.addEventListener("click", () => {
      setLearnStep(state.learn.stepIndex + 1);
      startSingleStepReplay();
    });

    els.replayStepBtn.addEventListener("click", () => {
      startSingleStepReplay();
    });

    els.playFullBtn.addEventListener("click", () => {
      startFullReplay(state.learn.phaseIndex);
    });

    els.goToReviewBtn.addEventListener("click", () => {
      setView("review");
    });

    els.reviewLightBtn.addEventListener("click", () => {
      setReviewPhase(0);
    });

    els.reviewCalvinBtn.addEventListener("click", () => {
      setReviewPhase(1);
    });

    els.checkBtn.addEventListener("click", () => {
      checkReviewPhase();
    });

    els.reviewReplayBtn.addEventListener("click", () => {
      replaySolvedReviewPhase();
    });

    els.reviewNextCycleBtn.addEventListener("click", () => {
      goToNextReviewCycle();
    });

    els.resetPhaseBtn.addEventListener("click", () => {
      resetReviewPhase(state.review.phaseIndex);
    });

    els.goToLearnBtn.addEventListener("click", () => {
      setView("learn");
    });

    els.cardBank.addEventListener("dragover", (event) => {
      event.preventDefault();
      els.cardBank.classList.add("drop-target");
    });

    els.cardBank.addEventListener("dragleave", () => {
      els.cardBank.classList.remove("drop-target");
    });

    els.cardBank.addEventListener("drop", onCardBankDrop);
  }

  function init() {
    applyVisualModeClass();
    wireEvents();
    clearReviewFeedback();
    renderLearn();
    renderReview();
    setView("learn");
    requestAnimationFrame(animationTick);
  }

  function drawIdleScene(timeMs = 0) {
    drawSceneBase({}, timeMs);
    drawCaptionGuide();
  }

  function drawStepFrame(phaseId, stepIdx, progress, timeMs) {
    const overlays = animateStep(phaseId, stepIdx, progress);
    drawSceneBase(overlays.highlights, timeMs);
    overlays.draw(ctx, progress);
  }

  function drawSceneBase(highlights, timeMs) {
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);

    const w = els.canvas.width;
    const h = els.canvas.height;

    drawBackdrop(w, h, timeMs);
    drawStructures(highlights, timeMs);
    drawAmbient(timeMs, highlights, w, h);
    drawFocusLayer(highlights);
    drawLabels();
  }

  function drawBackdrop(width, height, timeMs) {
    const motion = currentMotionScale();
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.56);
    sky.addColorStop(0, "#d8efff");
    sky.addColorStop(1, "#ebf7ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.56);

    const stroma = ctx.createLinearGradient(0, height * 0.52, 0, height);
    stroma.addColorStop(0, "#f2fbf5");
    stroma.addColorStop(1, "#e6f4eb");
    ctx.fillStyle = stroma;
    ctx.fillRect(0, height * 0.52, width, height * 0.48);

    const waveShift = Math.sin((timeMs / 1300) * motion) * 3;
    ctx.strokeStyle = "rgba(138, 174, 203, 0.19)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 2; i += 1) {
      const y = 67 + i * 30 + waveShift * (i + 1) * 0.16;
      ctx.beginPath();
      for (let x = -20; x <= width + 20; x += 20) {
        const dy = Math.sin((x + timeMs * 0.028 * motion + i * 36) / 90) * 2.2;
        if (x === -20) {
          ctx.moveTo(x, y + dy);
        } else {
          ctx.lineTo(x, y + dy);
        }
      }
      ctx.stroke();
    }

    ctx.save();
    const beamAlpha = state.learn.settings.reducedMotion ? 0.08 : 0.13;
    const beamDrift = Math.sin((timeMs / 1800) * motion) * 24;
    const beam = ctx.createLinearGradient(20 + beamDrift, 0, 230 + beamDrift, height * 0.56);
    beam.addColorStop(0, `rgba(255, 248, 198, ${beamAlpha})`);
    beam.addColorStop(1, "rgba(255, 248, 198, 0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(30 + beamDrift, 0);
    ctx.lineTo(210 + beamDrift, 0);
    ctx.lineTo(330 + beamDrift, height * 0.56);
    ctx.lineTo(150 + beamDrift, height * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(142, 172, 186, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.52);
    ctx.lineTo(width, height * 0.52);
    ctx.stroke();
  }

  function drawStructures(highlights, timeMs) {
    const palette = currentPalette();
    const membrane = SCENE.membrane;
    const motion = currentMotionScale();
    const pulse = 0.5 + 0.5 * Math.sin((timeMs / 240) * motion);

    for (let i = 0; i < 3; i += 1) {
      drawRoundedRect(
        membrane.x + i * 6,
        membrane.y + i * 5,
        membrane.width - i * 12,
        membrane.height - i * 10,
        membrane.radius - i * 6,
        "rgba(166, 208, 175, 0.2)",
        "rgba(125, 171, 138, 0.3)",
        1
      );
    }

    const membraneFill = ctx.createLinearGradient(0, membrane.y, 0, membrane.y + membrane.height);
    membraneFill.addColorStop(0, highlights.thylakoid ? "#d3f3df" : "#dceddf");
    membraneFill.addColorStop(1, highlights.thylakoid ? "#c4e8d3" : "#d1e5d6");
    drawRoundedRect(
      membrane.x,
      membrane.y,
      membrane.width,
      membrane.height,
      membrane.radius,
      membraneFill,
      "#83b297",
      3
    );
    drawMembraneTexture(membrane);

    const lumenFill = ctx.createLinearGradient(0, membrane.y + 22, 0, membrane.y + membrane.height - 20);
    lumenFill.addColorStop(0, "#f8fffb");
    lumenFill.addColorStop(1, "#edf8f1");
    drawRoundedRect(
      membrane.x + 24,
      membrane.y + 25,
      membrane.width - 48,
      membrane.height - 50,
      32,
      lumenFill,
      "#9dc3a8",
      1.5
    );

    if (highlights.ps2) {
      drawGlow(SCENE.ps2.x, SCENE.ps2.y, 34 + pulse * 8, "#94da6b", 0.28);
    }
    if (highlights.ps1) {
      drawGlow(SCENE.ps1.x, SCENE.ps1.y, 34 + pulse * 8, "#94da6b", 0.28);
    }

    drawCircle(
      SCENE.ps2.x,
      SCENE.ps2.y,
      SCENE.ps2.r,
      highlights.ps2 ? palette.photosystemHot : palette.photosystemBase,
      palette.photosystemStroke,
      2
    );
    drawCircle(
      SCENE.ps1.x,
      SCENE.ps1.y,
      SCENE.ps1.r,
      highlights.ps1 ? palette.photosystemHot : palette.photosystemBase,
      palette.photosystemStroke,
      2
    );
    drawTextTag("PSII", SCENE.ps2.x - 18, SCENE.ps2.y - 46, "#ecf7d3", "#446d1f");
    drawTextTag("PSI", SCENE.ps1.x - 13, SCENE.ps1.y - 46, "#ecf7d3", "#446d1f");

    drawEtcComplexes(highlights, pulse, timeMs);

    const synthaseBody = SCENE.synthaseBody;
    const synthaseGradient = ctx.createLinearGradient(0, synthaseBody.y, 0, synthaseBody.y + synthaseBody.height);
    synthaseGradient.addColorStop(0, highlights.atpSynthase ? "#ffe9c2" : "#f4e8d8");
    synthaseGradient.addColorStop(1, highlights.atpSynthase ? "#f8c985" : "#e2cfb3");

    const synthaseCapGradient = ctx.createLinearGradient(0, synthaseBody.y - 18, 0, synthaseBody.y + 2);
    synthaseCapGradient.addColorStop(0, highlights.atpSynthase ? "#ffe4b3" : "#efdfc8");
    synthaseCapGradient.addColorStop(1, highlights.atpSynthase ? "#f9cd8f" : "#dcc7a6");

    drawRoundedRect(synthaseBody.x + 8, synthaseBody.y - 18, synthaseBody.width - 16, 20, 9, synthaseCapGradient, "#c6934c", 2);
    drawRoundedRect(synthaseBody.x - 7, synthaseBody.y + 16, 12, 24, 4, "#e8dbc5", "#b88b51", 1.6);
    drawRoundedRect(
      synthaseBody.x + synthaseBody.width - 5,
      synthaseBody.y + 16,
      12,
      24,
      4,
      "#e8dbc5",
      "#b88b51",
      1.6
    );

    drawRoundedRect(
      synthaseBody.x,
      synthaseBody.y,
      synthaseBody.width,
      synthaseBody.height,
      synthaseBody.radius,
      synthaseGradient,
      "#c6934c",
      2
    );

    drawRoundedRect(
      synthaseBody.x + 16,
      synthaseBody.y + 13,
      synthaseBody.width - 32,
      30,
      10,
      "rgba(255, 244, 224, 0.6)",
      "rgba(198, 147, 76, 0.6)",
      1.3
    );

    for (let i = 0; i < 6; i += 1) {
      const spinBoost = highlights.atpSynthase ? 1.4 : 0.42;
      const angle = ((Math.PI * 2) / 6) * i + (timeMs / 420) * motion * spinBoost;
      const armX = SCENE.synthaseKnob.x + Math.cos(angle) * 15;
      const armY = SCENE.synthaseKnob.y + Math.sin(angle) * 15;
      ctx.strokeStyle = "rgba(160, 114, 49, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SCENE.synthaseKnob.x, SCENE.synthaseKnob.y);
      ctx.lineTo(armX, armY);
      ctx.stroke();
    }

    if (highlights.atpSynthase) {
      drawGlow(SCENE.synthaseKnob.x, SCENE.synthaseKnob.y, 42 + pulse * 8, "#ffd089", 0.25);
    }

    drawCircle(
      SCENE.synthaseKnob.x,
      SCENE.synthaseKnob.y,
      SCENE.synthaseKnob.r,
      highlights.atpSynthase ? "#ffd79a" : "#e7d5be",
      "#b27b38",
      2
    );
    drawCircle(SCENE.synthaseKnob.x, SCENE.synthaseKnob.y, SCENE.synthaseKnob.r * 0.42, "#f8ebd4", "#b27b38", 1.5);

    drawCalvinWheel(highlights, timeMs);
  }

  function drawAmbient(timeMs, highlights, width, height) {
    const motion = currentMotionScale();

    for (let i = 0; i < 6; i += 1) {
      const x = ((timeMs * 0.034 * motion + i * 136) % (width + 100)) - 50;
      const y = 56 + Math.sin((timeMs * 0.0018 * motion + i) * 1.2) * 10;
      drawPhoton(x, y, 0.24);
    }

    for (let i = 0; i < 8; i += 1) {
      const x = 96 + i * 33 + Math.sin(timeMs * 0.002 * motion + i) * 7;
      const y = 206 + Math.cos(timeMs * 0.003 * motion + i * 0.8) * 8;
      drawIonDot(x, y, 0.15, 3.6);
    }

    for (let i = 0; i < 4; i += 1) {
      const rise = ((timeMs * 0.03 * motion + i * 90) % 120) / 120;
      const x = 88 + i * 28 + Math.sin(timeMs * 0.002 * motion + i) * 4;
      const y = 232 - rise * 115;
      drawBubble(x, y, 4 + i * 0.6, 0.14);
    }

    drawPulseHighlights(highlights, timeMs);

    ctx.fillStyle = "rgba(92, 124, 130, 0.25)";
    ctx.fillRect(0, height * 0.52, width, 1);

    drawInterconnectHint(timeMs);
  }

  function drawLabels() {
    ctx.fillStyle = "#35573f";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.shadowColor = "rgba(240, 248, 244, 0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText("Thylakoid Membrane", 92, 110);
    ctx.fillText("Stroma", 20, 252);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Calvin Cycle", SCENE.calvin.x, SCENE.calvin.y);
    ctx.restore();
    ctx.fillText("ATP Synthase", 220, 360);
    ctx.shadowBlur = 0;
  }

  function drawFocusLayer(highlights) {
    const active = Object.values(highlights).some(Boolean);
    if (!active) {
      return;
    }

    const width = els.canvas.width;
    const height = els.canvas.height;

    ctx.save();
    ctx.fillStyle = "rgba(9, 22, 34, 0.14)";
    ctx.beginPath();
    ctx.rect(0, 0, width, height);

    if (highlights.thylakoid) {
      addRoundedRectPath(
        SCENE.membrane.x - 16,
        SCENE.membrane.y - 16,
        SCENE.membrane.width + 32,
        SCENE.membrane.height + 32,
        SCENE.membrane.radius + 20
      );
    }

    if (highlights.ps2) {
      addCirclePath(SCENE.ps2.x, SCENE.ps2.y, 44);
    }

    if (highlights.ps1) {
      addCirclePath(SCENE.ps1.x, SCENE.ps1.y, 44);
    }

    if (highlights.etc) {
      SCENE.etcPoints.forEach((point) => {
        addCirclePath(point[0], point[1], 20);
      });
    }

    if (highlights.atpSynthase) {
      addRoundedRectPath(
        SCENE.synthaseBody.x - 18,
        SCENE.synthaseBody.y - 28,
        SCENE.synthaseBody.width + 36,
        SCENE.synthaseBody.height + 110,
        SCENE.synthaseBody.radius + 10
      );
    }

    if (highlights.calvin) {
      addCirclePath(SCENE.calvin.x, SCENE.calvin.y, SCENE.calvin.outer + 26);
    }

    ctx.fill("evenodd");
    ctx.restore();
  }

  function drawCaptionGuide() {
    drawTextTag("Photosynthesis structures", 20, 24, "#d7ebff", "#2f5f87");
  }

  function drawMembraneTexture(membrane) {
    ctx.save();
    ctx.strokeStyle = "rgba(133, 176, 146, 0.24)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      const y = membrane.y + 13 + i * 12;
      ctx.beginPath();
      ctx.moveTo(membrane.x + 20, y);
      ctx.lineTo(membrane.x + membrane.width - 20, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEtcComplexes(highlights, pulse, timeMs) {
    const motion = currentMotionScale();
    const points = SCENE.etcPoints;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pathColor = highlights.etc ? "#f18b48" : "#a79f8e";
    ctx.strokeStyle = pathColor;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();

    if (highlights.etc) {
      ctx.strokeStyle = "rgba(241, 139, 72, 0.35)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 220, 151, 0.85)";
      ctx.lineWidth = 2.8;
      ctx.setLineDash([9, 12]);
      ctx.lineDashOffset = -timeMs * 0.07 * motion;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    points.forEach((pt, idx) => {
      const nodePulse = 0.4 + 0.6 * Math.sin(pulse + idx * 1.2);
      drawCircle(pt[0], pt[1], 7, "#efe4d3", "#8e806b", 1.4);
      if (highlights.etc) {
        drawGlow(pt[0], pt[1], 13 + nodePulse * 5, "#f4aa61", 0.2);
      }
    });

    ctx.restore();
  }

  function drawCalvinWheel(highlights, timeMs) {
    const motion = currentMotionScale();
    const calvin = SCENE.calvin;
    const isActive = Boolean(highlights.calvin);
    const ringColor = isActive ? "rgba(92, 166, 102, 0.78)" : "rgba(131, 162, 132, 0.48)";
    const guideColor = highlights.calvin ? "rgba(116, 178, 121, 0.45)" : "rgba(145, 171, 146, 0.34)";
    const segmentCount = 6;

    ctx.save();
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(calvin.x, calvin.y, calvin.outer, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(calvin.x, calvin.y, calvin.inner + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < segmentCount; i += 1) {
      const start = -Math.PI / 2 + i * ((Math.PI * 2) / segmentCount) + 0.1;
      const end = start + 0.66;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(calvin.x, calvin.y, calvin.outer - 12, start, end);
      ctx.stroke();

      const arrowAngle = end;
      const px = calvin.x + Math.cos(arrowAngle) * (calvin.outer - 12);
      const py = calvin.y + Math.sin(arrowAngle) * (calvin.outer - 12);
      const tx = -Math.sin(arrowAngle);
      const ty = Math.cos(arrowAngle);
      drawArrow(px - tx * 6, py - ty * 6, px + tx * 6, py + ty * 6, ringColor);
    }

    if (isActive) {
      const trailProgress = ((timeMs * 0.00011 * motion) % 1) * Math.PI * 2;
      const angle = -Math.PI / 2 + trailProgress;
      const trailRadius = calvin.inner + 6;
      const trailX = calvin.x + Math.cos(angle) * trailRadius;
      const trailY = calvin.y + Math.sin(angle) * trailRadius;

      ctx.strokeStyle = "rgba(112, 186, 121, 0.58)";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(calvin.x, calvin.y, trailRadius, angle - 0.32, angle);
      ctx.stroke();

      drawGlow(trailX, trailY, 12, "#8cda99", 0.36);
      drawCircle(trailX, trailY, 3.4, "#a7efb0", "#4f8f59", 1);
    }

    ctx.restore();
  }

  function drawPulseHighlights(highlights, timeMs) {
    const motion = currentMotionScale();
    const pulse = 0.5 + 0.5 * Math.sin((timeMs / 200) * motion);
    const membrane = SCENE.membrane;

    if (highlights.thylakoid) {
      drawRoundedRect(
        membrane.x - 7,
        membrane.y - 7,
        membrane.width + 14,
        membrane.height + 14,
        membrane.radius + 8,
        "rgba(0,0,0,0)",
        `rgba(90, 174, 130, ${0.2 + pulse * 0.22})`,
        3
      );
    }

    if (highlights.ps2) {
      drawGlow(SCENE.ps2.x, SCENE.ps2.y, 36 + pulse * 11, "#94da6b", 0.3);
    }
    if (highlights.ps1) {
      drawGlow(SCENE.ps1.x, SCENE.ps1.y, 36 + pulse * 11, "#94da6b", 0.3);
    }
    if (highlights.atpSynthase) {
      drawGlow(SCENE.synthaseKnob.x, SCENE.synthaseKnob.y, 47 + pulse * 13, "#f9ba59", 0.3);
    }
    if (highlights.calvin) {
      drawGlow(SCENE.calvin.x, SCENE.calvin.y, 82 + pulse * 10, "#86d296", 0.24);
    }
  }

  function drawInterconnectHint(timeMs) {
    const motion = currentMotionScale();
    const drift = Math.sin((timeMs / 1400) * motion) * 4;
    ctx.save();
    ctx.strokeStyle = "rgba(107, 149, 113, 0.28)";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    ctx.moveTo(352, 322 + drift * 0.25);
    ctx.bezierCurveTo(430, 314, 502, 314, 565, 319);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrow(552, 318, 574, 320, "rgba(107, 149, 113, 0.35)");
    ctx.restore();
  }

  function animateStep(phaseId, stepIdx, progress) {
    const library = {
      light: lightAnimators,
      calvin: calvinAnimators
    };

    const phaseLibrary = library[phaseId];
    if (!phaseLibrary || !phaseLibrary[stepIdx]) {
      return {
        highlights: {},
        draw: () => {}
      };
    }

    return phaseLibrary[stepIdx](progress);
  }

  const lightAnimators = [
    (p) => ({
      highlights: { thylakoid: true, ps2: true },
      draw: () => {
        for (let i = 0; i < 5; i += 1) {
          const x = 50 + i * 35 + p * 70;
          const y = 68 + i * 6;
          drawPhoton(x, y, 1);
        }
      }
    }),
    (p) => ({
      highlights: { ps2: true },
      draw: () => {
        drawPhoton(120, 72, 1 - p * 0.5);
        drawParticleTrail(132, 174, 157, 156, p, 4, 0.18, (x, y, alpha) => drawElectron(x, y, alpha));
        drawParticleTrail(138, 184, 156, 170, p, 3, 0.22, (x, y, alpha) => drawElectron(x, y, alpha * 0.9));
      }
    }),
    (p) => ({
      highlights: { thylakoid: true, ps2: true },
      draw: () => {
        drawWater(88, 210, 1);
        drawBubble(90 + p * 70, 210 - p * 95, 9, 1);
        drawBubble(112 + p * 58, 218 - p * 90, 7, 0.82);
        drawIon(120 + p * 30, 201, 0.95);
        drawIon(102 + p * 25, 196, 0.95);
      }
    }),
    (p) => ({
      highlights: { etc: true, ps2: true, ps1: true },
      draw: () => {
        drawElectronPath(p);
      }
    }),
    (p) => ({
      highlights: { thylakoid: true },
      draw: () => {
        for (let i = 0; i < 9; i += 1) {
          const x = 175 + i * 25;
          const y = 210 - Math.sin(i + p * 4) * 11;
          drawIon(x, y, 0.88);
        }
      }
    }),
    (p) => ({
      highlights: { atpSynthase: true },
      draw: () => {
        for (let i = 0; i < 8; i += 1) {
          const lane = i % 2 === 0 ? -1 : 1;
          const x = SCENE.synthaseBody.x + SCENE.synthaseBody.width / 2 + lane * 7 + Math.sin(p * 6 + i) * 2;
          const y = 236 + p * 64 + i * 1.8;
          drawIon(x, y, 0.82 - i * 0.05);
        }
        drawMovingTokenTrail(
          "ATP",
          SCENE.synthaseKnob.x + 18,
          SCENE.synthaseKnob.y - 6,
          385,
          286,
          p,
          "#fbd28a",
          "#8b5a17"
        );
      }
    }),
    (p) => ({
      highlights: { ps1: true },
      draw: () => {
        drawParticleTrail(395, 173, 450, 151, p, 4, 0.17, (x, y, alpha) => drawElectron(x, y, alpha));
        drawMovingTokenTrail("NADPH", 460, 125, 520, 140, p, "#c5e3ff", "#1f4f7f");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawMovingTokenTrail("ATP", 350, 305, 555, 318, p, "#fbd28a", "#8b5a17");
        drawMovingTokenTrail("NADPH", 380, 220, 575, 300, p, "#c5e3ff", "#1f4f7f");
        drawArrow(536, 315, 579, 318, "rgba(56, 110, 77, 0.6)");
      }
    })
  ];

  const calvinAnimators = [
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawCO2(500 + p * 66, 248 + p * 45, 1);
        drawCO2(468 + p * 84, 264 + p * 42, 0.82);
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("RuBP", 570, 308, "#e7f5c4", "#4b6d25");
        drawToken("RuBisCO", 622 - p * 20, 278 + p * 8, "#f4e0c1", "#7b5a2d");
        drawCO2(556 + p * 26, 270 + p * 22, 0.88);
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("6C", 600, 282 + p * 14, "#fbe3e3", "#843c3c");
        drawToken("3C", 566 - p * 22, 308 + p * 15, "#e1f1ff", "#2f5f8f");
        drawToken("3C", 634 + p * 22, 308 + p * 15, "#e1f1ff", "#2f5f8f");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("ATP", 500 + p * 82, 264 + p * 24, "#fbd28a", "#8b5a17");
        drawToken("NADPH", 500 + p * 72, 334 - p * 30, "#c5e3ff", "#1f4f7f");
        drawToken("3C", 620, 318, "#e1f1ff", "#2f5f8f");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("3C", 572, 336 - p * 26, "#e1f1ff", "#2f5f8f");
        drawToken("G3P", 640, 300 + p * 10, "#d8f4da", "#2f6b38");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("G3P", 626 + p * 92, 292 - p * 26, "#d8f4da", "#2f6b38");
        drawArrow(640, 296, 712, 270, "#2f6b38");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("RuBP", 628 - p * 34, 352 - p * 30, "#e7f5c4", "#4b6d25");
        drawArrow(632, 344, 594, 312, "#4b6d25");
      }
    })
  ];

  function drawRoundedRect(x, y, width, height, radius, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function addRoundedRectPath(x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawCircle(x, y, r, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function addCirclePath(x, y, r) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
  }

  function drawGlow(x, y, r, color, alpha) {
    ctx.save();
    const priorAlpha = ctx.globalAlpha;
    ctx.globalAlpha = priorAlpha * alpha;
    const grad = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPhoton(x, y, alpha) {
    const palette = currentPalette();
    ctx.save();
    ctx.globalAlpha = alpha;
    drawGlow(x, y, 18, "rgb(255, 229, 127)", 0.34);
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const x1 = x + Math.cos(angle) * 8.2;
      const y1 = y + Math.sin(angle) * 8.2;
      const x2 = x + Math.cos(angle) * 12.8;
      const y2 = y + Math.sin(angle) * 12.8;
      ctx.strokeStyle = palette.photonRay;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    drawCircle(x, y, 6.2, palette.photonFill, palette.photonStroke, 1.3);
    ctx.restore();
  }

  function drawElectron(x, y, alpha) {
    const palette = currentPalette();
    ctx.save();
    ctx.globalAlpha = alpha;
    drawGlow(x, y, 11, "rgb(143, 187, 255)", 0.3);
    drawCircle(x, y, 4.4, palette.electronFill, palette.electronStroke, 1.2);
    ctx.restore();
  }

  function drawIon(x, y, alpha) {
    const palette = currentPalette();
    const ionRadius = 7;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCircle(x, y, ionRadius, palette.ionFill, palette.ionStroke, 1.2);
    ctx.fillStyle = palette.ionInk;
    ctx.font = "700 7px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H+", x, y + 0.5);
    ctx.restore();
  }

  function drawIonDot(x, y, alpha, radius) {
    const palette = currentPalette();
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCircle(x, y, radius, palette.ionFill, palette.ionStroke, 1);
    ctx.restore();
  }

  function drawWater(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCircle(x, y, 12, "#c6e8ff", "#4f89b2", 1.3);
    ctx.fillStyle = "#2e6b92";
    ctx.font = "bold 10px Trebuchet MS";
    ctx.fillText("H2O", x - 10, y + 4);
    ctx.restore();
  }

  function drawBubble(x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCircle(x, y, r, "#d3f2ff", "#5ca7c2", 1.1);
    ctx.restore();
  }

  function drawToken(label, x, y, fill, stroke) {
    const width = Math.max(42, label.length * 8 + 16);
    const height = 24;
    drawRoundedRect(x - width / 2, y - height / 2, width, height, 7, fill, stroke, 1.3);
    ctx.fillStyle = stroke;
    ctx.font = "bold 12px Trebuchet MS";
    ctx.fillText(label, x - width / 2 + 10, y + 4);
  }

  function drawTokenWithAlpha(label, x, y, fill, stroke, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawToken(label, x, y, fill, stroke);
    ctx.restore();
  }

  function drawMovingTokenTrail(label, fromX, fromY, toX, toY, progress, fill, stroke) {
    const trailSteps = 4;
    for (let i = trailSteps; i >= 0; i -= 1) {
      const local = Math.max(0, progress - i * 0.09);
      const x = fromX + (toX - fromX) * local;
      const y = fromY + (toY - fromY) * local;
      const alpha = 0.25 + ((trailSteps - i) / trailSteps) * 0.75;
      drawTokenWithAlpha(label, x, y, fill, stroke, alpha);
    }
  }

  function drawParticleTrail(fromX, fromY, toX, toY, progress, count, spacing, renderer) {
    for (let i = 0; i < count; i += 1) {
      const local = Math.max(0, progress - i * spacing);
      const alpha = 1 - i / (count + 1);
      const x = fromX + (toX - fromX) * local;
      const y = fromY + (toY - fromY) * local;
      renderer(x, y, alpha);
    }
  }

  function drawCO2(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCircle(x, y, 12, "#e7eeff", "#55658d", 1.2);
    ctx.fillStyle = "#384d7a";
    ctx.font = "bold 11px Trebuchet MS";
    ctx.fillText("CO₂", x - 10, y + 4);
    ctx.restore();
  }

  function drawTextTag(text, x, y, fill, ink) {
    const width = text.length * 7 + 18;
    drawRoundedRect(x, y, width, 24, 6, fill, "#a8bfda", 1);
    ctx.fillStyle = ink;
    ctx.font = "bold 12px Trebuchet MS";
    ctx.fillText(text, x + 9, y + 16);
  }

  function drawArrow(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawElectronPath(progress) {
    for (let i = 0; i < 6; i += 1) {
      const local = Math.min(0.98, Math.max(0, progress - i * 0.09));
      const [x, y] = pointOnPolyline(SCENE.etcPoints, local);
      drawElectron(x, y, 1 - i * 0.11);
    }
  }

  function pointOnPolyline(points, t) {
    const segmentLengths = [];
    let total = 0;

    for (let i = 0; i < points.length - 1; i += 1) {
      const dx = points[i + 1][0] - points[i][0];
      const dy = points[i + 1][1] - points[i][1];
      const len = Math.hypot(dx, dy);
      segmentLengths.push(len);
      total += len;
    }

    let target = t * total;
    for (let i = 0; i < segmentLengths.length; i += 1) {
      if (target <= segmentLengths[i]) {
        const ratio = segmentLengths[i] === 0 ? 0 : target / segmentLengths[i];
        const x = points[i][0] + (points[i + 1][0] - points[i][0]) * ratio;
        const y = points[i][1] + (points[i + 1][1] - points[i][1]) * ratio;
        return [x, y];
      }
      target -= segmentLengths[i];
    }

    return points[points.length - 1];
  }

  init();
})();
