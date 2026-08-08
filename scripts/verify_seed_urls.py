#!/usr/bin/env python3
"""Verify candidate library-seed URLs before they are written into a migration.

Rules (from product owner): if the URL does not lead to an actual book,
past paper or novel document, it must NOT be seeded.

Verification per URL type:
  - PDFs:        HEAD/GET must return 200/206 with content-type pdf (or octet-stream)
  - HTML books:  GET must return 200 and the body must look like the book page
  - YouTube:     oEmbed endpoint must return 200 (video exists & is embeddable)

Usage: python3 scripts/verify_seed_urls.py candidates.json
  candidates.json: [{"url": "...", "type": "pdf|html|youtube", "note": "..."}]
Prints PASS/FAIL per URL, exits 1 if any FAIL.
"""
import json
import sys
import urllib.request
import urllib.parse

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) StudySyncSeedVerifier/1.0"}
TIMEOUT = 30


def fetch(url: str, method: str = "GET", rng: bool = True):
    headers = dict(UA)
    if rng and method == "GET":
        headers["Range"] = "bytes=0-2047"
    req = urllib.request.Request(url, headers=headers, method=method)
    return urllib.request.urlopen(req, timeout=TIMEOUT)


def check_pdf(url: str):
    resp = fetch(url)
    code = resp.getcode()
    ctype = resp.headers.get("Content-Type", "")
    body = resp.read(8)
    ok = code in (200, 206) and (
        "pdf" in ctype.lower()
        or "octet-stream" in ctype.lower()
        or body.startswith(b"%PDF")
    )
    return ok, f"{code} {ctype} magic={body[:5]!r}"


def check_html(url: str):
    resp = fetch(url, rng=False)
    code = resp.getcode()
    ctype = resp.headers.get("Content-Type", "")
    body = resp.read(65536).decode("utf-8", "replace").lower()
    looks_like_page = "<html" in body or "<!doctype" in body
    not_error = "page not found" not in body and "404" not in body[:200]
    ok = code == 200 and looks_like_page and not_error
    return ok, f"{code} {ctype}"


def check_youtube(url: str):
    oembed = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(url, safe="")
    resp = fetch(oembed, rng=False)
    code = resp.getcode()
    data = json.loads(resp.read().decode())
    ok = code == 200 and bool(data.get("title"))
    return ok, f"{code} title={data.get('title', '')[:60]!r}"


def check_image(url: str):
    resp = fetch(url)
    code = resp.getcode()
    ctype = resp.headers.get("Content-Type", "")
    body = resp.read(4)
    ok = code in (200, 206) and (
        "image" in ctype.lower()
        or body.startswith(b"\xff\xd8")  # JPEG
        or body.startswith(b"\x89PNG")
        or body[:4] in (b"<svg", b"<?xm")
    )
    return ok, f"{code} {ctype}"


CHECKS = {"pdf": check_pdf, "html": check_html, "youtube": check_youtube, "image": check_image}


def main(path: str) -> int:
    candidates = json.load(open(path))
    failures = 0
    for c in candidates:
        url, typ, note = c["url"], c["type"], c.get("note", "")
        try:
            ok, detail = CHECKS[typ](url)
        except Exception as exc:  # noqa: BLE001 - report any failure verbatim
            ok, detail = False, f"EXC {type(exc).__name__}: {exc}"
        status = "PASS" if ok else "FAIL"
        if not ok:
            failures += 1
        print(f"{status} | {typ:7} | {note[:40]:40} | {detail} | {url}")
    print(f"\n{len(candidates) - failures}/{len(candidates)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
