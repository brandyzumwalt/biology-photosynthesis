# Photosynthesis Sequencing Web App

Offline, browser-based learning tool for high-school biology classes.

## Current Workflow

1. **Page 1: Learn Animation**
- Students learn by stepping through the process visually before sequencing.
- Cycles available:
  - Light-Dependent Reactions (Thylakoid Membrane)
  - Calvin Cycle (Stroma)
- Controls:
  - `Start` (plays step 1)
  - `Reset` (appears after progress; returns to step 1)
  - `Previous Step`
  - `Next Step`
  - `Replay Current Step`
  - `Play Full Cycle`
- Step playback freezes on the final frame when a step ends.

2. **Page 2: Review Sequencing**
- Students drag cards from the bank into numbered slots.
- Behavior:
  - Auto-swap when dropping onto an occupied slot
  - No duplicate card placement
  - Guided feedback only (learning-focused)
- `Replay Full Cycle` is enabled after the current phase is solved.
- Calvin review unlocks after Light-Dependent review is solved.

## UI/Design State

- Dark classroom-friendly theme.
- Left-side visual key on Learn page.
- Calvin cycle shown as a directional rotating process loop in stroma (not as a physical structure).
- Review layout is viewport-aware with internal scrolling in card/slot columns.

## Fixed Settings (By Design)

- No teacher controls.
- No practice/challenge mode toggle (permanent learning mode).
- No hints toggle (guided learning flow is always active).
- No feedback mode toggle (guided feedback only).

## Run

1. Open `/Users/danny/Projects/photosynthesis/index.html` in Chrome.
2. No backend, install step, or build tools are required.

## Notes

- App state resets on page load.
- Designed for classroom laptops running Chrome without internet.
