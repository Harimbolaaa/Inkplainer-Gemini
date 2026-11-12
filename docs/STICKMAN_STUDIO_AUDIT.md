# Stickman Studio Audit

## Scope

This audit covers the static Inkplainer browser application, its existing
Canvas 2D whiteboard renderer, the scene/timeline owner, persistence, export
paths, and the Stickman modules currently loaded by [index.html](../index.html).

## Current architecture

- **Application shell:** `index.html` contains the existing UI and the
  `TimelineStudio` state machine. No frontend framework or build step is
  required.
- **Legacy renderer:** `animations.js`, `studio-core.js`, `studio.js`, and
  `studio-effects.js` render the existing image, text, vector, hand, and effect
  layers. This renderer must remain the compatibility boundary.
- **Project state:** `TimelineStudio` owns scenes, active scene, playhead,
  scene offsets, transitions, timeline rendering, preview, serialization, and
  autosave. Scenes retain legacy `layers` and can additionally retain
  `production`.
- **Persistence:** serialized projects are stored locally through the existing
  browser persistence/autosave flow. The project is designed for static,
  offline-capable hosting.
- **Export:** the existing exporter supports local Canvas rendering and browser
  codec paths. Deterministic direct-frame rendering is used where the browser
  API supports it; audio-muxed MediaRecorder output remains capability- and
  timing-dependent.
- **Stickman core:** [stickman-core.js](../stickman-core.js) provides a
  serializable character model, hierarchical bones, forward kinematics,
  two-segment IK, pose operations, and deterministic motion evaluation.
- **Stickman editor:** [stickman-studio.js](../stickman-studio.js) manages
  multiple characters, joint dragging, pose keyframes, motion presets, pose
  import/export, and scene load/merge.
- **Production data:** [stickman-production-core.js](../stickman-production-core.js)
  normalizes versioned scene-local tracks, keyframes, camera data, snapping,
  track ordering, duplication, easing, and seeded effects.
- **Production UI:** [stickman-production-ui.js](../stickman-production-ui.js)
  adds templates, character tracks, captions, camera presets, local audio
  import/recording, effects, and export preset controls.
- **Templates:** [stickman-templates.js](../stickman-templates.js) supplies
  100 local, editable production starting points.

## Integration findings

The canonical Stickman production location is `scene.production`. A scene
contains legacy layers and production tracks together. The main compositor
calls the Stickman production renderer after legacy layers, so Stickman content
participates in scene preview, thumbnails, transitions, and export. The
Stickman Studio merge operation replaces only tracks marked as originating from
Stickman Studio and leaves unrelated scene content intact.

The main timeline displays Stickman rows and visibility controls, but it does
not yet expose every production operation (track trimming, keyframe editing,
locking, and contextual inspection) with the same depth as legacy layer rows.

## Strengths

1. The pure Stickman evaluator is independent of wall-clock playback.
2. Existing projects without production data remain valid.
3. Scene integration is additive rather than a destructive conversion.
4. Templates, camera, effects, captions, and audio references are local.
5. Export paths can reuse the same scene compositor used for preview.

## Gaps and risks

- The editor is still primarily a modal surface rather than a persistent
  workstation with dockable panels.
- Undo/redo is centralized for legacy edits, but Stickman mutations need
  explicit command-history adapters.
- Main-timeline Stickman editing is shallower than legacy layer editing.
- Browser codec and microphone support varies; UI must report capabilities
  instead of implying universal MP4 or audio muxing.
- Full-resolution exports can be expensive because Canvas and browser codecs
  remain device-bound even when frame timestamps are deterministic.
- Browser integration tests require a stable Chromium-compatible runtime.

## Compatibility rules

1. Do not rewrite `animations.js` to implement Stickman.
2. Keep `scene.layers` and all existing scene fields intact.
3. Treat `scene.production` as optional and normalize it on read.
4. Render through one deterministic scene-time contract.
5. Keep all assets and processing local; no AI, paid API, or mandatory service.

