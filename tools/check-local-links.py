#!/usr/bin/env python3
"""Fail when a local HTML href/src target is missing from the static site."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
PROJECT_PREFIX = "/ERLIVE"
EXCLUDED = {".git", "node_modules"}


class Links(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.page = page
        self.missing = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ("href", "src") or not value:
                continue
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue

            path = unquote(url.path)
            project_absolute = path == PROJECT_PREFIX or path == PROJECT_PREFIX + "/" or path.startswith(PROJECT_PREFIX + "/")
            if path == PROJECT_PREFIX or path == PROJECT_PREFIX + "/":
                path = "index.html"
            elif path.startswith(PROJECT_PREFIX + "/"):
                path = path[len(PROJECT_PREFIX) + 1 :]

            target = ROOT / path.lstrip("/") if project_absolute or path.startswith("/") else self.page.parent / path
            if target.is_dir():
                target = target / "index.html"
            if not target.is_file():
                self.missing.append(f"{self.page.relative_to(ROOT)}: missing {key} {value}")


missing = []
for page in sorted(ROOT.rglob("*.html")):
    if EXCLUDED.intersection(page.relative_to(ROOT).parts):
        continue
    parser = Links(page)
    parser.feed(page.read_text(encoding="utf-8"))
    missing.extend(parser.missing)

print("\n".join(missing) if missing else "All local HTML href/src targets exist.")
raise SystemExit(1 if missing else 0)
