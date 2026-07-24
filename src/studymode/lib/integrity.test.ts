/**
 * Threshold-contract tests for session integrity scoring.
 * These pin the "reliable threshold" behaviour: harmless behaviour must
 * never flag, sustained patterns must.
 */
import { describe, it, expect } from "vitest";
import {
  pasteSimilarity,
  flaggedQuestions,
  summarizeIntegrity,
  AWAY_FLAG_MS,
  AWAY_IGNORE_MS,
  type IntegrityEvent,
} from "./integrity";

const at = new Date().toISOString();

describe("pasteSimilarity", () => {
  it("scores 1 when the whole answer was pasted", () => {
    expect(pasteSimilarity("The mitochondria is the powerhouse", "The mitochondria is the powerhouse")).toBe(1);
  });

  it("scores low when only a small term was pasted", () => {
    const answer =
      "The mitochondria is the powerhouse of the cell because it produces ATP through cellular respiration in eukaryotes";
    expect(pasteSimilarity("ATP", answer)).toBeLessThan(0.2);
  });

  it("handles empty inputs", () => {
    expect(pasteSimilarity("", "answer")).toBe(0);
    expect(pasteSimilarity("paste", "")).toBe(0);
  });

  it("falls back to token overlap when the answer was edited after pasting", () => {
    const pasted = "photosynthesis converts light energy into chemical energy";
    const answer = "So basically photosynthesis converts light energy into chemical energy for the plant";
    expect(pasteSimilarity(pasted, answer)).toBeGreaterThan(0.5);
  });
});

describe("flaggedQuestions", () => {
  it("ignores short glances (notifications)", () => {
    const events: IntegrityEvent[] = [
      { q: 1, type: "tab_hidden", at, away_ms: AWAY_IGNORE_MS + 500 },
    ];
    expect(flaggedQuestions(events).size).toBe(0);
  });

  it("flags sustained absences", () => {
    const events: IntegrityEvent[] = [
      { q: 2, type: "tab_hidden", at, away_ms: AWAY_FLAG_MS },
    ];
    expect(flaggedQuestions(events).has(2)).toBe(true);
  });

  it("flags copy-then-leave even for shorter absences", () => {
    const events: IntegrityEvent[] = [
      { q: 3, type: "question_copied", at },
      { q: 3, type: "tab_hidden", at, away_ms: AWAY_IGNORE_MS + 1000 },
    ];
    expect(flaggedQuestions(events).has(3)).toBe(true);
  });

  it("ignores short pastes (formulas/symbols)", () => {
    const events: IntegrityEvent[] = [
      { q: 1, type: "paste", at, paste_len: 10, paste_similarity: 1 },
    ];
    expect(flaggedQuestions(events).size).toBe(0);
  });

  it("ignores long pastes with low similarity to the final answer", () => {
    const events: IntegrityEvent[] = [
      { q: 1, type: "paste", at, paste_len: 200, paste_similarity: 0.3 },
    ];
    expect(flaggedQuestions(events).size).toBe(0);
  });

  it("flags long, high-similarity pastes", () => {
    const events: IntegrityEvent[] = [
      { q: 4, type: "paste", at, paste_len: 120, paste_similarity: 0.95 },
    ];
    expect(flaggedQuestions(events).has(4)).toBe(true);
  });
});

describe("summarizeIntegrity — session flag thresholds", () => {
  const awayEvent = (q: number): IntegrityEvent => ({ q, type: "tab_hidden", at, away_ms: AWAY_FLAG_MS + 1 });

  it("does not flag a session with a single distracted question out of 10", () => {
    const s = summarizeIntegrity([awayEvent(1)], 10);
    expect(s.isFlagged).toBe(false);
    expect(s.focusScore).toBe(90);
  });

  it("flags a session with 3+ flagged questions", () => {
    const s = summarizeIntegrity([awayEvent(1), awayEvent(2), awayEvent(3)], 10);
    expect(s.isFlagged).toBe(true);
    expect(s.questionsFlagged).toBe(3);
  });

  it("flags a short session when 40%+ of questions are flagged", () => {
    const s = summarizeIntegrity([awayEvent(1), awayEvent(2)], 5);
    expect(s.isFlagged).toBe(true);
  });

  it("clean session scores 100 and is not flagged", () => {
    const s = summarizeIntegrity([], 10);
    expect(s.focusScore).toBe(100);
    expect(s.isFlagged).toBe(false);
  });

  it("never flags an empty session (0 questions)", () => {
    const s = summarizeIntegrity([awayEvent(1)], 0);
    expect(s.isFlagged).toBe(false);
    expect(s.focusScore).toBe(100);
  });
});
