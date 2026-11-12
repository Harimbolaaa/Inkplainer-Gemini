# ✏️ Inkplainer

**Free, open-source whiteboard animation maker that runs entirely in your browser.**

Turn images and text into hand-drawn explainer videos — no sign-up, no watermark, no cost. Upload your content, pick an animation style, hit Generate, and export as MP4 or WebM.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Support on Ko-fi](https://img.shields.io/badge/Support-Ko--fi-FF5E5B.svg?style=flat&logo=ko-fi&logoColor=white)](https://ko-fi.com/inkplainer)
[![Open Source](https://img.shields.io/badge/open%20source-yes-brightgreen.svg)](https://github.com/NadirWeb-App)
[![Browser Only](https://img.shields.io/badge/runs%20in-browser-orange.svg)]()
[![No Sign-up](https://img.shields.io/badge/no%20sign--up-required-lightgrey.svg)]()

---

## Features

- **Multiple animation styles** — Chunk Jump, Scanner, Contour, Outline Chunks, plus 7 subject-aware Specialized styles (Human, Animal, Portrait, Vehicle, Building, Landscape, Spiral)
- **Advanced drawing control** — 5 stroke styles, 4 outline detection algorithms, 3 coloring styles, and 6 image reveal animations
- **Layer system** — stack images and text layers, set animation order, animate them in sequence or in parallel
- **Smooth, adjustable hand movement** — the hand glides continuously across the canvas by default, with a switch to revert to the original snap-to-position movement if you prefer it
- **Slicer tool** — cut any image into regions using Grid, Rectangle, or Freehand mode; each region becomes its own independently animated layer
- **Text layers** — place styled text directly on the canvas with font picker, size, bold/italic, alignment, line-height, letter spacing, and color controls
- **Fast deterministic export as MP4 or WebM** — renders exact timestamps directly
  without replaying the preview; 720p, 1080p, 1440p, GIF, and custom resolutions
  are supported. Audio-muxed WebM uses the browser's real-time audio recorder
  when a project audio track is present.
- **Export final frame as PNG** — grab a still of the finished animation in one click
- **Auto-save projects** — every change is saved to your browser automatically; the Projects window shows total storage used across all your saved projects
- **Private by design** — no accounts, no analytics, no tracking; all processing happens locally on your device
- **Offline Assets & Templates** — 2,500 core editable SVG assets (scalable to 10,000+ multi-style variants across 50 categories and 9 styles), 300 composed editorial scenes with varied layouts, palettes, and art directions, and a private IndexedDB template collection
- **Native vector Pen** — draw Bézier paths, edit anchors and handles, and change SVG stroke, fill, and width
- **Property animation tracks** — independent Position X/Y, Scale, Rotation, Opacity, and Trim Paths keys, with five easing curves
- **Motion presets** — 12 editable, multi-property presets, applied by click or dragged onto a layer track
- **GSAP effect inspector** — 50 local effects in five categories, contextual controls, live previews, frame scrubbing, and saved layer effects shared by timeline playback and exports
- **SVG animation workshop** — 24 essential shapes, safe SVG import, Unicode text, 14 chainable animation steps, stagger, loops, standalone animated SVG and adaptive-palette GIF export in a local worker
- **Stickman Studio** — an integrated offline workspace for multiple procedural vector characters, constrained two-segment IK, draggable joints, mirrored poses, reusable pose keyframes, and editable idle/walk/run/jump/combat/fall motion presets
- **Stickman Workstation** — a unified state-backed shell for Character, Rigging, Pose, Animation, Timeline, Camera, Effects, Audio, Scene, and Export workflows. It provides Beginner/Expert modes, command actions, frame stepping, native scene context, and routes edits into the existing Inkplainer timeline rather than creating a separate project.

---

## Getting Started

### Run locally

```bash
# Clone the repo
git clone https://github.com/NadirWeb-App/Inkplainer-OS.git
cd inkplainer

# Serve with any static server (recommended)
npx serve .
# or
python3 -m http.server 8080
```

Then open the serving local (e.g.,`http://localhost:8080`) in your preferred browser.

A local static server is required (rather than opening `index.html` directly) due to browser CORS and Canvas security policies when processing images.

> **Important (Hosting, HTTPS & Video Export):** Inkplainer uses the WebCodecs API for video recording and encoding. Browsers only enable WebCodecs in a **Secure Context** (HTTPS or `localhost`). If you host Inkplainer on a local network using plain HTTP (for example, `http://192.168.1.100:8080`) and access it from another device, **video export will not be available**.
>
> For most users, the easiest option is to deploy Inkplainer to a static hosting service such as Cloudflare Pages or Netlify. Since Inkplainer is a fully static application, it can be hosted for free on these platforms while automatically providing HTTPS. Example deployment: https://inkplainer.pages.dev/
>
> If you prefer to self-host on your own server, you must serve the site over HTTPS (for example, using Caddy or Nginx with a TLS certificate).
>
> **Browser Support:** Inkplainer runs entirely in the browser. Chrome and Edge are recommended and support both WebM and MP4 export. Firefox and Safari automatically fall back to WebM export when MP4 is unavailable.


### Offline / Air-Gapped Hosting
The editor, SVG catalog, scene templates, fonts, and MP4 muxer are now bundled
locally. No CDN, Google Fonts request, account, or Internet connection is needed
at runtime. Copy the **whole repository**, including `vendor/`, and serve it with
a local static server as described above. Browser APIs still require `localhost`
or HTTPS for video encoding; offline support does not remove this browser rule.

`vendor/` includes the original licenses for mp4-muxer and the Latin/Latin-extended
font subsets. The SVG artwork and built-in scene compositions live in
`studio-assets.js`.

### Assets, reusable scenes, and vector drawing

- Open **Assets & Templates** in the top bar. Browse **2,500 Core SVGs** across
  **50 categories** and **10 collections**, or switch to the **10,000+ Extended
  Catalog** spanning **9 style families** (`Outline`, `Filled`, `Duotone`,
  `Hand-drawn`, `Whiteboard`, `Rounded`, `Sharp`, `Color`, `Minimal`). Search by
  name, tag, class, style, or alias, bookmark favorites, set fill/stroke colors,
  and click to insert into the current scene.
- **Scene templates** contains 300 fully composed editorial scenes across Social,
  Business, Education, Product, Story, Event, Creator, and Stickman families.
  Layouts include split, hero, diagonal, radial, cards, timeline, quote, and
  other compositions, with varied palettes and visual styles. Select a
  template to open its inspector, edit the title, subtitle, and three labels,
  then choose **Insert customized scene**. The result is a new scene
  with native editable text layers, vector artwork, and animation keys; it does
  not overwrite existing work. Text remains editable afterward from the normal
  canvas inspector.
- Enter a name and choose **Save as template** to save the complete active
  scene. **My templates** restores layer order, groups, visibility, text,
  image data, vector nodes, timing, transitions, and keyframes with fresh IDs.
  Templates live in IndexedDB, independently of individual projects.
- Choose **Pen** (shortcut **P**). Click to add anchors and drag while placing
  an anchor to create Bézier handles. Click the first anchor or **Close path**
  to close the shape. **Enter / Finish** saves it; **Esc / Cancel** discards
  the draft.
- Select a custom Pen shape and choose **Nodes** (shortcut **A**) to move
  anchors and handles. **Alt-drag** a handle to break symmetry. **Delete**
  removes the selected node. Pen drafts have local **Ctrl/Cmd+Z** undo and
  **Ctrl/Cmd+Shift+Z** or **Ctrl/Cmd+Y** redo.
- **Vector style** changes stroke color, fill, transparency, and stroke width
  for either library SVGs or custom shapes. **SVG** downloads the selected
  vector as an SVG file.

Local templates are private to this browser profile/origin. Clearing site data
deletes them, and storage quota errors are reported instead of silently losing
the saved scene. Use the normal project save workflow as well. Existing Pen
metadata and localStorage templates from the earlier Make implementation are
upgraded non-destructively; the original localStorage collection is retained.

### Advanced property tracks and motion presets

### Stickman workstation workflow

Open **Workstation** beside **Stickman Studio** to use the production flow:

1. Start in **Character Studio** or **Production Suite** and create a character,
   apply a motion, or add an editable local template.
2. Merge the result into the active scene. The scene keeps existing Inkplainer
   layers and stores Stickman content in its native `production` tracks.
3. Use **Timeline Pro** or Production Suite to reorder, hide, lock, duplicate,
   trim, delete, and add keyframes to production tracks.
4. Direct camera, effects, captions, audio, and scene transitions through the
   corresponding workspace tab.
5. Save and export through the existing Inkplainer project/export controls.

The workstation is an organizer and command surface over the existing editors:
it does not copy project state or replace the Canvas renderer. Beginner mode
shows guided actions; Expert mode exposes the stored track/camera/effects
details. Browser codec and audio support are reported by the existing exporter;
audio-muxed WebM may still require real-time capture.

### Character Builder and Rigging Studio

Inside **Stickman Studio**, the Character Builder creates independent,
versioned character assets. Use the original presets as starting points, then
edit the name, line style, head size, expression, and rig settings. Drag a
wrist or ankle on the stage to use constrained two-bone IK; the shoulder/hip,
elbow/knee, and end joint remain connected with fixed lengths unless **Allow
stretch** is enabled.

The rig controls support:

- constraints on/off, pinned hands and feet, rest-pose reset, mirroring, and
  rig validation;
- independent character duplication and deletion;
- reusable neutral, happy, angry, sad, surprised, scared, confused, and
  determined expressions;
- local circle/rectangle accessories and imported SVG `path d` accessories;
- native `.ink-character.json` export/import with new IDs on import.

Character edits are isolated by stable character IDs. **Merge into active
scene** copies the current character snapshots and poses into native
scene-local Stickman tracks without replacing unrelated Inkplainer layers.

### Stickman animation timeline

Stickman animation uses integer frames internally with the project FPS from
the main Inkplainer timeline. The dedicated production editor remembers the
last selected **Beginner** or **Advanced** mode:

- Beginner mode provides add/duplicate/delete pose, simple motion controls,
  onion-skin toggle, and scene preview.
- Advanced mode exposes independent production tracks, frame counts, track
  locking, visibility, trimming, duplication, reversal, and keyframe actions.

Pose interpolation supports linear, ease-in, ease-out, ease-in-out, smooth,
step, and cubic Bézier-style easing. Character/property tracks can carry
editable cubic paths; the same timestamp/frame evaluator is used by scene
preview, thumbnails, transitions, and export. Existing seconds-based projects
are migrated at the compatibility boundary and remain loadable.

Expand a layer using the disclosure arrow in the timeline. Each property has a
separate row with a value field, an add-key button, and draggable key diamonds:

| Property | Behavior |
| --- | --- |
| Position X / Y | Independent pixel channels |
| Scale | Percentage, including zero; scales around the layer center |
| Rotation | Degrees, around the same center anchor |
| Opacity | 0–100%, clamped during easing overshoot |
| Trim Paths | 0–100% of the SVG contours; raster layers use a reveal mask |

Changing a property field writes that property's key at the current playhead.
The toolbar's property selector controls **+ Keyframe**. Click a diamond to
edit its time, value, and **easing to the next key**: Linear, Ease In-Out,
Spring, Bounce, or Expo. Other properties keep their own keys and easing.

**Motion presets** offers 12 multi-property animations, including Dynamic
Whiteboard Draw, Smooth Slide & Scale, Elastic Pop-in, and Cinematic Pan & Fade.
Select a layer and click a preset, or drag it onto a layer track. Presets start
at the playhead, respect the layer's clip range, and replace only their affected
channels within that interval. All generated keys remain editable.

Keyed scenes use the same evaluator and native vector renderer for Restart,
Preview All, scrubbing, and GIF/WebM/MP4 capture. Unkeyed image scenes retain the
original drawing/hand animation engine. An SVG's fill fades in near the end of
its Trim Paths reveal so it does not obscure the write-on stroke.

### Stickman Studio

Open **Stickman Studio** beside the project controls to work with local,
procedural characters without an AI service or network connection. The workspace
starts with two independent characters and supports adding characters, editing
line/head styling, dragging joints with constrained IK, mirroring poses,
recording pose keyframes, applying editable motion presets, and importing or
exporting a pose JSON file. Stickman data is stored in the existing versioned
project snapshot and is ignored safely by older Inkplainer projects. The current
workspace renders stickman tracks in its dedicated Canvas 2D preview; existing
whiteboard layers and the Coordinate Mapper workflow remain unchanged.

### Production Suite

Open **Production Suite** to add editable scene-local stickman tracks from the
100-template offline catalog. Templates are tagged by category, style, and
class, and include characters, camera keyframes, effects, captions, and timing.
The suite also supports camera keyframes, deterministic Canvas effects, local
subtitle/title-card data, local audio-file import, and browser voice recording.
Audio stays in the project as local data; synchronized audio export is shown
only when the active browser encoder supports it.

Stickman tracks in the principal canvas can be selected directly. Drag inside
the character to move it, or drag a selection handle to resize it; the
transform is stored on that scene track and survives save/load. **Generate
Animation** uses the shared scene compositor whenever Stickman tracks exist,
so imported SVG/image layers and Stickman characters play together instead of
using separate playback paths.

#### Recommended scene workflow

1. Select the destination scene in the main timeline first.
2. Open **Stickman Studio**, create or edit the character, and add poses or a
   procedural motion.
3. Click **Merge into active scene**. This inserts the characters into
   `scene.production.tracks`; it does not create a legacy image layer.
4. Close Stickman Studio. The main canvas and timeline refresh immediately.
5. Press **Preview All** or **Generate Animation**. The principal compositor
   now plays the Stickman together with SVG and image layers.
6. Open **Production Suite** to edit tracks, camera, effects, and timing.

If the main canvas still shows an empty scene, check the scene selector: the
Stickman is inserted into the scene that was active when **Merge into active
scene** was clicked. Production tracks are shown as purple Stickman rows, even
when the scene has `0 layers` because legacy image layers and production
tracks are stored separately.

Clicking a purple Stickman clip now selects that character for canvas
transform editing. Scene blocks in the top **Scenes** lane can be dragged
left/right to reorder the movie; the scene duration and its production tracks
move together.

#### Camera Studio and Effects Studio

Inside **Production Suite**, the **Camera Studio** controls apply to the active
scene and are rendered by the same compositor used by the principal canvas:
choose a preset, add a keyframe at the current playhead, enable follow/focus on
the first character, and adjust shake or zoom pulse. Camera state is saved in
`scene.production.camera`, so it is included in scene preview and export.

The top of Production Suite now contains a **Live scene preview**. Add a
template, press **Play**, drag the preview playhead, and use **Stop** to return
to frame zero. This preview is the visual place to verify camera movement and
effects before using the main Inkplainer canvas or export.

The **Effects Studio** adds independent, editable effect layers. Choose a
combat, elemental, environment, or cinematic effect, click **Add effect
layer**, then edit its start, duration, opacity, visibility, and deletion from
the layer list. Effects use deterministic seeded Canvas rendering and remain
part of the active scene rather than being decorative template previews.
These controls are also available from **Workstation → Camera** and
**Workstation → Effects**, which open the same scene-owned production workflow.

### SVG animation workshop

Choose **Atelier SVG** above the canvas, or **Atelier SVG animé** inside
**Assets & Templates**. The workshop is a non-destructive draft: browsing,
importing, animating, and exporting do not change the project until you choose
an insertion/update action.

1. **Choose a motif.** Browse 24 essential shapes: circle, square, rounded
   square, rectangle, ellipse, triangle, diamond, pentagon, hexagon, octagon,
   star, sparkle, heart, arrow, chevron, plus, check, cross, line, arc, speech
   bubble, cloud, drop, and lightning. Or import/drop a local SVG, paste SVG
   code, or type multi-line text using the already bundled fonts.
2. **Customize live.** Change fill, outline, outline width, motif scale, and
   whole-object/per-element mode. Text is segmented by grapheme, so combining
   accents are not split. SVGs can retain original colors and gradients while
   using a separate drawing-outline color. Browser fallback fonts handle
   characters missing from the bundled Latin font subsets.
3. **Build the sequence.** Add any of 14 steps: Draw, Fade, Elastic Pop,
   Slide, Rise, Float, Pulse, Spin, Swing, Bounce, Wave, Wipe, Exit, and Hold.
   Each step has a duration, optional final pause, easing and, where relevant,
   movement intensity. Select a step to edit it; duplicate, reorder, or delete
   it directly in the sequence strip. Up to 64 steps are supported.
4. **Test the timing.** Use play/pause, restart, and scrubbing. Element/letter
   stagger, yoyo, and the pause between cycles all affect preview and output.
   Automatic preview respects the operating system's reduced-motion preference.
5. **Export a loop.** **GIF animé** uses adaptive 256-color palettes in a local
   Turbo pipeline: 2–8 quantization workers (based on available CPU cores)
   process a bounded frame batch in parallel, then one ordered worker streams
   the GIF. This maximizes throughput without retaining the whole raw animation
   in memory, and still provides progress and immediate cancellation. **SVG animé** exports a
   self-contained, script-free SMIL animation with vector artwork and embedded
   local fonts for text. Modern SVG-capable browsers play it without Inkplainer.
   Authoring metadata allows workshop SVGs under the import size limit to be
   reopened in the workshop with their original steps and settings.

**Looping and long projects:** the infinite-loop option controls standalone
GIF/SVG playback and workshop preview. The cycle-count field always controls
the clip duration inserted into the project. Finite standalone GIFs store one
cycle plus the GIF repeat count rather than duplicating all its frames.
**Ajouter au projet** inserts the animated layer at the active scene's
playhead and extends the scene if needed. **Ajouter à la suite** appends a new
scene at the **end of the project**, without replacing existing work. Add these
scenes progressively to build a longer film, then use the existing
GIF/WebM/MP4 project exporter. For long durations, video is the practical format.

A green **SVG** badge in the layer's timeline header reopens its source,
styles, and sequence. Updating keeps its position, dimensions, independent
keyframes, and other layers. Generated scene durations follow the updated clip
when doing so does not cut other content. Insertion, updates, and appended
scenes support undo/redo and persist in projects and local scene templates.
Playback, project scrubbing, GIF capture and video export use one deterministic
Canvas renderer; they do not record a separately running DOM animation.

**SVG import scope and limits:** static vector SVGs up to 2 MiB, with a
viewBox between 1 and 4096 units, are supported. Shapes, paths, nested transforms,
groups, common inline/stylesheet presentation declarations, gradients and local
clip references are retained. Scripts, external links, foreign HTML and
pre-existing SVG animations are removed. Embedded raster images are rejected.
Compositing groups remain grouped; very detailed SVGs (over 128 drawable
elements or a large raster-cache footprint) animate as a whole to limit memory.
This is not a general browser for arbitrary SVG/CSS applications.

Standalone GIF export is limited to 1800 frames per cycle and 500 million
processed pixels; lowering resolution or frame rate allows longer loops.
Animated SVG output is limited to 20 MiB. GIF transparency is one-bit: use a
solid background for smooth opacity fades. The preview/export background does
not replace the project's own canvas background.

All dependencies are bundled, versioned and integrity-checked:
**SVG.js 3.2.5**, **Anime.js 3.2.2**, **DOMPurify 3.4.17**, and **gifenc 1.0.3**.
The new workshop does not require GSAP; its animation curves use Anime.js.
See `vendor/README.md` and `vendor/svg-workshop-dependencies.json` for upstream
sources, licenses and SHA-256 hashes. There is no CDN or package-install step
at runtime.

### GSAP effects: visual controls and live preview

Open **Effets GSAP** in the top bar or the canvas tools, or the **GSAP** tab in Animation Studio.
The inspector stays next to the canvas instead of covering it.

1. Select an image, SVG, or text layer. In an empty scene, **Ajouter un SVG de
   test** inserts an editable rocket without replacing existing content.
2. Use the permanent **Effet à tester** selector to switch between all 50 effects,
   or expand **Catalogue des effets**. Search by name or filter by
   **Entrée**, **Sortie**, **Texte**, **Boucle**, or **Accent**. Selecting an
   effect collapses the catalog to make room for its settings.
3. Drag the visual sliders or type exact values to adjust duration, initial delay, repeat count (`-1` for an infinite loop),
   pause between repeats, and yoyo. Only applicable easing and effect-specific
   controls appear: distance, angle, blur, amplitude, scale, glow, colors,
   letter stagger, pixel grid, and other rendering parameters.
4. With **Aperçu automatique** enabled, changes immediately rebuild the
   preview without returning to the beginning on each slider movement. Running
   and paused previews retain their relative position when parameters change;
   changing the initial delay restarts the preview so its wait can be tested.
   **Rejouer**, pause/resume, stop, and the preview slider work without
   opening a console. Automatic playback starts disabled when the system
   requests reduced motion.
5. **Appliquer au calque** saves the effect. **Retirer** removes the saved
   effect, and **Réinitialiser** resets the draft settings for the selected
   effect. These actions do not remove independent keyframes.

A **GSAP** badge in each animated layer's timeline header identifies its saved
effect. Click it to select that layer and open its settings. The top-bar and
canvas shortcuts highlight while the inspector is visible, including when the
left sidebar is collapsed and reopened.

Previews are temporary and do not change a layer's editable position, size, or
opacity. Stop restores the current timeline pose. Changing layers, scrubbing the
project timeline, starting project playback, or exporting stops the temporary
preview. Applying/removing an effect supports undo/redo.

Each layer holds one saved GSAP effect. Saved effects start at the layer's
in-point plus the configured delay, compose with property keyframes, and are
bounded by the layer's out-point even when looping. Projects and local scene
templates retain the settings. Restart, Preview All, scrubbing, and GIF/WebM/MP4
capture use the same time-sampled renderer, not a separately running GSAP ticker.
Advanced text effects use glyphs on text layers and, where applicable, image
bands on raster/SVG layers.

GSAP 3.13.0 is already bundled in `vendor/`; there is no npm installation or
runtime network dependency. **Licensing:** GSAP is not covered by this project's
Apache license. Its bundled standard license restricts competing no-code visual
animation builders and requires prior written consent for prohibited uses.
Review `vendor/gsap.LICENSE.txt` and obtain any necessary permission before using
this integration in a product; the bundled copy does not provide that consent.

### Verification

This is a static project with vendored browser dependencies; there is no package build step.

```sh
node tests/check-syntax.cjs
node --test tests/studio-core.test.cjs
node --test tests/animation-effects.test.cjs
node --test tests/svg-motion-core.test.cjs
```

The browser integration suite requires Node 22+ and a local Chromium executable.
Run it against an **already running** static server:

```sh
SITE_URL=http://127.0.0.1:3000/ node --test tests/studio-browser.test.cjs
SITE_URL=http://127.0.0.1:3000/ node --test tests/animation-effects-browser.test.cjs
SITE_URL=http://127.0.0.1:3000/ node --test tests/gsap-ui-browser.test.cjs
SITE_URL=http://127.0.0.1:3000/ node --test tests/svg-workshop-browser.test.cjs
```

Set `CHROMIUM_BIN` if the executable is not named `chromium`. The suite uses an
isolated temporary browser profile, blocks external HTTPS resources, and covers
SVG decoding, native pen/node gestures, independent keys, templates, persistence,
undo/redo, playback, local video/GIF exports, and cancellation.

---

## How It Works

```
Add Layers  →  Choose Settings  →  Generate  →  Export
```

### The Mental Model

Before touching any setting, it helps to understand how the app thinks about a project:

1. **Layers** are the raw material. Every image or piece of text you add becomes its own layer. Layers stack on top of each other on the canvas.
2. **Settings** tell the app how to draw each layer. You select a layer, then configure its animation style, drawing look, speed, and hand. Every setting applies to that specific layer — not the whole project. Each layer can look completely different from the others.
3. **Generate** is the moment the app reads all layers and their settings and plays the animation live on the canvas.
4. **Export** records the animation as a video file.

When Generate runs, layers animate one after another in the order you define. As each layer finishes being drawn, it gets permanently baked into the background — it stays visible while the next layer animates on top of it.

---

### Layers

**Adding images** — use the drop zone in the top section of the right panel. Drag and drop one or more files, or click to open a file browser. Supported formats: PNG, JPG, GIF, SVG. Each file becomes its own layer, automatically scaled and centered to fit the canvas.

> PNG files with transparency work best with the Drawing tab — transparent areas give the edge-detection a clean boundary to work with.

**Adding text** — switch to the Text tab in the right panel. Click the highlighted "Click canvas to place text" button at the top of the panel, then click anywhere on the canvas to drop the text there — the button turns green while placement is active. Double-click any text layer on the canvas to edit it. Press `Ctrl+Enter` to confirm or `Escape` to cancel.

Text options:

| Option | Range |
|--------|-------|
| Font | Font picker list |
| Size | 10–400px |
| Style | Bold (B) and Italic (I) toggles |
| Alignment | Left, Center, Right |
| Line height | 0.80–2.50 |
| Letter spacing | −5 to 30 |
| Color | 8 preset swatches or custom color picker |

**The Layer List** — every layer appears in the layer list at the bottom of the right panel, top to bottom in visual stacking order. Each row has a drag handle to reorder, an eye icon to toggle visibility, a thumbnail, the layer name (click once to select, click again to rename), an Order field, and a delete button.

Selecting a layer expands its individual controls: Resize (10–300%), Opacity (0–100%), Group assignment, and Position & Size (X, Y, W, H coordinates).

**Animation Order** — the Order field on each layer controls when it animates:

- Layers animate from the lowest order number to the highest
- Layers with no order number animate after all numbered layers, in visual stack order
- Layers with the same order number animate simultaneously, in parallel

| Layer | Order | When it animates |
|-------|-------|-----------------|
| Logo | 1 | First |
| Title text | 1 | Same time as Logo |
| Background | 2 | After both Logo and Title finish |
| Chart | *(blank)* | Last, after Background |

**The Slicer** — cuts one layer into multiple new layers, each with its own independent animation. Select a layer and click the Slice button above the layer list to open it. Three modes:

- **Grid** — divides the image into a uniform grid; set Columns (1–8) and Rows (1–8)
- **Rectangles** — draw custom rectangular regions on the preview canvas
- **Freehand** — draw freehand shapes on the preview to define irregular regions

All new layers inherit the original layer's settings. The original layer is removed. Animation order can then be set on each new layer independently.

**Canvas Background** — sits behind all layers and is included in the exported video. Choose from solid colors (White, Black, None, Custom) or 10 preset textures: Notebook, Graph, Cream, Chalkboard, Soft Gradient, Warm White, Blueprint, Kraft, Dark, Linen.

---

### Settings — Animation Tab

The Animation tab is the starting point for most projects. Pick a style, optionally adjust the Chunks slider, and press Generate.

**Presets** — the Presets card sits above both tabs and saves your entire settings configuration in one click. Four built-in presets:

| Preset | Style | Hand | What it produces |
|--------|-------|------|-----------------|
| Quick Reveal | Scanner | Ghost | Fast clean reveal with no visible hand |
| Sketch Artist | Contour | Hand 1 | Slow artistic contour with a charcoal stroke feel |
| Blueprint | Outline Only | Ghost | Technical drafting lines on a dark background |
| Illustrated | Illust Fill | Hand 1 | Full illustrated look with color fills |

You can also save up to 6 custom presets by clicking "+ Save current settings" at the bottom of the Presets card.

**Smooth Hand Movement** — just below the Presets card, above the Animation/Drawing tab buttons, is a "Smooth hand movement" switch (on by default). With it on, the hand glides continuously between positions instead of snapping — most noticeable at higher Hand Speed settings. Turn it off for the original snap-to-position movement. This is a browser-saved device preference, not a per-project setting.

**Basic styles:**

| Style | What it does |
|-------|-------------|
| **Chunk Jump** *(Default)* | Divides canvas into tiles; each tile pops into view one at a time. Rapid and energetic. |
| **Scanner** | Image revealed in horizontal bands sweeping left to right, top to bottom. Includes a Zigzag toggle to alternate scan direction. |
| **Contour** | Two phases: first traces the visible silhouette pixel by pixel, then fills the interior with tight zigzag hatching strokes. |
| **Outline Chunks** | Detects edges, groups them into chunks, and draws each chunk one at a time. |

The **Chunks slider (6–80)** appears for Chunk Jump and Outline Chunks. Low values (6–15) = large chunks that appear quickly. High values (50–80) = many small tiles building up gradually.

**Specialized styles** — use the same reveal engine as Chunk Jump but apply a subject-aware spatial priority map so the drawing order feels natural for that type of subject:

| Style | Drawing order | Best for |
|-------|--------------|----------|
| Human | Head → shoulders → torso → legs | Full-body illustrations of people |
| Animal | Left (head) → right (tail) | Side-profile illustrations of animals |
| Portrait | Eyes/nose center → radiates outward | Close-up face portraits and headshots |
| Vehicle | Front (left) → rear (right) | Side-profile illustrations of cars, trucks, aircraft |
| Building | Foundation → roof | Architectural illustrations and building diagrams |
| Landscape | Sky/horizon → midground → foreground | Nature scenes and environmental illustrations |
| Spiral | Visual center → outward in a spiral | Circular compositions, centered logos |

> Use Basic styles for abstract graphics, charts, and icons. Use Specialized styles when the image has a clear real-world subject. A Chunks value of 30–40 is a good starting point for Specialized styles.

---

### Settings — Drawing Tab

The Drawing tab controls how the drawing *looks* — stroke character, outline detection quality, coloring fills, and image reveal. It works differently from the Animation tab in one important way: **the Drawing tab never reveals the original image during the drawing process**. Instead, it actively draws strokes, outlines, and fills from scratch — interpreting your image's edges and colors as drawing instructions. The result is a drawn version of your image, not the original.

> The Drawing tab works best with clear illustrations, cartoon-style art, and vector-style images with well-defined edges. For photographs, the Animation tab is the better choice.

> The Drawing tab's outline/fill algorithms are heavier than the Animation tab and can briefly make the interface look stuck on slower machines, depending on your settings. Watch the top bar — a small pulsing "Working…" indicator appears there while a Drawing-tab animation is generating. As long as it's pulsing, the app is working, not frozen.

**Outline Animation Modes:**

| Mode | What it does |
|------|-------------|
| **Outline Fill** | Detects and draws outlines as strokes, then optionally reveals the original image on top |
| **Illust Fill** | Like Outline Fill but adds a coloring pass after drawing — fills regions to mimic flat color illustration |
| **Outline Only** | Draws outlines on the canvas background with no image shown at any point. Pure line drawing result. No "Reveal original image" option |
| **✏ Text** | Designed for images of text — logos, title cards, handwritten words. Draws in a chosen direction |

**Stroke Style:**

| Style | Character |
|-------|----------|
| **Default 🖊** | Clean, uniform whiteboard marker line. Consistent thickness, no texture |
| **Charcoal ✏️** | Soft, thick, dusty strokes with a gritty texture — like a life-drawing study |
| **Sketch 〰** | Four faint overlapping passes along the same path — mimics exploratory strokes before committing to a line |
| **Fountain 🪶** | Variable line weight — thin on fast strokes, thick on slow curves. Calligraphic quality |
| **Blueprint 📐** | Crisp light-blue technical drafting lines. Designed to pair with the Blueprint canvas background |

**Coloring Style** (applies to the coloring pass in Illust Fill):
- **Sparse** — minimal uneven coverage, loose sketchy quality
- **Filled** *(Default)* — complete color coverage, solid and clean
- **Watercolor** — soft translucent color that bleeds slightly beyond outlines, painterly and organic

**Outline Detection Slider (0–100):**

| Range | Sensitivity | Best for |
|-------|-------------|----------|
| 0–30 | Strict | Bold, clean outlines — graphic art, cartoons, simple diagrams |
| 40–60 | Balanced | Default range — works on most images. Start here |
| 70–100 | Fine | Thin, faint, low-contrast strokes — pencil sketches, watercolor art |

**Detection Algorithm:**

| Algorithm | How it works | Best for |
|-----------|-------------|----------|
| **Classic** *(Default)* | Balanced edge pickup for dark outlines on light backgrounds | Most illustrations, logos, diagrams, photographs |
| **Adaptive** | Analyzes small regions independently for local contrast | Uneven lighting, textured backgrounds, complex photographs |
| **Morph Shell** | Erodes shapes and uses the difference as the border | Cartoons and anime with solid color regions |
| **Canny+** | Links edge fragments into continuous lines | Vector illustrations, line drawings, crisp graphic design |

**Fill Options** (visible when Outline Fill or Illust Fill is selected) — controls what happens after the drawing phase, including 6 image reveal animations (Instant, Fade, Dissolve, Wipe, Iris, Scanlines) and Outline Overlay settings (visibility, opacity, color, thickness).

**Outline Only Options** (available for Outline Only, Outline Fill, and Illust Fill modes) — two options tailored for users who try to use the Drawing tab with photographs (though the Animation tab is highly recommended for photos instead):
- **Color Region Outlines** — finds boundaries between solid-color regions rather than fine ink lines.
- **Real Image Edges** — gradient-based edge detection tuned for photographic content. Pair with a strict detection sensitivity (20–40) to reduce clutter.
> *Note:* These options are mutually exclusive. Enabling one automatically disables the other.

**Text Draw Options** (available when the **✏ Text** animation mode is selected):
- **Start Direction** — Left→Right (default), Right→Left, Top→Bottom, Bottom→Top. Controls which part of the text image animates first.
- **Fill Style** — *Reveal* (text appears progressively), *Outline* (traces letterform borders), or *Outline + Fill* (traces then fills the interior).

---

### Bottom Bar

The bottom bar contains global settings that apply to the whole animation.

**Hand Style** — the graphic that moves across the canvas during animation, selling the "someone is drawing this" illusion. Options: Ghost (no hand graphic), Hand 1, Hand 2, Hand 3, Pen, Cartoon, Pixel Art. There is no functional difference between them beyond appearance. To change *how* the hand moves rather than how it looks, see the Smooth Hand Movement switch above the Animation/Drawing tabs.

**Speed Controls:**
- **Reveal Speed (1–100)** — how many pixels of image content are revealed per animation tick. The primary control for how long the animation takes
- **Hand Speed (1–20)** — how fast the hand graphic moves across the canvas, independently of reveal speed

> Reveal Speed is most effective in the Animation tab where it directly controls how fast the original image is uncovered. In the Drawing tab it controls the pace of stroke rendering — it still works, but the relationship is less direct.

**Canvas Size:**

| Resolution | 16:9 | 9:16 | 1:1 |
|-----------|------|------|-----|
| **720p** *(Default)* | 1280 × 720 | 720 × 1280 | 720 × 720 |
| **1080p** | 1920 × 1080 | 1080 × 1920 | 1080 × 1080 |
| **1440p** | 2560 × 1440 | 1440 × 2560 | 1440 × 1440 |

> Set your canvas size at the start of a project. Changing it after adding and positioning layers will rescale and re-center everything automatically.

---

### Generate and Export

**Generate** — pinned at the bottom of the left sidebar. Reads all layers and their settings, builds the animation from scratch, and begins playing it on the canvas. Every setting change requires a new Generate to take effect.

**Playbar** — appears below the canvas once an animation has been generated:
- **⟳ Restart** — stops and regenerates from the beginning
- **▶ / ⏸ Play / Pause** — also triggered by `Space`
- **Progress bar** — click anywhere to seek to that point
- **% display** — current position. 0% = blank canvas, 100% = final frame
- **Done badge** — green badge at 100%, confirming the animation completed

**Export Video** — click in the top bar to open the export banner.

| Format | Best for |
|--------|----------|
| **WebM** *(Recommended)* | YouTube, website embeds, most editing workflows |
| **MP4 (H.264)** | Wider compatibility outside the browser — Chrome and Edge only |

| Quality | Bitrate | Use when |
|---------|---------|----------|
| High | 8 Mbps | Final delivery, large screens, archiving |
| Medium *(Default)* | 4 Mbps | General use |
| Low | 2 Mbps | Quick sharing, drafts |

Click **Start Recording**, let the animation play through to the Done badge, and the browser downloads the file automatically.

> Do not switch browser tabs or minimize the window while recording — some browsers throttle background tabs and can drop frames or corrupt the export.

**Export checklist:**
- Canvas size and aspect ratio are correct for your target platform
- All layers are visible (eye icon on each layer)
- Animation order is set correctly
- You have watched the full animation at least once after the last Generate
- The Done badge appeared, confirming it completed without errors
- Format and quality are set appropriately

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause |
| `Delete` or `Backspace` | Remove selected layer (when not typing) |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + Y` | Redo (alternative) |
| `Escape` | Cancel text placement or close text editor without saving |
| `Ctrl/Cmd + Enter` | Confirm and close the text editor |

> You cannot undo while the animation is playing. Pause or restart first.

---

## Coordinate Mapper Tool

Inkplainer ships with default hand graphics that move across the canvas during animation. The **Coordinate Mapper Tool** is a companion utility used to configure how those hand images are mapped — where the tip of each hand is, how it aligns to drawing strokes, and how it moves.

This is the tool used to set up the default hands included in the project. If you want to **replace the default hands with your own images**, you will need it.

> 📹 A tutorial video and guide for the Coordinate Mapper Tool will be added to this repo. Watch [releases](https://github.com/NadirWeb-App/inkplainer/releases) or [issues](https://github.com/NadirWeb-App/inkplainer/issues) for updates.

---

## Project Structure

```
inkplainer/
├── index.html                     # Main app UI, layout, and interaction logic
├── animations.js                  # All animation algorithms and rendering engine
├── LICENSE                        # Apache 2.0
├── README.md                      # This file
├── PRIVACY.md                     # Privacy policy
├── site.webmanifest               # Web application manifest file
├── social-preview.svg             # Social preview card image
├── Coordinate Mapper Tool V3.html # Hand coordinates configuration utility
├── images/                        # Default hand graphics used during animation
│   └── [hand image files]
└── pages/
    └── docs.html                  # Full user documentation page
```

---

## Contributing

Contributions are welcome. If you find a bug, have a feature idea, or want to improve the docs, open an issue or a pull request.

- **Bug reports** — open an [issue](https://github.com/NadirWeb-App/inkplainer/issues) with steps to reproduce
- **Feature requests** — open an issue describing what you want and why
- **Pull requests** — keep changes focused; one thing per PR

The codebase is split between `index.html` (UI and interaction) and `animations.js` (rendering engine and animation algorithms). Both files use clearly marked `═══` comment section headers — search for the section you need.

---

## Privacy

Inkplainer has no backend. Your images, text, and exported videos never leave your device. Projects are stored in your browser's IndexedDB. No analytics, no accounts, no tracking.

See [PRIVACY.md](PRIVACY.md) for the full policy.

---

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

© 2026 Nadir
### Expert Stickman Studio

The local Stickman Studio now opens as an Expert workspace with searchable
production templates, scene-local track controls, timeline markers, camera
keyframes, deterministic procedural effects, captions, local audio import,
browser voice recording, and landscape/Shorts/square export presets. Production
state is versioned and remains in the project snapshot; media is kept local.

### Expert Studio workflow

1. Open **Production Suite**.
2. Select a template and click **Add to current scene**. This creates editable
   character tracks, motion, camera, effects, and captions in the active scene;
   it does not export a finished video automatically.
3. Use **Preview this scene** or **Edit characters** to inspect and change the
   result. Track controls can hide, duplicate, or reorder character tracks.
4. Add captions, camera keyframes, markers, and local audio as needed.
5. Apply a Landscape, Shorts, or Square preset, then use the main **Export
   Video** control to produce the final file.

### Stickman Studio workflow

1. Open **Stickman Studio**. The header shows the currently selected project
   scene; this editor is not a separate project.
2. Create characters with **Create character**, select them in the library, and
   edit name, color, line width, and head size.
3. Drag joints on the canvas. Wrist and ankle movement uses constrained IK.
   Use **+ Pose** at different timeline times to build editable poses.
4. Apply idle, walk, run, jump, punch, kick, fall, or reaction motion. Mirror
   or delete the pose at the current time when refining the animation.
5. Click **Send to active scene**. The characters and saved poses become
   editable character tracks in the selected project scene. Open Production
   Suite to preview, reorder, hide, or duplicate those tracks.
6. Use **Load from scene** to bring existing Stickman character tracks back into
   the editor. Changes are local and saved with the project; use **Export
   Video** only after the scene is ready.

Stickman tracks are native scene content: they render in the main canvas beside
legacy image and text layers, appear as purple `S` tracks in the timeline, and
are included in thumbnails, transitions, preview, and video export. Sending
from Stickman Studio merges characters into the active scene without deleting
existing canvas layers.

The shared `stickman-production-core.js` evaluator is used for normalized tracks,
keyframe interpolation, snapping, camera values, and seeded effect samples so
scrubbing and export can use the same timestamp contract.

Audio export remains capability-gated: importing and recording audio are
available locally, but synchronized audio muxing is only enabled when the
browser's encoder path is verified.
