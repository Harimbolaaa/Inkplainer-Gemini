# Stickman Studio Roadmap

## Completed foundation

- Modular character model with versioned serialization.
- Hierarchical skeleton, constraints, forward kinematics, and two-segment IK.
- Multiple characters, draggable joints, mirrored poses, and pose JSON.
- Idle, walk, run, jump, combat, reaction, and fall motion evaluation.
- Scene-local Stickman tracks merged into the native Inkplainer scene.
- Shared deterministic camera/effect/keyframe math.
- 100 editable offline templates.
- Captions, local audio references, voice recording, camera presets, and
  export presets.
- Stickman rendering in scene preview, thumbnails, transitions, and export.
- Direct timestamp export paths for supported GIF, MP4, and silent WebM modes.

## Phase 1 — Workspace foundation

- Add a persistent professional workspace shell around the existing editor.
- Add resizable/collapsible panels and stored layout preferences.
- Add workspace tabs and Beginner/Expert modes.
- Add command palette, keyboard shortcut help, and tooltips.
- Keep current launch buttons as compatible entry points.

**Exit criteria:** every visible workspace control either changes real project
state or invokes an existing supported action; no decorative placeholder
buttons remain.

## Phase 2 — Character, rigging, and pose workflow

- Add contextual character and joint inspectors.
- Expose bone lengths, limits, IK/FK, pole direction, and root transforms.
- Add reusable pose library management and pose transition preview.
- Add character duplication, deletion, and collision-safe scene merging.

**Exit criteria:** two characters can be independently rigged, posed, saved,
merged into a scene, and edited without changing unrelated scene content.

## Phase 3 — Timeline Pro

- Promote Stickman track rows to first-class timeline entities.
- Support track selection, visibility, lock, reorder, trim, duplicate, delete,
  and direct keyframe manipulation.
- Add markers, snapping, zoom, in/out markers, clip loops, and frame stepping.
- Synchronize character, camera, effect, caption, and audio tracks.

**Exit criteria:** sequential and parallel actions scrub identically in preview,
thumbnail rendering, and export.

## Phase 4 — Direction, camera, and effects

- Add camera follow, focus, auto-framing, motion paths, shake, and easing.
- Add contextual effect inspectors and deterministic particle controls.
- Add scene director controls for scene order, duration, assets, and transitions.

**Exit criteria:** a multi-scene project can be directed, previewed, and
rendered with camera movement and effects without wall-clock drift.

## Phase 5 — Sound and captions

- Add local audio clip rows with trim, offset, volume, fades, and waveform
  information where available.
- Add voice recording state and resource cleanup.
- Add subtitle, speech bubble, narration, and title-card editing.
- Gate audio export on verified browser capabilities.

**Exit criteria:** local audio and captions remain synchronized in preview, and
the UI never claims audio muxing when the selected browser cannot provide it.

## Phase 6 — Export and performance

- Add Export Studio with landscape, Shorts, square, and custom presets.
- Keep frame-time rendering deterministic and cancellation-aware.
- Render in chunks where browser APIs allow it and avoid replaying preview.
- Add progress reporting based on submitted frames, not wall-clock duration.
- Validate final-frame PNG and codec fallbacks.

**Exit criteria:** preview and export match at sampled timestamps and supported
formats report truthful capabilities and limitations.

## Phase 7 — Hardening and release

- Add migration tests for projects without `scene.production`.
- Add combined legacy-layer plus Stickman render tests.
- Add persistence round-trip and import collision tests.
- Add workspace shortcut, responsive layout, and accessibility checks.
- Run stable Chromium browser regression tests and document browser support.
- Profile large timelines and high-resolution exports on ordinary hardware.

## Known limitations to keep explicit

- Browser MP4/WebM/GIF support differs by browser and OS.
- Audio-muxed MediaRecorder output may require real-time capture.
- Microphone input requires user permission and browser support.
- High-resolution rendering remains constrained by device memory and encoder
  throughput.
- Offline mode still requires a local static server for browser security APIs.

