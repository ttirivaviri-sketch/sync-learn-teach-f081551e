/**
 * Regression suite for the personalization matcher — ported from the
 * Who/What/Why/When audit harness that surfaced 8 findings against real
 * seed data. Each block pins a fix so it can't silently regress:
 *
 *  #1 ZIMSEC learners must see Cambridge-tagged papers (one-directional fallback)
 *  #3 Exam-tier bleed: IGCSE learners must NOT match A-Level papers (and
 *     vice versa) despite shared grade atoms
 *  #4 Bilingual subject names: "Afrikaans Eerste Addisionele Taal" seeds must
 *     match "Afrikaans First Additional Language" profiles
 *  #6 English Home Language ≠ English First Additional Language
 */
import { describe, expect, it } from "vitest";
import {
  curriculumMatches,
  gradeMatches,
  subjectMatches,
  subjectAliases,
  canonicalSubjectKey,
} from "./personalization";

// ─── #1: ZIMSEC → Cambridge one-directional fallback ────────────────────────
describe("curriculumMatches — ZIMSEC fallback to Cambridge", () => {
  it("ZIMSEC learner sees Cambridge-tagged resources", () => {
    expect(curriculumMatches("Cambridge", "ZIMSEC")).toBe(true);
    expect(curriculumMatches("CAMB", "ZIMSEC")).toBe(true);
  });

  it("is one-directional: Cambridge learner does NOT see ZIMSEC resources", () => {
    expect(curriculumMatches("ZIMSEC", "Cambridge")).toBe(false);
    expect(curriculumMatches("ZIMSEC", "IGCSE")).toBe(false);
  });

  it("ZIMSEC does not leak into CAPS/IEB", () => {
    expect(curriculumMatches("CAPS", "ZIMSEC")).toBe(false);
    expect(curriculumMatches("IEB", "ZIMSEC")).toBe(false);
  });

  it("existing synonym behavior is preserved", () => {
    expect(curriculumMatches("CAPS", "NSC")).toBe(true);
    expect(curriculumMatches("Cambridge", "IGCSE")).toBe(true);
    expect(curriculumMatches("IEB", "IEB")).toBe(true);
    expect(curriculumMatches(null, "ZIMSEC")).toBe(true); // untagged visible
  });
});

// ─── #3: Exam-tier gate (O-tier vs A-tier) ──────────────────────────────────
describe("gradeMatches — exam-tier gate", () => {
  // Real seed grade-tag variants:
  const IGCSE_TAGS = ["IGCSE", "O-Level", "Form 4"];
  const ALEVEL_TAGS = ["Form 5", "Form 6", "A-Level"];
  const OLEVEL_TAGS = ["Form 3", "Form 4", "O-Level"];

  it("IGCSE learner matches O-tier papers, not A-Level papers", () => {
    expect(gradeMatches(IGCSE_TAGS, "IGCSE")).toBe(true);
    expect(gradeMatches(OLEVEL_TAGS, "IGCSE")).toBe(true);
    expect(gradeMatches(ALEVEL_TAGS, "IGCSE")).toBe(false); // was true (bleed)
  });

  it("A-Level learner matches A-tier papers, not O-Level papers", () => {
    expect(gradeMatches(ALEVEL_TAGS, "A-Level")).toBe(true);
    expect(gradeMatches(IGCSE_TAGS, "A-Level")).toBe(false); // was true (bleed)
    expect(gradeMatches(OLEVEL_TAGS, "A-Level")).toBe(false);
  });

  it("ZIMSEC Form 4 (O-tier) matches O-Level papers, not A-Level", () => {
    expect(gradeMatches(IGCSE_TAGS, "Form 4")).toBe(true);
    expect(gradeMatches(OLEVEL_TAGS, "Form 4")).toBe(true);
    expect(gradeMatches(ALEVEL_TAGS, "Form 4")).toBe(false);
  });

  it("ZIMSEC Form 6 (A-tier) matches A-Level papers, not O-Level", () => {
    expect(gradeMatches(ALEVEL_TAGS, "Form 6")).toBe(true);
    expect(gradeMatches(IGCSE_TAGS, "Form 6")).toBe(false);
  });

  it("untiered labels (plain grades) are unaffected by the gate", () => {
    expect(gradeMatches(["Grade 12"], "Grade 12")).toBe(true);
    expect(gradeMatches(["Grade 10"], "Grade 10")).toBe(true);
    // Learner with tiered grade still matches untiered labels via atoms
    expect(gradeMatches(["Grade 10", "Grade 11"], "IGCSE")).toBe(true);
    expect(gradeMatches(["Grade 12"], "A-Level")).toBe(true);
  });

  it("mixed-tier resource labels match either tier", () => {
    // A resource spanning both tiers should be visible to both
    expect(gradeMatches(["Form 3-6"], "IGCSE")).toBe(true);
    expect(gradeMatches(["Form 3-6"], "A-Level")).toBe(true);
  });

  it("tag-tolerance preserved: empty labels / empty learner grade", () => {
    expect(gradeMatches([], "IGCSE")).toBe(true);
    expect(gradeMatches(null, "A-Level")).toBe(true);
    expect(gradeMatches(ALEVEL_TAGS, null)).toBe(true);
    expect(gradeMatches(["All Grades"], "IGCSE")).toBe(true);
  });
});

// ─── #4: Bilingual (Afrikaans/IsiZulu) subject names ────────────────────────
describe("subjectMatches — bilingual subject names", () => {
  it("Afrikaans Eerste Addisionele Taal seeds match AFAL profiles", () => {
    expect(
      subjectMatches("Afrikaans Eerste Addisionele Taal", [
        "Afrikaans First Additional Language",
      ])
    ).toBe(true);
  });

  it("bare 'Afrikaans' (IEB picker) means FAL by convention", () => {
    expect(
      subjectMatches("Afrikaans First Additional Language", ["Afrikaans"])
    ).toBe(true);
  });

  it("Afrikaans Huistaal matches Afrikaans Home Language, not FAL", () => {
    expect(
      subjectMatches("Afrikaans Huistaal", ["Afrikaans Home Language"])
    ).toBe(true);
    expect(subjectMatches("Afrikaans Huistaal", ["Afrikaans"])).toBe(false);
    expect(
      subjectMatches("Afrikaans Eerste Addisionele Taal", [
        "Afrikaans Home Language",
      ])
    ).toBe(false);
  });

  it("IsiZulu FAL matches its full name", () => {
    expect(
      subjectMatches("IsiZulu First Additional Language", [
        "IsiZulu First Additional Language",
      ])
    ).toBe(true);
  });
});

// ─── #6: English HL ≠ English FAL ───────────────────────────────────────────
describe("subjectMatches — English HL/FAL split", () => {
  it("English Home Language learner does NOT match FAL papers", () => {
    expect(
      subjectMatches("English First Additional Language", [
        "English Home Language",
      ])
    ).toBe(false);
  });

  it("English FAL learner does NOT match HL papers", () => {
    expect(
      subjectMatches("English Home Language", [
        "English First Additional Language",
      ])
    ).toBe(false);
  });

  it("bare 'English' and 'English Language' stay with HL group", () => {
    expect(subjectMatches("English Language", ["English"])).toBe(true);
    expect(subjectMatches("English Home Language", ["English"])).toBe(true);
    expect(
      subjectMatches("English as a Second Language", ["English FAL"])
    ).toBe(true);
  });

  it("subjectAliases reflects the split", () => {
    expect(subjectAliases("English Home Language")).not.toContain(
      "english first additional language"
    );
    expect(subjectAliases("English FAL")).toContain(
      "english first additional language"
    );
  });
});

// ─── Prior guarantees that must not regress ─────────────────────────────────
describe("subjectMatches — existing distinctions preserved", () => {
  it("Maths Literacy ≠ Mathematics", () => {
    expect(subjectMatches("Mathematical Literacy", ["Mathematics"])).toBe(false);
    expect(subjectMatches("Mathematics", ["Mathematical Literacy"])).toBe(false);
  });

  it("Life Orientation ≠ Life Sciences", () => {
    expect(subjectMatches("Life Orientation", ["Life Sciences"])).toBe(false);
  });

  it("Accounts (ZIMSEC) matches Accounting", () => {
    expect(subjectMatches("Accounts", ["Accounting"])).toBe(true);
  });

  it("Religion Studies matches Religious Studies group", () => {
    expect(subjectMatches("Religion Studies", ["Religious Studies"])).toBe(true);
  });

  it("empty learner subjects match nothing", () => {
    expect(subjectMatches("Mathematics", [])).toBe(false);
    expect(subjectMatches("Mathematics", null)).toBe(false);
  });

  it("Physical Sciences ↔ Physics alias preserved", () => {
    expect(subjectMatches("Physical Sciences", ["Physics"])).toBe(true);
  });
});

// ─── canonicalSubjectKey (used by exam-proximity ordering) ──────────────────
describe("canonicalSubjectKey", () => {
  it("maps aliases to the same key", () => {
    expect(canonicalSubjectKey("Maths")).toBe(canonicalSubjectKey("Mathematics"));
    expect(canonicalSubjectKey("Physical Sciences")).toBe(
      canonicalSubjectKey("Physics")
    );
    expect(canonicalSubjectKey("Afrikaans Eerste Addisionele Taal")).toBe(
      canonicalSubjectKey("Afrikaans First Additional Language")
    );
  });

  it("keeps distinct subjects distinct", () => {
    expect(canonicalSubjectKey("English Home Language")).not.toBe(
      canonicalSubjectKey("English First Additional Language")
    );
    expect(canonicalSubjectKey("Mathematics")).not.toBe(
      canonicalSubjectKey("Mathematical Literacy")
    );
  });

  it("is null/empty safe", () => {
    expect(canonicalSubjectKey(null)).toBe("");
    expect(canonicalSubjectKey("")).toBe("");
  });
});
