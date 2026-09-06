#!/usr/bin/env python3
"""Build a verified IEB past-paper seed migration from the public
jacquesamsel/pastpaperbank GitHub archive (the backing store of
pastpaperbank.com, an open community archive of IEB NSC papers).

Pipeline:
  1. Read the repo git tree (JSON from
     https://api.github.com/repos/jacquesamsel/pastpaperbank/git/trees/master?recursive=1)
  2. Keep English PDFs under papers/ieb/<Subject>/<Year>/en/
  3. Classify each filename into question paper vs memo vs skippable extra
     (answer sheets, inserts, formula sheets, info booklets, addenda, ...).
     Two filename generations exist:
       - 2017-2018/2022 style: "Paper 1.pdf", "Paper 1 Memo.pdf", "Memo.pdf"
       - 2019-2023 style:      "Accounting P1 2019.pdf", "NSC Accounting P1 Memo 2023.pdf"
  4. Pair question papers with their memos on (subject, year, paper_no).
  5. Verify EVERY raw.githubusercontent.com URL serves %PDF magic bytes
     (ranged GET, bytes 0-63) before it is allowed into the seed.
  6. Emit an idempotent INSERT ... SELECT ... WHERE NOT EXISTS migration.

Usage:
  python3 scripts/build_ieb_paper_seed.py --tree /tmp/ppseed/ieb_tree.json \
      --out /tmp/ppseed/seed_ieb.sql [--skip-verify]
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import sys
import urllib.parse
import urllib.request

RAW_BASE = "https://raw.githubusercontent.com/jacquesamsel/pastpaperbank/master/"

# Non-exam extras that must never be seeded as papers.
SKIP_KW = re.compile(
    r"(answer\s*sheet|answer\s*book|insert|formula\s*sheet|information\s*book"
    r"|info\s*book|information\s*sheet|addendum|data\s*sheet|diagram\s*sheet"
    r"|source\s*material|instructions?\s*(?:to|for)\s*teachers|mark\s*sheet"
    r"|appendix|errata|corrigendum|annexure|supplement|reading\s*list"
    r"|question\s*book|resource\s*pack|sal\s+paper)",
    re.I,
)

# Repo directory name -> canonical StudySync subject name.
SUBJECT_CANON = {
    "Marine Scoences": "Marine Sciences",  # repo typo
    "Advanced Programme Maths": "Advanced Programme Mathematics",
    "AP Maths": "Advanced Programme Mathematics",
    "Afrikaans FAL": "Afrikaans First Additional Language",
    "Afrikaans HL": "Afrikaans Home Language",
    "English FAL": "English First Additional Language",
    "English HL": "English Home Language",
    "IsiXhosa FAL": "IsiXhosa First Additional Language",
    "IsiZulu FAL": "IsiZulu First Additional Language",
    "IsiZulu HL": "IsiZulu Home Language",
    "Life Science(s)": "Life Sciences",
    "Life Science": "Life Sciences",
}

# Subjects we seed. Keep this focused on mainstream Grade 12 subjects that
# StudySync students actually search for (matches CAPS seed coverage).
SEED_SUBJECTS = {
    "Accounting",
    "Advanced Programme Mathematics",
    "Afrikaans First Additional Language",
    "Business Studies",
    "Computer Applications Technology",
    "Consumer Studies",
    "Dramatic Arts",
    "Economics",
    "Engineering Graphics and Design",
    "English First Additional Language",
    "English Home Language",
    "Geography",
    "History",
    "Information Technology",
    "IsiZulu First Additional Language",
    "Life Orientation",
    "Life Sciences",
    "Mathematical Literacy",
    "Mathematics",
    "Music",
    "Physical Sciences",
    "Technical Mathematics",
    "Technical Sciences",
    "Tourism",
    "Visual Arts",
}

PAPER_NO_RE = re.compile(r"\b(?:Paper\s+|P)(\d)\b", re.I)
MEMO_RE = re.compile(r"\bmemo\b", re.I)


def canon_subject(name: str) -> str:
    return SUBJECT_CANON.get(name, name)


def classify(tree_paths):
    """Return {(subject, year, paper_no): {'qp': path, 'memo': path}}."""
    entries = {}
    skipped = []
    unmatched = []
    for path in tree_paths:
        parts = path.split("/")
        if len(parts) != 6 or parts[0] != "papers" or parts[1] != "ieb":
            continue
        _, _, subj_dir, year_s, lang, fn = parts
        if lang != "en" or not fn.lower().endswith(".pdf"):
            continue
        if not year_s.isdigit():
            continue
        year = int(year_s)
        stem = fn[:-4].strip()
        if SKIP_KW.search(stem):
            skipped.append(path)
            continue
        subject = canon_subject(subj_dir)
        is_memo = bool(MEMO_RE.search(stem))
        m = PAPER_NO_RE.search(stem)
        pno = int(m.group(1)) if m else None
        if pno is None:
            # Single-paper subjects: "Business Studies 2020.pdf",
            # "NSC Consumer Studies 2023.pdf", bare "Memo.pdf" etc.
            # Accept only if the stem is basically <subject>[ Memo][ YYYY].
            core = re.sub(r"^NSC\s+", "", stem)
            core = re.sub(r"\s+\d{4}$", "", core)
            core = re.sub(r"\s+Memo$", "", core, flags=re.I)
            if is_memo and core in ("", "Memo"):
                pno = 1  # bare "Memo.pdf"
            elif core.lower() == subj_dir.lower() or core.lower() == subject.lower():
                pno = 1
            else:
                unmatched.append(path)
                continue
        key = (subject, year, pno)
        slot = entries.setdefault(key, {})
        role = "memo" if is_memo else "qp"
        # Prefer the shorter/cleaner filename if duplicates exist
        if role not in slot or len(fn) < len(slot[role].split("/")[-1]):
            slot[role] = path
    return entries, skipped, unmatched


def raw_url(path: str) -> str:
    return RAW_BASE + urllib.parse.quote(path)


def check_pdf(url: str) -> bool:
    try:
        req = urllib.request.Request(
            url, headers={"Range": "bytes=0-63", "User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read(64).startswith(b"%PDF")
    except Exception:
        return False


def sql_quote(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


THUMB_COLORS = ["1d4ed8", "0f766e", "7c3aed", "b91c1c", "0369a1", "9333ea"]


def build_rows(entries):
    rows = []
    for (subject, year, pno), slot in sorted(entries.items()):
        if subject not in SEED_SUBJECTS:
            continue
        if "qp" not in slot:
            continue  # memo without a question paper: not useful alone
        title = f"IEB {subject} — November {year} Paper {pno}"
        color = THUMB_COLORS[hash(subject) % len(THUMB_COLORS)]
        short = subject if len(subject) <= 22 else subject[:20].rstrip()
        thumb = (
            f"https://placehold.co/600x800/{color}/ffffff?text="
            + urllib.parse.quote(f"IEB {short} P{pno} {year}")
        )
        memo_part = " with marking guidelines (memo)" if "memo" in slot else ""
        desc = (
            f"IEB National Senior Certificate {subject} November {year} "
            f"question paper {pno}{memo_part}. Mirrored from the open "
            f"pastpaperbank.com community archive."
        )
        rights = (
            "IEB National Senior Certificate examination paper. Copyright "
            "Independent Examinations Board; linked from the open "
            "pastpaperbank community archive "
            "(github.com/jacquesamsel/pastpaperbank) for personal exam "
            "practice."
        )
        rows.append(
            {
                "title": title,
                "subject": subject,
                "year": year,
                "pno": pno,
                "pdf": raw_url(slot["qp"]),
                "memo": raw_url(slot["memo"]) if "memo" in slot else None,
                "thumb": thumb,
                "desc": desc,
                "rights": rights,
            }
        )
    return rows


def emit_sql(rows, out_path):
    lines = []
    for r in rows:
        memo_sql = sql_quote(r["memo"]) if r["memo"] else "NULL"
        lines.append(
            "  ({title}, 'past_paper', {subject}, NULL, 'IEB', ARRAY['Grade 12'], "
            "{pdf}, NULL, {thumb}, {desc}, {year}, 'November', {pno}, {memo}, {rights})".format(
                title=sql_quote(r["title"]),
                subject=sql_quote(r["subject"]),
                pdf=sql_quote(r["pdf"]),
                thumb=sql_quote(r["thumb"]),
                desc=sql_quote(r["desc"]),
                year=r["year"],
                pno=sql_quote(f"Paper {r['pno']}"),
                memo=memo_sql,
                rights=sql_quote(r["rights"]),
            )
        )
    body = ",\n".join(lines)
    sql = f"""INSERT INTO public.library_system_resources
  (title, kind, subject, topic, curriculum, grade_levels, pdf_url, video_url,
   thumbnail_url, description, paper_year, paper_session, paper_number,
   marking_scheme_url, rights_note)
SELECT v.title, v.kind, v.subject, v.topic, v.curriculum, v.grade_levels,
       v.pdf_url, v.video_url, v.thumbnail_url, v.description, v.paper_year,
       v.paper_session, v.paper_number, v.marking_scheme_url, v.rights_note
FROM (VALUES
{body}
) AS v(title, kind, subject, topic, curriculum, grade_levels, pdf_url,
       video_url, thumbnail_url, description, paper_year, paper_session,
       paper_number, marking_scheme_url, rights_note)
WHERE NOT EXISTS (
  SELECT 1 FROM public.library_system_resources r
  WHERE r.title = v.title AND r.curriculum = v.curriculum
);
"""
    with open(out_path, "w") as f:
        f.write(sql)
    print(f"wrote {len(rows)} rows -> {out_path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tree", required=True, help="repo tree JSON path")
    ap.add_argument("--out", required=True, help="output SQL fragment path")
    ap.add_argument("--skip-verify", action="store_true")
    ap.add_argument("--workers", type=int, default=24)
    args = ap.parse_args()

    tree = json.load(open(args.tree))
    paths = [t["path"] for t in tree["tree"] if t["type"] == "blob"]
    entries, skipped, unmatched = classify(paths)
    rows = build_rows(entries)
    print(
        f"classified: {len(entries)} paper slots, {len(skipped)} extras skipped, "
        f"{len(unmatched)} unmatched; {len(rows)} candidate rows"
    )
    if unmatched:
        for p in unmatched[:20]:
            print("  unmatched:", p, file=sys.stderr)

    if not args.skip_verify:
        urls = []
        for r in rows:
            urls.append(r["pdf"])
            if r["memo"]:
                urls.append(r["memo"])
        print(f"verifying {len(urls)} URLs ...")
        results = {}
        with concurrent.futures.ThreadPoolExecutor(args.workers) as ex:
            for url, ok in zip(urls, ex.map(check_pdf, urls)):
                results[url] = ok
        bad = [u for u, ok in results.items() if not ok]
        print(f"verified: {len(urls) - len(bad)} OK, {len(bad)} BAD")
        kept = []
        for r in rows:
            if not results.get(r["pdf"]):
                print("  DROP row (qp bad):", r["title"], file=sys.stderr)
                continue
            if r["memo"] and not results.get(r["memo"]):
                print("  drop memo only:", r["title"], file=sys.stderr)
                r["memo"] = None
                r["desc"] = r["desc"].replace(" with marking guidelines (memo)", "")
            kept.append(r)
        rows = kept

    emit_sql(rows, args.out)


if __name__ == "__main__":
    main()
