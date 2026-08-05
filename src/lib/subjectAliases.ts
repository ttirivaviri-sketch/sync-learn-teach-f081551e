/**
 * Subject-name alias resolution between frontend display lists and
 * backend `curriculum_topic_templates` rows.
 *
 * Why this exists: profile setup stores the subject string the learner
 * clicked (from CURRICULUM_SUBJECTS), and template lookups match on that
 * exact string. A handful of display names either (a) are umbrella names
 * covering a more specific template subject, or (b) drifted historically
 * between curricula ("Accounts" vs "Accounting"). When an exact template
 * row is missing, we retry with these aliases before falling back to lazy
 * AI seeding — so learners never get an empty topic tree because of a
 * naming variant.
 *
 * Keep keys lowercase. Order candidates from most to least specific.
 */

const ALIASES: Record<string, Record<string, string[]>> = {
  ZIMSEC: {
    // Umbrella name at lower forms; the exam-level syllabus splits into
    // Language / Literature. Language is the compulsory core.
    english: ["English Language"],
    // Historic drift: some flows stored "Accounting"; ZIMSEC's canonical
    // name is "Accounts". (ICT and Computer Science are DISTINCT ZIMSEC
    // subjects — never alias them to each other.)
    accounting: ["Accounts"],
  },
  CAMB: {
    english: ["English Language"],
    maths: ["Mathematics"],
    "additional maths": ["Additional Mathematics"],
    accounts: ["Accounting"],
  },
  IEB: {
    english: ["English Home Language"],
    "english home language": ["English Home Language"],
    accounts: ["Accounting"],
    "maths literacy": ["Mathematical Literacy"],
  },
  NSC: {
    english: ["English Home Language"],
    accounts: ["Accounting"],
    "maths literacy": ["Mathematical Literacy"],
    afrikaans: ["Afrikaans First Additional Language"],
  },
};

/**
 * Candidate template-subject names for a profile subject, in lookup order.
 * The exact name always comes first; aliases follow. Never returns dupes.
 */
export function templateSubjectCandidates(
  curriculum: string | null | undefined,
  subject: string,
): string[] {
  const clean = subject.trim();
  const out = [clean];
  const table = ALIASES[(curriculum ?? "").trim().toUpperCase()];
  const hits = table?.[clean.toLowerCase()] ?? [];
  for (const h of hits) {
    if (!out.some((s) => s.toLowerCase() === h.toLowerCase())) out.push(h);
  }
  return out;
}
