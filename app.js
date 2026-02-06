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
      introHint: "Now arrange the Calvin cycle steps in sequence.",
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

  const STEP_DURATION_MS = 2600;
  const STEP_PAUSE_MS = 600;

  const els = {
    modeSelect: document.getElementById("modeSelect"),
    hintsToggle: document.getElementById("hintsToggle"),
    feedbackSelect: document.getElementById("feedbackSelect"),
    resetBtn: document.getElementById("resetBtn"),
    phaseTitle: document.getElementById("phaseTitle"),
    phaseHint: document.getElementById("phaseHint"),
    cardBank: document.getElementById("cardBank"),
    slotList: document.getElementById("slotList"),
    checkBtn: document.getElementById("checkBtn"),
    replayBtn: document.getElementById("replayBtn"),
    nextBtn: document.getElementById("nextBtn"),
    feedback: document.getElementById("feedback"),
    canvas: document.getElementById("animationCanvas"),
    caption: document.getElementById("caption")
  };

  const ctx = els.canvas.getContext("2d");

  const state = {
    mode: "practice",
    hintsOn: true,
    feedbackMode: "guided",
    phaseIndex: 0,
    phases: [],
    drag: {
      cardId: null,
      fromSlot: null
    },
    animation: {
      running: false,
      phaseId: null,
      stepIdx: 0,
      stepStartTs: 0
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

  function resetState() {
    state.phaseIndex = 0;
    state.phases = PHASES.map(createPhaseState);
    state.animation.running = false;
    state.animation.phaseId = null;
    state.animation.stepIdx = 0;
    state.animation.stepStartTs = 0;
    els.caption.textContent = "Animation locked until the sequence is correct.";
    clearFeedback();
  }

  function shuffle(input) {
    const arr = [...input];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function currentPhaseDef() {
    return PHASES[state.phaseIndex];
  }

  function currentPhaseState() {
    return state.phases[state.phaseIndex];
  }

  function syncModeRules() {
    if (state.mode === "challenge") {
      state.hintsOn = false;
      els.hintsToggle.checked = false;
      els.hintsToggle.disabled = true;
    } else {
      els.hintsToggle.disabled = false;
      if (!els.hintsToggle.checked) {
        state.hintsOn = false;
      }
    }
  }

  function render() {
    renderHead();
    renderCards();
    updateActionButtons();
    renderHintLine();
  }

  function renderHead() {
    els.phaseTitle.textContent = currentPhaseDef().title;
  }

  function renderHintLine() {
    const phase = currentPhaseDef();
    const phaseState = currentPhaseState();

    if (phaseState.solved) {
      els.phaseHint.textContent = "Phase complete. Use replay to reinforce the sequence.";
      return;
    }

    if (!state.hintsOn) {
      els.phaseHint.textContent = "Hints are off.";
      return;
    }

    const filled = phaseState.placements.filter(Boolean).length;
    els.phaseHint.textContent = `${phase.introHint} (${filled}/${phase.steps.length} placed)`;
  }

  function cardById(phaseState, id) {
    return phaseState.cards.find((card) => card.id === id) || null;
  }

  function renderCards() {
    const phaseState = currentPhaseState();
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

    applyDropToSlot(toSlot);
  }

  function applyDropToSlot(toSlot) {
    const cardId = state.drag.cardId;
    if (!cardId) {
      return;
    }

    const phaseState = currentPhaseState();
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
    state.animation.running = false;
    els.caption.textContent = "Animation locked until the sequence is correct.";
    phaseState.lastCheck = Array(phaseState.placements.length).fill(null);
    clearFeedback();
    render();
  }

  function clearDropTargetStyles() {
    document.querySelectorAll(".drop-target").forEach((node) => {
      node.classList.remove("drop-target");
    });
  }

  els.cardBank.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.cardBank.classList.add("drop-target");
  });

  els.cardBank.addEventListener("dragleave", () => {
    els.cardBank.classList.remove("drop-target");
  });

  els.cardBank.addEventListener("drop", (event) => {
    event.preventDefault();
    els.cardBank.classList.remove("drop-target");

    const cardId = state.drag.cardId;
    if (!cardId || state.drag.fromSlot === null) {
      return;
    }

    const phaseState = currentPhaseState();
    phaseState.placements[state.drag.fromSlot] = null;
    phaseState.solved = false;
    state.animation.running = false;
    els.caption.textContent = "Animation locked until the sequence is correct.";
    phaseState.lastCheck = Array(phaseState.placements.length).fill(null);
    clearFeedback();
    render();
  });

  function updateActionButtons() {
    const phaseState = currentPhaseState();
    els.replayBtn.disabled = !phaseState.solved;

    if (state.phaseIndex === 0 && phaseState.solved) {
      els.nextBtn.hidden = false;
      els.nextBtn.disabled = false;
    } else {
      els.nextBtn.hidden = true;
      els.nextBtn.disabled = true;
    }
  }

  function clearFeedback() {
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
  }

  function setFeedback(message, tone) {
    els.feedback.textContent = message;
    els.feedback.className = `feedback ${tone}`;
  }

  function checkCurrentPhase() {
    const phase = currentPhaseDef();
    const phaseState = currentPhaseState();

    if (phaseState.placements.includes(null)) {
      setFeedback("Place all cards before checking your sequence.", "warn");
      return;
    }

    const correctness = phaseState.placements.map((cardId, slotIdx) => {
      const expectedId = `${phase.id}-${slotIdx}`;
      return cardId === expectedId;
    });

    phaseState.lastCheck = correctness.map((value) => (value ? "correct" : "wrong"));
    renderCards();

    const correctCount = correctness.filter(Boolean).length;
    const total = correctness.length;
    const allCorrect = correctCount === total;

    if (allCorrect) {
      phaseState.solved = true;
      state.animation.running = false;
      setFeedback("Correct sequence. Replay is now unlocked.", "good");
      els.caption.textContent = "Press Replay Animation to review each step.";
      updateActionButtons();
      renderHintLine();
      return;
    }

    if (state.feedbackMode === "binary") {
      setFeedback("Not correct yet. Try again.", "bad");
      return;
    }

    const firstWrongSlot = correctness.findIndex((isCorrect) => !isCorrect);
    let message = `${correctCount} of ${total} steps are in the right position.`;

    if (state.hintsOn && firstWrongSlot !== -1) {
      const expected = phase.steps[firstWrongSlot];
      message += ` Revisit slot ${firstWrongSlot + 1}: ${expected}`;
    } else {
      message += " Re-check the cause-and-effect flow between neighboring steps.";
    }

    setFeedback(message, "warn");
  }

  function goToCalvinPhase() {
    state.phaseIndex = 1;
    state.animation.running = false;
    els.caption.textContent = "Animation locked until the sequence is correct.";
    clearFeedback();
    render();
    drawIdleScene();
  }

  function startReplay() {
    const phase = currentPhaseDef();
    const phaseState = currentPhaseState();

    if (!phaseState.solved) {
      return;
    }

    state.animation.running = true;
    state.animation.phaseId = phase.id;
    state.animation.stepIdx = 0;
    state.animation.stepStartTs = performance.now();
    els.caption.textContent = phase.steps[0];
  }

  function animationTick(timestamp) {
    if (!state.animation.running) {
      requestAnimationFrame(animationTick);
      return;
    }

    const phase = PHASES.find((entry) => entry.id === state.animation.phaseId);
    if (!phase) {
      state.animation.running = false;
      requestAnimationFrame(animationTick);
      return;
    }

    const elapsed = timestamp - state.animation.stepStartTs;
    const stepTotal = STEP_DURATION_MS + STEP_PAUSE_MS;

    if (elapsed >= stepTotal) {
      state.animation.stepIdx += 1;
      if (state.animation.stepIdx >= phase.steps.length) {
        state.animation.running = false;
        els.caption.textContent = "Replay complete.";
        drawIdleScene();
        requestAnimationFrame(animationTick);
        return;
      }
      state.animation.stepStartTs = timestamp;
      els.caption.textContent = phase.steps[state.animation.stepIdx];
    }

    const withinStep = Math.min(elapsed, STEP_DURATION_MS);
    const progress = withinStep / STEP_DURATION_MS;
    drawStepFrame(state.animation.phaseId, state.animation.stepIdx, progress);

    requestAnimationFrame(animationTick);
  }

  function drawIdleScene() {
    drawSceneBase({});
    drawCaptionGuide();
  }

  function drawStepFrame(phaseId, stepIdx, progress) {
    const overlays = animateStep(phaseId, stepIdx, progress);
    drawSceneBase(overlays.highlights);
    overlays.draw(ctx, progress);
  }

  function drawSceneBase(highlights) {
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);

    const w = els.canvas.width;
    const h = els.canvas.height;

    ctx.fillStyle = "#edf8f1";
    ctx.fillRect(0, h * 0.52, w, h * 0.48);

    ctx.fillStyle = "#e7f4ff";
    ctx.fillRect(0, 0, w, h * 0.52);

    const membrane = {
      x: 70,
      y: 120,
      width: 410,
      height: 110,
      r: 48
    };

    drawRoundedRect(
      membrane.x,
      membrane.y,
      membrane.width,
      membrane.height,
      membrane.r,
      highlights.thylakoid ? "#d2f0d9" : "#dcefe2",
      "#89b79b",
      3
    );

    drawRoundedRect(
      membrane.x + 24,
      membrane.y + 25,
      membrane.width - 48,
      membrane.height - 50,
      32,
      "#f5fff8",
      "#9dc3a8",
      1.5
    );

    drawCircle(130, 175, 18, highlights.ps2 ? "#f8da73" : "#edd68f", "#b08b1d", 2);
    drawCircle(390, 175, 18, highlights.ps1 ? "#f8da73" : "#edd68f", "#b08b1d", 2);

    ctx.strokeStyle = highlights.etc ? "#f18b48" : "#a79f8e";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(148, 176);
    ctx.lineTo(240, 145);
    ctx.lineTo(325, 205);
    ctx.lineTo(372, 176);
    ctx.stroke();

    drawRoundedRect(
      250,
      235,
      60,
      92,
      16,
      highlights.atpSynthase ? "#ffdca9" : "#f2e5d2",
      "#c6934c",
      2
    );

    drawCircle(280, 333, 24, highlights.atpSynthase ? "#ffd18a" : "#e8d7bf", "#b27b38", 2);

    drawCircle(600, 265, 86, highlights.calvin ? "#d8f1d7" : "#e4f2e4", "#83ae85", 3);
    drawCircle(600, 265, 48, "#f9fff7", "#b1d0b2", 2);

    ctx.fillStyle = "#35573f";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText("Thylakoid Membrane", 92, 110);
    ctx.fillText("Stroma", 20, 252);
    ctx.fillText("Calvin Cycle", 550, 265);
    ctx.fillText("ATP Synthase", 228, 350);
  }

  function drawCaptionGuide() {
    drawTextTag("Photosynthesis structures", 20, 26, "#dae9f9", "#335b82");
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
        drawElectron(132 + p * 25, 174 - p * 18, 1);
        drawElectron(138 + p * 18, 184 - p * 14, 0.85);
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
        for (let i = 0; i < 6; i += 1) {
          const x = 264 + (i % 3) * 14;
          const y = 240 - p * 40 - i * 3;
          drawIon(x, y, 0.85);
        }
        drawToken("ATP", 295 + p * 90, 325 - p * 32, "#fbd28a", "#8b5a17");
      }
    }),
    (p) => ({
      highlights: { ps1: true },
      draw: () => {
        drawElectron(395 + p * 55, 173 - p * 22, 1);
        drawToken("NADPH", 460 + p * 60, 125 + p * 15, "#c5e3ff", "#1f4f7f");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("ATP", 350 + p * 180, 305 - p * 40, "#fbd28a", "#8b5a17");
        drawToken("NADPH", 380 + p * 165, 190 + p * 60, "#c5e3ff", "#1f4f7f");
      }
    })
  ];

  const calvinAnimators = [
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawCO2(500 + p * 66, 182 + p * 45, 1);
        drawCO2(470 + p * 82, 205 + p * 35, 0.82);
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("RuBP", 560, 260, "#e7f5c4", "#4b6d25");
        drawToken("RuBisCO", 612 - p * 20, 232 + p * 8, "#f4e0c1", "#7b5a2d");
        drawCO2(545 + p * 25, 226 + p * 20, 0.88);
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("6C", 594, 235 + p * 15, "#fbe3e3", "#843c3c");
        drawToken("3C", 560 - p * 22, 262 + p * 15, "#e1f1ff", "#2f5f8f");
        drawToken("3C", 632 + p * 22, 262 + p * 15, "#e1f1ff", "#2f5f8f");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("ATP", 495 + p * 80, 210 + p * 20, "#fbd28a", "#8b5a17");
        drawToken("NADPH", 495 + p * 70, 275 - p * 26, "#c5e3ff", "#1f4f7f");
        drawToken("3C", 615, 272, "#e1f1ff", "#2f5f8f");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("3C", 565, 286 - p * 25, "#e1f1ff", "#2f5f8f");
        drawToken("G3P", 635, 252 + p * 8, "#d8f4da", "#2f6b38");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("G3P", 618 + p * 95, 247 - p * 28, "#d8f4da", "#2f6b38");
        drawArrow(632, 249, 710, 212, "#2f6b38");
      }
    }),
    (p) => ({
      highlights: { calvin: true },
      draw: () => {
        drawToken("RuBP", 620 - p * 33, 308 - p * 28, "#e7f5c4", "#4b6d25");
        drawArrow(623, 303, 590, 270, "#4b6d25");
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

  function drawCircle(x, y, r, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function drawPhoton(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCircle(x, y, 7, "#ffe67a", "#bf8b12", 1.3);
    ctx.restore();
  }

  function drawElectron(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCircle(x, y, 4.4, "#8bb8ff", "#2f5f8f", 1.2);
    ctx.restore();
  }

  function drawIon(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCircle(x, y, 5.2, "#f8b8d4", "#9f4f72", 1.2);
    ctx.fillStyle = "#7d2f53";
    ctx.font = "bold 9px Trebuchet MS";
    ctx.fillText("H+", x - 5, y + 3);
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
    const points = [
      [148, 176],
      [240, 145],
      [325, 205],
      [372, 176]
    ];

    for (let i = 0; i < 5; i += 1) {
      const local = Math.min(0.98, Math.max(0, progress - i * 0.11));
      const [x, y] = pointOnPolyline(points, local);
      drawElectron(x, y, 1 - i * 0.12);
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

  function wireEvents() {
    els.modeSelect.addEventListener("change", () => {
      state.mode = els.modeSelect.value;
      syncModeRules();
      renderHintLine();
    });

    els.hintsToggle.addEventListener("change", () => {
      state.hintsOn = els.hintsToggle.checked;
      renderHintLine();
    });

    els.feedbackSelect.addEventListener("change", () => {
      state.feedbackMode = els.feedbackSelect.value;
    });

    els.resetBtn.addEventListener("click", () => {
      resetState();
      render();
      drawIdleScene();
    });

    els.checkBtn.addEventListener("click", checkCurrentPhase);
    els.replayBtn.addEventListener("click", startReplay);
    els.nextBtn.addEventListener("click", goToCalvinPhase);
  }

  function init() {
    wireEvents();
    resetState();
    syncModeRules();
    render();
    drawIdleScene();
    requestAnimationFrame(animationTick);
  }

  init();
})();
