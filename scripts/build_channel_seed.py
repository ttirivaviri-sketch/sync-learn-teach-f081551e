#!/usr/bin/env python3
"""Build a library_system_resources seed migration from yt-dlp channel dumps.

Used for: IGCSE on Fingertips + Cognito (2026-09-05).

Pipeline:
  1. Read yt-dlp --flat-playlist -j JSONL dumps.
  2. Classify each video -> subject / topic / grade_levels (exclude promos).
  3. Verify EVERY video via YouTube oEmbed (embeddable + alive) — product
     rule: unverified URLs must never be seeded (see verify_seed_urls.py).
  4. Emit idempotent INSERT ... WHERE NOT EXISTS migration SQL.

curriculum is NULL on purpose (same as the Kevin Math Science seed):
the personalization matcher treats untagged curriculum as cross-curriculum,
while grade_levels + subject still scope visibility. This is exactly right
here because IGCSE / Cambridge O-Level / ZIMSEC O-Level are the same level
(Cambridge: "O Level ... equivalent to Cambridge IGCSE and UK GCSE";
ZIMSEC O-Level is the localized descendant of Cambridge O-Level), and the
app already encodes Form 4 <-> Grade 10/11 <-> O-Level <-> IGCSE equivalence
in src/lib/personalization.ts grade atoms.

Usage:
  python3 scripts/build_channel_seed.py <cognito.jsonl> <fingertips.jsonl> <out.sql>
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) StudySyncSeedVerifier/1.0"}

# ── Promo / non-lesson exclusion ────────────────────────────────────────────
PROMO_RE = re.compile(
    r"app & website launched|cognito platform|questions website|^important\b"
    r"|testimonial|learn smarter with expert tutors|describe .* in one word"
    r"|reshaped my teaching|threshold|a level launch|exam qs launch"
    r"|reach the highest levels",
    re.I,
)

# ── Topic classification (keyword -> topic), first match wins ──────────────
MATH_TOPICS = [
    (r"trigonometr|sohcahtoa|sine rule|cosine rule|sin, cos|3d trig", "Trigonometry"),
    (r"differentiat|stationary point|maxima|minima|calculus|gradient of a curve", "Calculus"),
    (r"vector", "Vectors"),
    (r"probabilit|tree diagram|venn", "Probability"),
    (r"statistic|histogram|cumulative frequency|box plot|mean|median|scatter", "Statistics"),
    (r"quadratic|simultaneous|inequalit|algebra|factoris|expand|indices|surd|sequence|nth term|iteration|proof|function", "Algebra"),
    (r"graph|parabol|hyperbol|cubic|exponential graph|straight line|y=|coordinate", "Functions & Graphs"),
    (r"circle theorem|geometr|angle|polygon|congruen|similar|pythagoras|bearing|loci|construction|transformation|translation|rotation|reflection|enlargement", "Geometry"),
    (r"bound|accuracy|estimat|rounding|standard form|scientific notation", "Number"),
    (r"fraction|decimal|percentage|ratio|proportion|prime|factor|multiple|lcm|hcf|bodmas|number system|rational|irrational|negative number|mixed number", "Number"),
    (r"mensuration|area|volume|perimeter|surface area|circle(?!.*theorem)|cylinder|cone|sphere", "Mensuration"),
    (r"money|interest|financial|growth and decay|currency", "Financial Mathematics"),
    (r"set(s| notation| theory)|matrices|matrix", "Sets & Matrices"),
    (r"paper|non.?calc|exam|test your skills|revision", "Exam Practice"),
]
PHYSICS_TOPICS = [
    (r"wave|refraction|reflection|diffraction|lens|light|sound|electromagnetic spectrum|emr", "Waves"),
    (r"electric|circuit|current|voltage|resist|ohm|charge|static|electromagnet|motor|generator|transformer|induction", "Electricity & Magnetism"),
    (r"force|motion|newton|momentum|velocity|acceleration|speed|free body|moment|pressure|hooke|terminal velocity|projectile|stopping distance", "Forces & Motion"),
    (r"energy|work done|power|efficiency|kinetic energy|potential energy|conduction|convection|radiation(?!.*nuclear)|thermal|heat|specific heat|latent", "Energy & Thermal Physics"),
    (r"nuclear|radioactiv|atom(ic)? (structure|model)|isotope|fission|fusion|half.?life|alpha|beta|gamma", "Atomic & Nuclear Physics"),
    (r"space|star|universe|solar system|red.?shift|big bang|orbit|satellite", "Space Physics"),
    (r"density|matter|solid|liquid|gas|particle|kinetic theory|gas law|brownian", "Matter & Particles"),
    (r"paper|exam|mcq|revision|cram|worksheet", "Exam Practice"),
]
CHEM_TOPICS = [
    (r"organic|alkane|alkene|alcohol|carboxylic|polymer|crude oil|hydrocarbon|fuel|ester", "Organic Chemistry"),
    (r"mole|reacting mass|stoichiometr|empirical|molar|concentration|titration|yield|limiting", "Stoichiometry & The Mole"),
    (r"electrolysis|electrochem|cell|anode|cathode", "Electrochemistry"),
    (r"acid|base|alkali|ph|salt|neutralis", "Acids, Bases & Salts"),
    (r"periodic|group 1|group 7|group 0|transition|alkali metal|halogen|noble", "Periodic Table"),
    (r"bond|ionic|covalent|metallic|structure|giant|lattice|intermolecular|states of matter|particle|diffusion|electronic configuration|atoms combining", "Atomic Structure & Bonding"),
    (r"rate|kinetic|catalyst|equilibri|reversible|haber|contact process", "Rates & Equilibrium"),
    (r"energetic|enthalpy|exothermic|endothermic|energy change", "Energetics"),
    (r"metal|extraction|reactivity|corrosion|rust|alloy", "Metals & Reactivity"),
    (r"redox|oxidation|reduction", "Redox"),
    (r"separat|filtration|distillation|chromatograph|purity|mixture|test for|analysis|planning question", "Experimental Techniques"),
    (r"air|water|atmosphere|pollution|carbon dioxide|greenhouse|environment", "Chemistry of the Environment"),
    (r"rock|earth", "Earth Chemistry"),
    (r"paper|exam|revision|syllabus review", "Exam Practice"),
]
BIO_TOPICS = [
    (r"cell|microscope|mitosis|meiosis|stem cell|organelle|diffusion|osmosis|active transport", "Cell Biology"),
    (r"photosynthe|leaf|plant.*(transport|structure)|xylem|phloem|transpiration|translocation|stomata", "Plant Biology"),
    (r"digest|enzyme|nutrition|diet|food test|absorption", "Nutrition & Digestion"),
    (r"respir|breathing|ventilation|lung|gas exchange|anaerobic|aerobic|glycolysis|krebs|oxidative|link reaction|fermentation", "Respiration & Gas Exchange"),
    (r"circulat|heart|blood|vessel|artery|vein", "Circulation"),
    (r"nervous|neuron|reflex|synapse|brain|eye|receptor|hormone|homeostasis|kidney|excretion|glucose regulation|thermoregulation", "Coordination & Homeostasis"),
    (r"reproduc|pregnan|menstrual|fertilis|flower|pollinat|germination", "Reproduction"),
    (r"inherit|genetic|dna|gene|chromosome|allele|variation|mutation|evolution|natural selection|selective breeding|phylogeny|classif|kingdom|species|domain", "Genetics & Evolution"),
    (r"ecolog|ecosystem|food (chain|web)|biodiversity|conservation|population|sampling|carbon cycle|nitrogen cycle|human impact|pollution|pyramid", "Ecology"),
    (r"disease|pathogen|immun|vaccin|antibiotic|drug|microorganism|bacteria|virus", "Disease & Immunity"),
    (r"paper|exam|revision", "Exam Practice"),
]
PSYCH_TOPICS = [
    (r"memory", "Memory"),
    (r"development|piaget", "Development"),
    (r"social|conformity|obedience", "Social Influence"),
    (r"neuropsych|brain", "Neuropsychology"),
    (r"psychological problem|depression|addiction", "Psychological Problems"),
    (r"perception", "Perception"),
    (r"research|study|method", "Research Methods"),
]
ECON_TOPICS = [
    (r"production possibility|ppc", "Basic Economic Problem"),
    (r"demand|supply|price|market", "Demand & Supply"),
    (r"paper|exam|mcq", "Exam Practice"),
]

TOPIC_MAPS = {
    "Mathematics": MATH_TOPICS,
    "Physics": PHYSICS_TOPICS,
    "Chemistry": CHEM_TOPICS,
    "Biology": BIO_TOPICS,
    "Psychology": PSYCH_TOPICS,
    "Economics": ECON_TOPICS,
}

# Grade tags understood by src/lib/personalization.ts:
#   'O-Level' + 'IGCSE' atoms overlap Form 4 / Grade 10 / Grade 11 learners
#   (ZIMSEC O-Level, Cambridge O-Level and IGCSE learners all match).
OLEVEL_GRADES = ["O-Level", "IGCSE", "Form 4"]
ALEVEL_GRADES = ["A-Level", "Form 5", "Form 6"]
KS3_GRADES = ["Form 1", "Form 2", "Form 3", "Grade 8", "Grade 9"]


def classify_topic(subject: str, title: str) -> str:
    t = title.lower()
    for pattern, topic in TOPIC_MAPS.get(subject, []):
        if re.search(pattern, t):
            return topic
    return "General"


def classify_cognito(title: str):
    """Returns (subject, level, grades) or None to skip."""
    t = title.lower()
    if PROMO_RE.search(t):
        return None
    m = re.match(r"^(gcse(?: & ks3)?|a-level|ks3)\s+(maths|physics|biology|chemistry)", t)
    if m:
        level, subj = m.group(1).split(" ")[0], m.group(2)
        subject = {"maths": "Mathematics", "physics": "Physics",
                   "biology": "Biology", "chemistry": "Chemistry"}[subj]
        if level == "gcse":
            return subject, "GCSE/IGCSE/O-Level", OLEVEL_GRADES
        if level == "a-level":
            return subject, "A-Level", ALEVEL_GRADES
        return subject, "KS3 (Forms 1-3)", KS3_GRADES
    if t.startswith("psychology"):
        return "Psychology", "GCSE/IGCSE/O-Level", OLEVEL_GRADES
    # Untagged Cognito titles are GCSE-level lessons (verified by sampling:
    # "What is Standard Form", "Electrolysis Part 1/3", "Atoms & Ions", ...).
    if re.search(r"diffusion|microscope|kingdoms|digestive|circulatory|ventilation|reproduction|respiration|binary fission", t):
        return "Biology", "GCSE/IGCSE/O-Level", OLEVEL_GRADES
    if re.search(r"electrolysis|atoms & ions|atoms and ions", t):
        return "Chemistry", "GCSE/IGCSE/O-Level", OLEVEL_GRADES
    if re.search(r"sun, stars", t):
        return "Physics", "GCSE/IGCSE/O-Level", OLEVEL_GRADES
    if re.search(r"fraction|bodmas|prime|standard form|lcm|common factor|multiples and factors|proportion|mixed number|trigonometry|translation|volume|frustum|cylinder|prism|estimate|round(ing)? (numbers|decimals)|significant figures|square root", t):
        return "Mathematics", "GCSE/IGCSE/O-Level", OLEVEL_GRADES
    return None


def classify_fingertips(title: str):
    t = title.lower()
    if PROMO_RE.search(t):
        return None
    # Cambridge syllabus codes are authoritative when present.
    subject = None
    if re.search(r"0580|(?<!add )math|trigonometry|vectors|bounds|differentiation", t):
        subject = "Mathematics"
    if re.search(r"0625|9702|physics|electromagnetism|refraction of light", t):
        subject = "Physics"
    if re.search(r"0620|9701|chem|mole|polymer|equilibrium|electrochemistry|bonding|enthalpy|lattice energy|atoms combining|states of matter|paper 6 planning", t):
        subject = "Chemistry"  # 0620 Paper 6 = alternative-to-practical (planning Qs)
    if re.search(r"0455|econom", t):
        subject = "Economics"
    if re.search(r"9709|statistics 1|pure math", t):
        subject = "Mathematics"
    if subject is None:
        return None
    if re.search(r"\b(as|al|a.?level)\b|9701|9702|9709", t):
        return subject, "AS/A-Level", ALEVEL_GRADES
    return subject, "IGCSE/O-Level", OLEVEL_GRADES


def check_oembed(vid: str) -> bool:
    url = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(
        f"https://www.youtube.com/watch?v={vid}", safe="")
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.getcode() == 200
    except Exception:
        return False


def fmt_duration(seconds) -> str:
    try:
        s = int(float(seconds))
    except (TypeError, ValueError):
        return ""
    return f"{max(1, round(s / 60))} min"


def esc(s: str) -> str:
    return s.replace("'", "''")


def main():
    cognito_path, fingertips_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    rows = []

    for path, chan, classify in (
        (cognito_path, "Cognito", classify_cognito),
        (fingertips_path, "IGCSE on Fingertips", classify_fingertips),
    ):
        kept = skipped = 0
        for line in open(path):
            v = json.loads(line)
            title = (v.get("title") or "").strip()
            vid = v.get("id")
            if not title or not vid:
                continue
            c = classify(title)
            if c is None:
                skipped += 1
                continue
            subject, level, grades = c
            topic = classify_topic(subject, title)
            dur = fmt_duration(v.get("duration"))
            if level in ("GCSE/IGCSE/O-Level", "IGCSE/O-Level"):
                desc = f"{chan} — {topic}" + (f" · {dur}" if dur else "") + \
                       ". Covers IGCSE / Cambridge O-Level / ZIMSEC O-Level (equivalent level)."
            elif level == "AS/A-Level" or level == "A-Level":
                desc = f"{chan} — {topic} (A-Level)" + (f" · {dur}" if dur else "") + \
                       ". Cambridge & ZIMSEC A-Level aligned."
            else:
                desc = f"{chan} — {topic} (Forms 1-3 / KS3)" + (f" · {dur}" if dur else "") + "."
            rows.append({
                "id": vid, "title": title, "subject": subject, "topic": topic,
                "grades": grades, "desc": desc, "chan": chan,
            })
            kept += 1
        print(f"{chan}: kept {kept}, skipped {skipped}", file=sys.stderr)

    # Verify embeddability (concurrent oEmbed).
    print(f"Verifying {len(rows)} videos via oEmbed...", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=16) as ex:
        ok_flags = list(ex.map(lambda r: check_oembed(r["id"]), rows))
    dropped = [r["id"] for r, ok in zip(rows, ok_flags) if not ok]
    rows = [r for r, ok in zip(rows, ok_flags) if ok]
    print(f"oEmbed verified: {len(rows)} pass, {len(dropped)} dropped: {dropped}",
          file=sys.stderr)

    # Emit migration.
    values = []
    for r in rows:
        grades_sql = "ARRAY[" + ",".join(f"'{g}'" for g in r["grades"]) + "]"
        values.append(
            f"    ('{esc(r['title'])}', '{esc(r['subject'])}', '{esc(r['topic'])}', "
            f"NULL, {grades_sql}, "
            f"'https://www.youtube.com/watch?v={r['id']}', "
            f"'https://i.ytimg.com/vi/{r['id']}/hqdefault.jpg', "
            f"'{esc(r['desc'])}')"
        )
    header = """-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: "IGCSE on Fingertips" + "Cognito" YouTube channels (verified 2026-09-05).
--
-- IGCSE on Fingertips (youtube.com/channel/UClUJDjG-WzsDszQ6ViUybaw):
--   Cambridge IGCSE (0580 Maths, 0620 Chemistry, 0625 Physics, 0455 Economics)
--   and AS/A-Level (9701/9702/9709) full lessons, revision and solved papers.
-- Cognito (youtube.com/@Cognitoedu):
--   GCSE/IGCSE-level Maths, Physics, Chemistry, Biology + A-Level Biology,
--   Psychology and KS3 lessons.
--
-- LEVEL EQUIVALENCE (verified against Cambridge International):
--   IGCSE == Cambridge O-Level == UK GCSE, grade for grade ("Cambridge O Level
--   ... is equivalent to Cambridge IGCSE and the UK GCSE" — Cambridge Intl).
--   ZIMSEC O-Level is the localized descendant of Cambridge O-Level and sits
--   at the same level with overlapping topic coverage in Maths & Sciences.
--   The app already encodes this: personalization.ts grade atoms map
--   Form 4 <-> Grade 10/11 <-> O-Level <-> IGCSE.
--
-- curriculum is NULL on purpose (cross-curriculum, same as the Kevin Math
-- Science seed): grade_levels + subject still scope visibility, so IGCSE,
-- Cambridge O-Level AND ZIMSEC O-Level learners all see the O-Level-tagged
-- clips, while A-Level clips only reach Form 5/6 / A-Level learners.
--
-- Every URL verified live via YouTube oEmbed (exists + embeddable) before
-- seeding, per the verify_seed_urls.py product rule.
-- Idempotent: keyed on video_url, safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

WITH seed (title, subject, topic, curriculum, grade_levels, video_url, thumbnail_url, description) AS (
  VALUES
"""
    footer = """
)
INSERT INTO public.library_system_resources
  (title, kind, subject, topic, curriculum, grade_levels, video_url, thumbnail_url, description)
SELECT s.title, 'video', s.subject, s.topic, s.curriculum, s.grade_levels,
       s.video_url, s.thumbnail_url, s.description
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.library_system_resources r
  WHERE r.video_url = s.video_url
);
"""
    with open(out_path, "w") as f:
        f.write(header + ",\n".join(values) + footer)
    print(f"Wrote {len(rows)} rows -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
