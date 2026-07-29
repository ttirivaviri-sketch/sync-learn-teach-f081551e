import { describe, it, expect } from "vitest";
import { computeProgress, type EventRow } from "./ProofOfProgress";

const NOW = new Date("2026-07-28T12:00:00Z");

function ev(daysAgo: number, over: Partial<EventRow> = {}): EventRow {
  return {
    source: "topic_session",
    topic_name: "Algebra",
    score_pct: 70,
    occurred_at: new Date(NOW.getTime() - daysAgo * 24 * 3600_000).toISOString(),
    payload: {},
    ...over,
  };
}

describe("computeProgress", () => {
  it("splits events into this-week and prior-week windows", () => {
    const rows = [ev(1), ev(2), ev(3), ev(9), ev(10)];
    const p = computeProgress(rows, NOW);
    expect(p.thisWeekCount).toBe(3);
  });

  it("computes score delta between windows", () => {
    const rows = [
      ev(1, { score_pct: 80 }),
      ev(2, { score_pct: 90 }),
      ev(9, { score_pct: 60 }),
      ev(10, { score_pct: 70 }),
    ];
    const p = computeProgress(rows, NOW);
    expect(p.avgThis).toBe(85);
    expect(p.avgPrior).toBe(65);
    expect(p.delta).toBe(20);
  });

  it("returns null delta when a window has no scores", () => {
    const rows = [ev(1, { score_pct: 80 }), ev(2, { score_pct: null })];
    const p = computeProgress(rows, NOW);
    expect(p.delta).toBeNull();
    expect(p.avgPrior).toBeNull();
  });

  it("finds most-improved topic with >=2 scored events per window", () => {
    const rows = [
      // Algebra: 90 avg this week vs 60 prior => +30
      ev(1, { topic_name: "Algebra", score_pct: 90 }),
      ev(2, { topic_name: "Algebra", score_pct: 90 }),
      ev(9, { topic_name: "Algebra", score_pct: 60 }),
      ev(10, { topic_name: "Algebra", score_pct: 60 }),
      // Trig: only 1 event this week => ineligible despite huge gain
      ev(1, { topic_name: "Trig", score_pct: 100 }),
      ev(9, { topic_name: "Trig", score_pct: 10 }),
      ev(10, { topic_name: "Trig", score_pct: 10 }),
    ];
    const p = computeProgress(rows, NOW);
    expect(p.bestTopic).toEqual({ name: "Algebra", gain: 30 });
  });

  it("ignores topics that declined", () => {
    const rows = [
      ev(1, { score_pct: 50 }),
      ev(2, { score_pct: 50 }),
      ev(9, { score_pct: 90 }),
      ev(10, { score_pct: 90 }),
    ];
    const p = computeProgress(rows, NOW);
    expect(p.bestTopic).toBeNull();
  });

  it("counts photo-solve corrections fixed (after >= before)", () => {
    const rows = [
      ev(1, { source: "photo_solve", payload: { before_pct: 40, after_pct: 80 } }),
      ev(2, { source: "photo_solve", payload: { before_pct: 70, after_pct: 50 } }),
      ev(3, { source: "photo_solve", payload: {} }),
      // prior week fixes don't count
      ev(9, { source: "photo_solve", payload: { before_pct: 10, after_pct: 90 } }),
    ];
    const p = computeProgress(rows, NOW);
    expect(p.correctionsFixed).toBe(1);
  });
});
