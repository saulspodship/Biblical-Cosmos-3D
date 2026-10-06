# Biblical Cosmos 3D — Saul's Podship

A static, responsive website and interactive biblical-cosmology visualization. The site is prepared to publish at **https://biblicalcosmos3d.saulspodship.com/** and identifies the experience as a product of Saul's Podship.

## Run locally

Serve the repository root over HTTP (rather than opening `index.html` as a `file://` URL), for example:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Open `http://localhost:8000/`. The 3D experience starts only when its viewer approaches the viewport. It loads Three.js from cdnjs with jsDelivr as a fallback; its compressed earth textures are local under `assets/textures/`.

## Publish

Deploy the repository root as the document root for `biblicalcosmos3d.saulspodship.com` with HTTPS enabled. No build step is required. `index.html` is the entry point; the previous `Biblical Cosmos 3D.html` path redirects to it. `robots.txt` and `sitemap.xml` are already configured for the subdomain.

The page includes a canonical URL, Open Graph/Twitter metadata and image, WebApplication/Organization/FAQ structured data, and visible flat-earth/firmament context. Review the canonical URL and sitemap if the production hostname changes. Search visibility depends on indexing and is not guaranteed by metadata alone.
