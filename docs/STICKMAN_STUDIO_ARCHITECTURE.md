# Stickman Studio Architecture

## Design principles

Stickman Studio is an additive production layer over Inkplainer's existing
scene/timeline/canvas system. It does not create a second renderer or replace
the legacy whiteboard editor.

## Runtime layers

### 1. Application and scene state

`TimelineStudio` remains the owner of the active scene, global playhead,
scene offsets, transitions, preview, persistence, and export. A scene may have:

```js
{
  layers: [],                 // existing Inkplainer content
  production: {
    version: 2,
    tracks: [],
    camera: {},
    effects: [],
    captions: [],
    titleCards: [],
    audioClips: [],
    markers: []
  }
}
```

`production` is optional for backward compatibility and is normalized through
`StickmanProductionCore.normalizeProduction`.

### 2. Pure Stickman domain

[stickman-core.js](../stickman-core.js) owns character data, rig topology,
joint constraints, forward kinematics, inverse kinematics, poses, mirroring,
and procedural motion. It must remain deterministic for a character and a
timestamp.

The character model contains style data, root transform, joints, bones,
optional motion, and editable keyframes. A track references a character
snapshot; pose keyframes modify the evaluated track without mutating the
library source character.

### 3. Production math

[stickman-production-core.js](../stickman-production-core.js) is the shared
math and schema layer for:

- versioned production normalization;
- track visibility, locking, ordering, and active-time filtering;
- keyframe insertion and interpolation;
- easing and timeline snapping;
- camera evaluation;
- seeded particle samples;
- safe duplication and generated IDs.

Preview, thumbnails, and export must call the same evaluation functions.

### 4. Editors and workspace adapters

The professional workspace is composed of adapters rather than independent
state stores:

- Character Studio edits library characters.
- Rigging Studio edits bones, limits, and IK settings.
- Pose Editor edits pose snapshots and pose keyframes.
- Animation Studio edits motion clips, loops, easing, and paths.
- Timeline Pro edits scene production tracks and markers.
- Camera Studio edits `production.camera`.
- Effects Studio edits `production.effects`.
- Scene Director edits scene order, duration, assets, and transitions.
- Sound Studio edits local `production.audioClips` and captions.
- Export Studio edits project export settings and invokes existing exporters.

Panels may keep transient selection/drag state, but committed changes must
mutate the shared project state and request timeline redraw/autosave.

### 5. Rendering contract

The canonical call is:

```js
renderProjectAtGlobalTime(globalTime, targetContext)
  -> scene compositor
  -> legacy layers
  -> StickmanProduction.renderAt(scene, localTime, targetContext)
  -> camera/effects/captions/transitions
```

`localTime` is derived from the scene offset, never from animation-frame
elapsed time. Export invokes the same contract at exact frame timestamps.

### 6. History and persistence

Production mutations should use `CommandHistory` snapshots or scoped commands
with explicit labels. Save operations serialize both the existing project state
and Stickman state. Imports must normalize missing fields and generate
collision-safe IDs without deleting existing scene content.

## Workspace layout

The workspace shell uses a four-region layout:

1. **Toolbar:** project context, save, undo/redo, playback, frame stepping,
   keyframe/pose actions, zoom, mode, workspace, and shortcuts.
2. **Asset/navigation rail:** characters, rigging, poses, motions, props,
   backgrounds, effects, and scene assets.
3. **Stage:** canvas, selection/joint handles, camera frame, grid, rulers,
   safe areas, zoom, and pan.
4. **Inspector/timeline:** contextual properties above a simple or advanced
   timeline. Panels can collapse or resize, and preferences are persisted.

Beginner mode hides low-value technical controls and emphasizes templates,
guided steps, and clear action labels. Expert mode exposes constraints,
curves, track details, and frame-level operations.

## Browser and offline boundaries

All computation and storage remain local. WebCodecs, MediaRecorder, microphone
input, and audio muxing are optional browser capabilities. The UI must detect
support and show a useful fallback. No AI or network request is part of the
animation pipeline.

