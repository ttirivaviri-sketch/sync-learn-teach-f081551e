import { describe, expect, it } from "vitest";
import { parseCurriculumImport, summarizeTemplate } from "./curriculumImport";

const validTopic = {
  name: "Algebra",
  subtopics: ["Linear equations"],
  learning_objectives: ["Solve linear equations in one variable"],
  key_concepts: ["balance method"],
  assessment_objectives: ["AO1: recall techniques"],
  typical_question_styles: ["3-mark structured"],
  exam_weight: 15,
  prerequisites: ["Number"],
  common_misconceptions: ["sign errors when moving terms"],
  exemplar_question_stems: ["Solve 3x + 5 = 20."],
};

const validTemplate = {
  curriculum: "ZIMSEC",
  grade: "Form 4",
  subject: "Mathematics",
  topics: [validTopic],
};

describe("parseCurriculumImport", () => {
  it("accepts a single template object", () => {
    const r = parseCurriculumImport(JSON.stringify(validTemplate));
    expect(r.issues).toEqual([]);
    expect(r.templates).toHaveLength(1);
    expect(r.templates[0].topics[0].name).toBe("Algebra");
  });

  it("accepts an array and a { templates: [...] } wrapper", () => {
    const arr = parseCurriculumImport(JSON.stringify([validTemplate]));
    expect(arr.templates).toHaveLength(1);
    const wrapped = parseCurriculumImport(
      JSON.stringify({ templates: [validTemplate] }),
    );
    expect(wrapped.templates).toHaveLength(1);
    expect(wrapped.issues).toEqual([]);
  });

  it("rejects invalid JSON and empty input without throwing", () => {
    expect(parseCurriculumImport("{not json").issues[0].message).toMatch(
      /Invalid JSON/,
    );
    expect(parseCurriculumImport("   ").issues[0].message).toBe("Input is empty");
  });

  it("normalises curriculum case and rejects unknown curricula", () => {
    const ok = parseCurriculumImport(
      JSON.stringify({ ...validTemplate, curriculum: "zimsec" }),
    );
    expect(ok.templates[0].curriculum).toBe("ZIMSEC");

    const bad = parseCurriculumImport(
      JSON.stringify({ ...validTemplate, curriculum: "EDEXCEL" }),
    );
    expect(bad.templates).toHaveLength(0);
    expect(bad.issues[0].message).toMatch(/Unknown curriculum/);
  });

  it("requires grade, subject and non-empty topics", () => {
    const r = parseCurriculumImport(
      JSON.stringify({ curriculum: "IEB", grade: "", subject: "", topics: [] }),
    );
    expect(r.templates).toHaveLength(0);
    const paths = r.issues.map((i) => i.path);
    expect(paths).toContain("templates[0].grade");
    expect(paths).toContain("templates[0].subject");
  });

  it("rejects topics missing a name and bad exam_weight", () => {
    const noName = parseCurriculumImport(
      JSON.stringify({ ...validTemplate, topics: [{ subtopics: [] }] }),
    );
    expect(noName.templates).toHaveLength(0);
    expect(noName.issues[0].path).toBe("templates[0].topics[0].name");

    const badWeight = parseCurriculumImport(
      JSON.stringify({
        ...validTemplate,
        topics: [{ ...validTopic, exam_weight: 250 }],
      }),
    );
    expect(badWeight.templates).toHaveLength(0);
    expect(badWeight.issues[0].message).toMatch(/between 0 and 100/);
  });

  it("rejects duplicate topic names within a template", () => {
    const r = parseCurriculumImport(
      JSON.stringify({
        ...validTemplate,
        topics: [validTopic, { ...validTopic, name: "  algebra " }],
      }),
    );
    expect(r.templates).toHaveLength(0);
    expect(r.issues[0].message).toMatch(/Duplicate topic name/);
  });

  it("rejects duplicate (curriculum, grade, subject) combos but keeps valid siblings", () => {
    const other = { ...validTemplate, subject: "Physics" };
    const r = parseCurriculumImport(
      JSON.stringify([validTemplate, validTemplate, other]),
    );
    expect(r.templates).toHaveLength(2);
    expect(r.issues[0].message).toMatch(/Duplicate combination/);
  });

  it("cleans string arrays (trims, drops non-strings and empties)", () => {
    const r = parseCurriculumImport(
      JSON.stringify({
        ...validTemplate,
        topics: [
          { ...validTopic, subtopics: ["  ok  ", "", 42, null, "also ok"] },
        ],
      }),
    );
    expect(r.issues).toEqual([]);
    expect(r.templates[0].topics[0].subtopics).toEqual(["ok", "also ok"]);
  });

  it("summarizeTemplate reports counts", () => {
    const r = parseCurriculumImport(JSON.stringify(validTemplate));
    expect(summarizeTemplate(r.templates[0])).toBe(
      "ZIMSEC · Form 4 · Mathematics — 1 topics, 1 exemplar stems",
    );
  });
});
