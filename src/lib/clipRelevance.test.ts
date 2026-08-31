import { describe, it, expect } from "vitest";
import {
  tokenize,
  scoreClipRelevance,
  rankClipsForContext,
  buildTopicShelves,
} from "./clipRelevance";
import type { LibraryResource } from "@/types/academicProfile";

function clip(overrides: Partial<LibraryResource> & { title: string }): LibraryResource {
  return {
    id: overrides.title,
    author: "Test",
    type: "video",
    category: "Mathematics",
    gradeLevel: "10",
    summary: "",
    rating: 0,
    reviews: 0,
    thumbnail: "/placeholder.svg",
    isOffline: false,
    duration: "Video",
    isTutorial: true,
    videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    tags: { subject: "Mathematics", topic: "Algebra", grade: "10", curriculum: null },
    ...overrides,
  } as LibraryResource;
}

describe("tokenize", () => {
  it("lowercases, strips punctuation and stopwords", () => {
    expect(tokenize("Introduction to Quadratic Equations (Part 2)")).toEqual([
      "quadratic",
      "equations",
    ]);
  });
  it("drops short and numeric tokens", () => {
    expect(tokenize("Gr 12 CAPS: pH & Ka")).toEqual(["caps"]);
  });
  it("handles null/undefined", () => {
    expect(tokenize(null)).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
  });
});

describe("scoreClipRelevance", () => {
  it("scores subject + topic-tag matches highest", () => {
    const c = clip({ title: "Solving Quadratic Equations", tags: { subject: "Mathematics", topic: "Algebra", grade: "10", curriculum: null } });
    const score = scoreClipRelevance(c, { subject: "Mathematics", topic: "Algebra" });
    expect(score).toBeGreaterThanOrEqual(70); // 30 subject + 40 topic tag
  });

  it("matches aliased subjects (physics ≈ physical sciences)", () => {
    const c = clip({ title: "Newton's Laws", category: "Physical Sciences", tags: { subject: "Physical Sciences", topic: "Mechanics", grade: "11", curriculum: null } });
    const score = scoreClipRelevance(c, { subject: "Physics", topic: "Mechanics" });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("gives keyword credit when topic words appear in the title", () => {
    const c = clip({ title: "Factorising trinomials step by step", tags: { subject: "Mathematics", topic: "All Topics", grade: "10", curriculum: null } });
    const score = scoreClipRelevance(c, { subject: "Mathematics", topic: "Factorising Trinomials" });
    expect(score).toBeGreaterThan(30); // subject + keyword overlap, no tag bonus
  });

  it("boosts clips matching weak concepts", () => {
    const base = clip({ title: "Circle geometry theorems explained" });
    const withWeak = scoreClipRelevance(base, {
      subject: "Mathematics",
      weakConcepts: ["circle geometry"],
    });
    const withoutWeak = scoreClipRelevance(base, { subject: "Mathematics" });
    expect(withWeak).toBeGreaterThan(withoutWeak);
  });

  it("returns 0 for completely unrelated clips", () => {
    const c = clip({ title: "Photosynthesis basics", category: "Life Sciences", tags: { subject: "Life Sciences", topic: "Plants", grade: "10", curriculum: null } });
    expect(scoreClipRelevance(c, { subject: "Accounting", topic: "Ledgers" })).toBe(0);
  });

  it("does not award the topic-tag bonus for generic 'All Topics' tags", () => {
    const c = clip({ title: "Random maths talk", tags: { subject: "Mathematics", topic: "All Topics", grade: "10", curriculum: null } });
    const score = scoreClipRelevance(c, { subject: "Mathematics", topic: "All Topics" });
    expect(score).toBe(30); // subject only
  });
});

describe("engagement signals", () => {
  const base = clip({ title: "Solving Quadratic Equations", id: "q1" } as any);
  const ctx = { subject: "Mathematics", topic: "Algebra" };

  it("boosts liked clips", () => {
    const plain = scoreClipRelevance(base, ctx);
    const liked = scoreClipRelevance(base, { ...ctx, likedIds: ["q1"] });
    expect(liked).toBe(plain + 10);
  });

  it("penalizes already-watched clips without dropping them", () => {
    const plain = scoreClipRelevance(base, ctx);
    const watchedOnce = scoreClipRelevance(base, { ...ctx, watchCounts: { q1: 1 } });
    const watchedLots = scoreClipRelevance(base, { ...ctx, watchCounts: { q1: 10 } });
    expect(watchedOnce).toBe(plain - 8);
    expect(watchedLots).toBe(plain - 24); // capped penalty
    expect(watchedLots).toBeGreaterThan(0); // never fully disappears
  });

  it("ignores engagement on non-matching clips", () => {
    const unrelated = clip({ title: "Photosynthesis", category: "Life Sciences", id: "p1", tags: { subject: "Life Sciences", topic: "Plants", grade: "10", curriculum: null } } as any);
    expect(scoreClipRelevance(unrelated, { subject: "Accounting", likedIds: ["p1"] })).toBe(0);
  });

  it("ranks fresh clips above watched ones at equal content relevance", () => {
    const a = clip({ title: "Algebra basics part one", id: "a" } as any);
    const b = clip({ title: "Algebra basics part two", id: "b" } as any);
    const ranked = rankClipsForContext([a, b], { subject: "Mathematics", topic: "Algebra", watchCounts: { a: 2 } });
    expect(String(ranked[0].id)).toBe("b");
  });
});

describe("rankClipsForContext", () => {
  it("orders by relevance and drops zero-score clips", () => {
    const clips = [
      clip({ title: "Photosynthesis", category: "Life Sciences", tags: { subject: "Life Sciences", topic: "Plants", grade: "10", curriculum: null } }),
      clip({ title: "Trig identities you must know", tags: { subject: "Mathematics", topic: "Trigonometry", grade: "12", curriculum: null } }),
      clip({ title: "Intro to trigonometry ratios", tags: { subject: "Mathematics", topic: "Trigonometry", grade: "10", curriculum: null } }),
      clip({ title: "Balancing chemical equations", category: "Physical Sciences", tags: { subject: "Physical Sciences", topic: "Chemical Change", grade: "10", curriculum: null } }),
    ];
    const ranked = rankClipsForContext(clips, { subject: "Mathematics", topic: "Trigonometry" });
    expect(ranked.length).toBe(2);
    expect(ranked.every((c) => (c.tags?.topic || "") === "Trigonometry")).toBe(true);
  });

  it("respects the limit", () => {
    const clips = Array.from({ length: 30 }, (_, i) =>
      clip({ title: `Algebra lesson ${i}`, id: `c${i}` } as any)
    );
    const ranked = rankClipsForContext(clips, { subject: "Mathematics", topic: "Algebra" }, 5);
    expect(ranked.length).toBe(5);
  });
});

describe("buildTopicShelves", () => {
  const clips = [
    clip({ title: "Trig 1", id: "t1", tags: { subject: "Mathematics", topic: "Trigonometry", grade: "10", curriculum: null } } as any),
    clip({ title: "Trig 2", id: "t2", tags: { subject: "Mathematics", topic: "Trigonometry", grade: "11", curriculum: null } } as any),
    clip({ title: "Algebra 1", id: "a1", tags: { subject: "Mathematics", topic: "Algebra", grade: "10", curriculum: null } } as any),
    clip({ title: "Untagged", id: "u1", tags: { subject: "Mathematics", topic: "All Topics", grade: "10", curriculum: null } } as any),
    clip({ title: "Forces", id: "f1", category: "Physical Sciences", tags: { subject: "Physical Sciences", topic: "Mechanics", grade: "11", curriculum: null } } as any),
  ];

  it("groups by subject then topic, biggest topics first", () => {
    const shelves = buildTopicShelves(clips);
    const maths = shelves.filter((s) => s.subject === "Mathematics");
    expect(maths[0].topic).toBe("Trigonometry"); // 2 clips beats 1
    expect(maths[0].clips.length).toBe(2);
  });

  it("puts generic-topic clips in a trailing 'More clips' shelf", () => {
    const shelves = buildTopicShelves(clips);
    const maths = shelves.filter((s) => s.subject === "Mathematics");
    expect(maths[maths.length - 1].topic).toBe("More clips");
  });

  it("puts the learner's subjects first (with aliasing)", () => {
    const shelves = buildTopicShelves(clips, ["Physics"]); // aliases Physical Sciences
    expect(shelves[0].subject).toBe("Physical Sciences");
  });
});
