# Bundled offline dependencies

These dependencies are served locally. The editor does not need a CDN or a
Google Fonts request at runtime.

- `mp4-muxer.mjs`: **mp4-muxer 5.2.2**, downloaded from its published npm package.
  Copyright 2023 Vanilagy; MIT license in `mp4-muxer.LICENSE`.
- `gsap.min.js`: **GSAP 3.13.0**, from the published npm distribution. Original
  copyright notices are retained; its standard license is in `gsap.LICENSE.txt`.
  GSAP uses its own license, not MIT. Review the restrictions on competing visual
  animation-building tools before exposing the programmatic API as an authoring UI.
- `svg.min.js`: **@svgdotjs/svg.js 3.2.5**, used to construct the workshop's
  editable basic shapes; MIT license in `svgjs.LICENSE.txt`.
- `anime.min.js`: **animejs 3.2.2**, used for the workshop's easing curves;
  MIT license in `anime.LICENSE.md`. This upstream package's bundled
  `anime.version` property reports `3.2.1`; the installed npm package is 3.2.2.
- `purify.min.js`: **DOMPurify 3.4.17**, used before imported SVG is measured or
  decoded. Its original dual MPL-2.0 / Apache-2.0 license is retained in
  `dompurify.LICENSE`.
- `gifenc.mjs`: **gifenc 1.0.3**, used by a 2–8 worker bounded pipeline in
  `svg-motion-gif-worker.js` for parallel adaptive palettes and ordered,
  incremental GIF encoding; MIT in `gifenc.LICENSE.md`.
- `fonts.css` and `fonts/*.woff2`: the Latin and Latin-extended subsets of the
  public Google Fonts already used by this editor: Caveat, DM Sans, Geist,
  Merriweather, Nunito, Patrick Hand, Permanent Marker, Roboto, and Space Mono.
  Their original license texts are bundled next to the fonts. Permanent Marker
  is Apache-2.0; the other bundled faces use the SIL Open Font License.

Upstream sources (for maintenance, not runtime access):

- https://www.npmjs.com/package/mp4-muxer/v/5.2.2
- https://fonts.google.com/
- https://github.com/google/fonts
- https://svgjs.dev/
- https://animejs.com/
- https://github.com/cure53/DOMPurify
- https://github.com/mattdesl/gifenc

The generated font stylesheet preserves the original `@font-face` descriptors,
weights, and Unicode ranges, with local `src` paths.

`svg-workshop-dependencies.json` locks the workshop packages, their exact npm
tarball sources, and SHA-256 hashes for the distributed scripts and original
licenses. The downloaded tarballs were verified against the npm registry's
integrity digests before these files were copied. The core tests verify the
shipped file hashes. All scripts are served locally; no runtime CDN or npm
installation is used.
