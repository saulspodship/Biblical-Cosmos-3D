#!/usr/bin/env python3
"""Verify the single-URL sitemap, robots directive and root-page SEO metadata.

Dependency-free: run with `python3 scripts/verify-seo.py` from the repo root.
Exits non-zero if any acceptance check fails.
"""
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "biblicalcosmos3d.saulspodship.com"
CANONICAL = f"https://{DOMAIN}/"
SITEMAP_URL = f"https://{DOMAIN}/sitemap.xml"
SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"

OG_REQUIRED = (
    "og:title",
    "og:type",
    "og:url",
    "og:image",
    "og:site_name",
    "og:description",
)
TWITTER_REQUIRED = (
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
)

results: list[tuple[str, bool, str]] = []


def record(label: str, ok: bool, detail: str = "") -> None:
    results.append((label, bool(ok), detail))


class HeadParser(HTMLParser):
    """Collect title text, meta tags and link tags from a document."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.titles: list[str] = []
        self.metas: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self.in_title = True
            self.titles.append("")
        elif tag == "meta":
            self.metas.append(a)
        elif tag == "link":
            self.links.append(a)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title and self.titles:
            self.titles[-1] += data


def parse_head(path: Path) -> HeadParser:
    parser = HeadParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def meta_values(metas: list[dict[str, str]], key: str) -> list[str]:
    wanted = key.lower()
    values = []
    for meta in metas:
        name = (meta.get("name") or meta.get("property") or "").lower()
        if name == wanted:
            values.append(meta.get("content", "").strip())
    return values


def is_absolute_https(url: str, host: str) -> bool:
    parts = urlsplit(url)
    return parts.scheme == "https" and parts.netloc == host


# --- /sitemap.xml: valid XML, exactly one absolute https URL -----------------
sitemap_path = ROOT / "sitemap.xml"
try:
    tree = ET.parse(sitemap_path)
    root = tree.getroot()
    record("sitemap.xml parses as valid XML", root.tag == SITEMAP_NS + "urlset", root.tag)
    urls = root.findall(SITEMAP_NS + "url")
    record("sitemap.xml contains exactly one <url>", len(urls) == 1, f"{len(urls)} found")
    locs = [u.findtext(SITEMAP_NS + "loc", default="").strip() for u in urls]
    record(
        "sitemap.xml lists the canonical root URL",
        locs == [CANONICAL],
        ", ".join(locs) or "(none)",
    )
    record(
        "sitemap <loc> is an absolute https URL on this domain",
        all(is_absolute_https(loc, DOMAIN) for loc in locs),
        ", ".join(locs) or "(none)",
    )
    for url in urls:
        lastmod = url.findtext(SITEMAP_NS + "lastmod", default="").strip()
        record(
            "sitemap <lastmod> is a valid ISO 8601 date",
            bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", lastmod)),
            lastmod or "(missing)",
        )
        changefreq = url.findtext(SITEMAP_NS + "changefreq", default="").strip()
        record(
            "sitemap <changefreq> is a valid value",
            changefreq in {"always", "hourly", "daily", "weekly", "monthly", "yearly", "never"},
            changefreq or "(missing)",
        )
        priority = url.findtext(SITEMAP_NS + "priority", default="").strip()
        try:
            valid_priority = 0.0 <= float(priority) <= 1.0
        except ValueError:
            valid_priority = False
        record("sitemap <priority> is 0.0-1.0", valid_priority, priority or "(missing)")
except ET.ParseError as exc:
    record("sitemap.xml parses as valid XML", False, str(exc))

# --- /robots.txt: declares the sitemap --------------------------------------
robots_text = (ROOT / "robots.txt").read_text(encoding="utf-8")
sitemap_lines = [
    line.strip()
    for line in robots_text.splitlines()
    if line.strip().lower().startswith("sitemap:")
]
record(
    "robots.txt has the Sitemap directive",
    f"Sitemap: {SITEMAP_URL}" in sitemap_lines,
    ", ".join(sitemap_lines) or "(none)",
)
record(
    "robots.txt Sitemap URL is absolute https",
    all(is_absolute_https(line.split(":", 1)[1].strip(), DOMAIN) for line in sitemap_lines),
    ", ".join(sitemap_lines) or "(none)",
)

# --- / (index.html): canonical, title, description, OG and Twitter -----------
head = parse_head(ROOT / "index.html")
titles = [t.strip() for t in head.titles]
record("root page has exactly one <title>", len(titles) == 1, f"{len(titles)} found")
title = titles[0] if titles else ""
record("title is <= 60 characters", bool(title) and len(title) <= 60, f"{len(title)} chars: {title!r}")

other_titles: dict[str, str] = {}
for html_file in sorted(ROOT.glob("*.html")):
    if html_file.name == "index.html":
        continue
    for other in [t.strip() for t in parse_head(html_file).titles]:
        other_titles[html_file.name] = other
record(
    "title is unique across the site's HTML pages",
    title not in other_titles.values(),
    ", ".join(f"{name}: {value!r}" for name, value in other_titles.items()) or "(no other HTML pages)",
)

descriptions = meta_values(head.metas, "description")
record("root page has exactly one meta description", len(descriptions) == 1, f"{len(descriptions)} found")
description = descriptions[0] if descriptions else ""
record(
    "meta description is 120-155 characters",
    120 <= len(description) <= 155,
    f"{len(description)} chars",
)

canonicals = [
    link.get("href", "").strip()
    for link in head.links
    if "canonical" in link.get("rel", "").lower().split()
]
record(
    "root page is self-canonical",
    canonicals == [CANONICAL],
    ", ".join(canonicals) or "(none)",
)

robots_meta = " ".join(meta_values(head.metas, "robots")).lower()
record("root page is indexable (no noindex)", "noindex" not in robots_meta, robots_meta or "(none)")

for key in OG_REQUIRED + TWITTER_REQUIRED:
    values = meta_values(head.metas, key)
    record(f"root page has {key}", len(values) == 1 and bool(values[0]), ", ".join(values) or "(missing)")

for key in ("og:url", "og:image", "twitter:image"):
    values = meta_values(head.metas, key)
    record(
        f"{key} is an absolute https URL",
        len(values) == 1 and is_absolute_https(values[0], DOMAIN),
        ", ".join(values) or "(missing)",
    )

# --- vercel.json: sitemap is served with an XML content type -----------------
try:
    vercel = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    headers = vercel.get("headers", [])
    sitemap_headers = [
        h.get("value", "")
        for entry in headers
        if entry.get("source") == "/sitemap.xml"
        for h in entry.get("headers", [])
        if h.get("key", "").lower() == "content-type"
    ]
    record(
        "vercel.json serves /sitemap.xml as XML",
        any(value.lower().startswith("application/xml") for value in sitemap_headers),
        ", ".join(sitemap_headers) or "(no Content-Type)",
    )
except (OSError, json.JSONDecodeError) as exc:
    record("vercel.json is valid JSON", False, str(exc))
else:
    record("vercel.json is valid JSON", True)

# --- Report -------------------------------------------------------------------
for label, ok, detail in results:
    status = "PASS" if ok else "FAIL"
    suffix = f"  [{detail}]" if detail else ""
    print(f"{status}  {label}{suffix}")

failed = [label for label, ok, _ in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed.")
if failed:
    print("Failed: " + "; ".join(failed), file=sys.stderr)
    sys.exit(1)
