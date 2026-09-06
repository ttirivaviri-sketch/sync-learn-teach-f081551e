#!/usr/bin/env python3
"""Build a verified NSC (CAPS) past-paper seed from official DBE index pages.

Pipeline (mirrors scripts/build_channel_seed.py for videos):
  1. Feed it locally saved DBE session index pages (education.gov.za), e.g.
     "2024 November NSC Examination Papers". Each page groups fileticket
     download links under <h2>subject</h2> headings.
  2. Parse subject sections -> classify each anchor (question paper vs memo,
     paper number, language edition). Only English / combined-language
     editions are kept; provincial SAL variants, answer books and addenda
     are skipped.
  3. Pair every question paper with its marking guideline (memo) by
     (subject, paper number).
  4. Verify EVERY pdf_url and marking_scheme_url actually serves a PDF
     (ranged GET, %PDF magic bytes) before it is allowed into the seed --
     product rule: "if the path doesn't lead into a PDF don't seed it".
  5. Emit an idempotent INSERT ... WHERE NOT EXISTS migration.

Usage:
  python3 scripts/build_dbe_paper_seed.py \
      --page 2024:November:/tmp/ppseed/dbe2024.html \
      --page 2024:June:/tmp/ppseed/dbe_2024MayJune.html \
      ... \
      --out /tmp/ppseed/seed_dbe.sql
"""

from __future__ import annotations

import argparse
import concurrent.futures
import html as htmllib
import json
import re
import sys
import urllib.request

BASE = "https://www.education.gov.za"

# DBE heading -> canonical StudySync subject name (matches existing seeds).
SUBJECTS = {
    "Accounting": "Accounting",
    "Agricultural Sciences": "Agricultural Sciences",
    "Business Studies": "Business Studies",
    "Computer Application Technology": "Computer Applications Technology",
    "Consumer Studies": "Consumer Studies",
    "Economics": "Economics",
    "Geography": "Geography",
    "History": "History",
    "Information Technology": "Information Technology",
    "Life Orientation": "Life Orientation",
    "Life Sciences": "Life Sciences",
    "Mathematical Literacy": "Mathematical Literacy",
    "Mathematics": "Mathematics",
    "Physical Sciences": "Physical Sciences",
    "Religion Studies": "Religion Studies",
    "Technical Mathematics": "Technical Mathematics",
    "Technical Sciences": "Technical Sciences",
    "Tourism": "Tourism",
    # Language subjects use "<Lang> <level> P<n>" anchor text instead.
    "English": None,
    "Afrikaans": None,
}

LANG_SUBJECT_MAP = {
    ("English", "HL"): "English Home Language",
    ("English", "FAL"): "English First Additional Language",
    ("Afrikaans", "HL"): "Afrikaans Huistaal",
    ("Afrikaans", "FAL"): "Afrikaans Eerste Addisionele Taal",
}

RIGHTS = (
    "Official National Senior Certificate examination paper published by the "
    "South African Department of Basic Education (education.gov.za). State "
    "examination material linked from the official source for personal exam "
    "practice."
)


def parse_page(path: str):
    """Return {subject_heading: [(anchor_text, url), ...]} for one DBE page."""
    src = open(path, encoding="utf-8", errors="ignore").read()
    heads = [
        (m.start(), htmllib.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip())
        for m in re.finditer(r"<h2[^>]*>(.*?)</h2>", src, re.S)
    ]
    out: dict = {}
    for m in re.finditer(
        r'<a\s[^>]*href="(/LinkClick\.aspx\?fileticket=[^"]+)"[^>]*>(.*?)</a>',
        src,
        re.S,
    ):
        href = BASE + m.group(1).replace("&amp;", "&")
        txt = " ".join(
            htmllib.unescape(re.sub(r"<[^>]+>", "", m.group(2))).split()
        )
        if not txt or txt.lower() == "download" or "forcedownload" in href:
            continue
        subj = None
        for hp, ht in heads:
            if hp < m.start():
                subj = ht
            else:
                break
        if subj:
            out.setdefault(subj, []).append((txt, href))
    return out


GENERIC_RE = re.compile(
    r"^(Paper|Memo)\s+(\d)\s*\(([^)]*)\)$", re.I
)
LANG_RE = re.compile(
    r"^(English|Afrikaans)\s+(HL|FAL)\s+P(\d)(\s+memo)?$", re.I
)


def classify(subject_heading: str, anchors):
    """Yield (subject, paper_no, kind, url) where kind is 'qp' or 'memo'."""
    for txt, href in anchors:
        canonical = SUBJECTS.get(subject_heading)
        if canonical:
            m = GENERIC_RE.match(txt)
            if not m:
                continue  # addendum / answer book / provincial variant
            what, num, langs = m.group(1).lower(), m.group(2), m.group(3).lower()
            if "english" not in langs:
                continue
            yield canonical, int(num), ("qp" if what == "paper" else "memo"), href
        elif subject_heading in ("English", "Afrikaans"):
            m = LANG_RE.match(txt)
            if not m:
                continue
            lang, level, num, is_memo = (
                m.group(1),
                m.group(2).upper(),
                int(m.group(3)),
                bool(m.group(4)),
            )
            subj = LANG_SUBJECT_MAP.get((lang, level))
            if subj:
                yield subj, num, ("memo" if is_memo else "qp"), href


def check_pdf(url: str) -> bool:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-1023"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            head = r.read(1024)
            return head[:5] == b"%PDF-" or b"%PDF-" in head[:64]
    except Exception:
        return False


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--page",
        action="append",
        required=True,
        help="YEAR:SESSION:HTMLPATH e.g. 2024:November:/tmp/dbe2024.html",
    )
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=12)
    args = ap.parse_args()

    # (subject, year, session, paper_no) -> {"qp": url, "memo": url}
    papers: dict = {}
    for spec in args.page:
        year_s, session, path = spec.split(":", 2)
        year = int(year_s)
        page = parse_page(path)
        for heading, anchors in page.items():
            if heading not in SUBJECTS:
                continue
            for subj, num, kind, url in classify(heading, anchors):
                key = (subj, year, session, num)
                papers.setdefault(key, {})
                # first link wins (duplicate anchors exist on some pages)
                papers[key].setdefault(kind, url)

    # only keep entries that have a question paper
    entries = {k: v for k, v in papers.items() if "qp" in v}
    print(f"candidate papers: {len(entries)}", file=sys.stderr)

    # verify all URLs
    urls = set()
    for v in entries.values():
        urls.add(v["qp"])
        if "memo" in v:
            urls.add(v["memo"])
    print(f"verifying {len(urls)} URLs ...", file=sys.stderr)
    ok: dict = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(check_pdf, u): u for u in urls}
        done = 0
        for f in concurrent.futures.as_completed(futs):
            ok[futs[f]] = f.result()
            done += 1
            if done % 100 == 0:
                print(f"  {done}/{len(urls)}", file=sys.stderr)
    bad = [u for u, v in ok.items() if not v]
    print(f"verified OK: {len(urls) - len(bad)}, failed: {len(bad)}", file=sys.stderr)

    rows = []
    for (subj, year, session, num), v in sorted(entries.items()):
        if not ok.get(v["qp"]):
            continue
        memo = v.get("memo")
        if memo and not ok.get(memo):
            memo = None
        sess_label = "May/June" if session == "June" else session
        title = f"NSC {subj} — {sess_label} {year} Paper {num}"
        desc = (
            f"Official DBE National Senior Certificate {subj} "
            f"{sess_label} {year} question paper {num}"
            + (" with marking guidelines (memo)." if memo else ".")
        )
        thumb_text = urllib.request.quote(f"{subj[:18]} P{num} {year}")
        thumb = f"https://placehold.co/600x800/16a34a/ffffff?text={thumb_text}"
        rows.append(
            "  ('%s', 'past_paper', '%s', NULL, 'CAPS', ARRAY['Grade 12'], "
            "'%s', NULL, '%s', '%s', %d, '%s', 'Paper %d', %s, '%s')"
            % (
                sql_escape(title),
                sql_escape(subj),
                v["qp"],
                thumb,
                sql_escape(desc),
                year,
                sess_label,
                num,
                ("'%s'" % memo) if memo else "NULL",
                sql_escape(RIGHTS),
            )
        )

    print(f"seed rows: {len(rows)}", file=sys.stderr)
    with open(args.out, "w") as f:
        f.write(
            "INSERT INTO public.library_system_resources\n"
            "  (title, kind, subject, topic, curriculum, grade_levels, pdf_url, video_url,\n"
            "   thumbnail_url, description, paper_year, paper_session, paper_number,\n"
            "   marking_scheme_url, rights_note)\n"
            "SELECT v.title, v.kind, v.subject, v.topic, v.curriculum, v.grade_levels,\n"
            "       v.pdf_url, v.video_url, v.thumbnail_url, v.description, v.paper_year,\n"
            "       v.paper_session, v.paper_number, v.marking_scheme_url, v.rights_note\n"
            "FROM (VALUES\n"
        )
        f.write(",\n".join(rows))
        f.write(
            "\n) AS v(title, kind, subject, topic, curriculum, grade_levels, pdf_url,\n"
            "        video_url, thumbnail_url, description, paper_year, paper_session,\n"
            "        paper_number, marking_scheme_url, rights_note)\n"
            "WHERE NOT EXISTS (\n"
            "  SELECT 1 FROM public.library_system_resources r\n"
            "  WHERE r.title = v.title AND r.curriculum = v.curriculum\n"
            ");\n"
        )


if __name__ == "__main__":
    main()
