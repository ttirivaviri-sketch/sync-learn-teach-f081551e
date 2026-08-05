/**
 * Alignment guard: frontend subject/grade lists vs the backend seeding
 * matrix must never drift apart. Profile setup stores exact strings from
 * CURRICULUM_SUBJECTS; template lookups and the bulk seeder use
 * curriculum-matrix.ts. Any mismatch = learners with empty topic trees.
 *
 * If this test fails, update BOTH:
 *   - src/types/academicProfile.ts
 *   - supabase/functions/_shared/curriculum-matrix.ts
 */
import { describe, expect, it } from "vitest";
import {
  CURRICULUM_SUBJECTS as FE_SUBJECTS,
  GRADE_LEVELS_BY_CURRICULUM as FE_GRADES,
} from "@/types/academicProfile";
import {
  CURRICULUM_SUBJECTS as BE_SUBJECTS,
  GRADE_LEVELS_BY_CURRICULUM as BE_GRADES,
  buildMatrix,
  type Curriculum as BeCurriculum,
} from "../../supabase/functions/_shared/curriculum-matrix";
import { templateSubjectCandidates } from "./subjectAliases";

const SEEDED_CURRICULA = Object.keys(BE_SUBJECTS) as BeCurriculum[];

// Frontend-only entries that intentionally have NO backend template row.
// Bare "English" is an umbrella display name — resolved to a concrete
// syllabus subject via templateSubjectCandidates before lookup.
const FE_ONLY_SUBJECTS: Record<string, string[]> = {
  ZIMSEC: ["English"],
  CAMB: [],
  IEB: [],
  NSC: [],
};

describe("curriculum alignment: frontend ↔ backend seeding matrix", () => {
  for (const curriculum of SEEDED_CURRICULA) {
    describe(curriculum, () => {
      it("every backend matrix subject exists in the frontend picker", () => {
        const fe = new Set(FE_SUBJECTS[curriculum]);
        const missing = BE_SUBJECTS[curriculum].filter((s) => !fe.has(s));
        expect(missing).toEqual([]);
      });

      it("every frontend subject is seedable (matrix entry or alias)", () => {
        const be = new Set(BE_SUBJECTS[curriculum].map((s) => s.toLowerCase()));
        const allowed = new Set(
          (FE_ONLY_SUBJECTS[curriculum] ?? []).map((s) => s.toLowerCase()),
        );
        const unseedable = FE_SUBJECTS[curriculum].filter((subject) => {
          if (be.has(subject.toLowerCase())) return false;
          // an alias that lands on a matrix subject also counts
          const viaAlias = templateSubjectCandidates(curriculum, subject)
            .slice(1)
            .some((c) => be.has(c.toLowerCase()));
          if (viaAlias) return false;
          return !allowed.has(subject.toLowerCase());
        });
        expect(unseedable).toEqual([]);
      });

      it("backend grades are a subset of frontend grades", () => {
        const fe = new Set<string>(FE_GRADES[curriculum]);
        const missing = BE_GRADES[curriculum].filter((g) => !fe.has(g));
        expect(missing).toEqual([]);
      });
    });
  }

  it("buildMatrix emits only canonical curriculum/grade/subject triples", () => {
    for (const { curriculum, grade, subject } of buildMatrix()) {
      expect(FE_GRADES[curriculum]).toContain(grade);
      expect(FE_SUBJECTS[curriculum]).toContain(subject);
    }
  });
});

describe("templateSubjectCandidates", () => {
  it("always returns the exact subject first", () => {
    expect(templateSubjectCandidates("ZIMSEC", "Mathematics")[0]).toBe("Mathematics");
    expect(templateSubjectCandidates(null, "Physics")).toEqual(["Physics"]);
  });

  it("resolves umbrella/drifted names to template subjects", () => {
    expect(templateSubjectCandidates("ZIMSEC", "English")).toEqual([
      "English",
      "English Language",
    ]);
    expect(templateSubjectCandidates("ZIMSEC", "Accounting")).toContain("Accounts");
    expect(templateSubjectCandidates("NSC", "Afrikaans")).toContain(
      "Afrikaans First Additional Language",
    );
    expect(templateSubjectCandidates("CAMB", "English")).toContain("English Language");
  });

  it("alias targets are real backend matrix subjects", () => {
    for (const curriculum of SEEDED_CURRICULA) {
      const be = new Set(BE_SUBJECTS[curriculum].map((s) => s.toLowerCase()));
      for (const subject of FE_SUBJECTS[curriculum]) {
        for (const candidate of templateSubjectCandidates(curriculum, subject).slice(1)) {
          expect(
            be.has(candidate.toLowerCase()),
            `${curriculum}: alias "${subject}" -> "${candidate}" is not a matrix subject`,
          ).toBe(true);
        }
      }
    }
  });

  it("is case-insensitive on curriculum and dedupes", () => {
    const c = templateSubjectCandidates("zimsec", "English");
    expect(c).toEqual(["English", "English Language"]);
    expect(new Set(c.map((s) => s.toLowerCase())).size).toBe(c.length);
  });
});
