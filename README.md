# Biblical Cosmos 3D

Interactive 3D study of biblical cosmology — Saul's Podship.

Static site, no build step. Deploy the repo root on Vercel (or any static host).

## Layout
- `index.html` — page, SEO and the viewer markup
- `assets/cosmos.js` — the 3D engine (your original scene, unchanged) + controls
- `assets/vendor/three-r128.bundle.min.js` — three.js r128 + bloom post-processing, served locally (no CDN dependency)
- `assets/textures/*.jpg` — the original earth colour / roughness / city-light maps
- `assets/site.js`, `assets/site.css` — page chrome, loader, intro, immersive mode
- `vercel.json` — long-term caching for vendor files and textures

## Controls
Drag to orbit · click the model then scroll (or Ctrl/⌘ + scroll, or pinch) to zoom · ⛶ Immersive for full-screen with plain scroll-zoom and full touch control · Esc closes a passage card / leaves immersive.

## Local preview
`python3 -m http.server 8000` then open http://localhost:8000 (must be served over http, not opened as a file).

When you change `assets/cosmos.js`, `site.js` or `site.css`, bump the `?v=` value in `index.html` and `VERSION` in `site.js` so returning visitors get the new files.

Add `?debug` to the URL to expose `window.__cosmos` for inspection.
