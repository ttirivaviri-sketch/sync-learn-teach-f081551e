import { describe, expect, it } from "vitest";
import { parseVideoSource } from "./videoUrl";

const YT_ID = "dQw4w9WgXcQ";

describe("parseVideoSource — YouTube", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${YT_ID}`],
    [`https://youtube.com/watch?v=${YT_ID}`],
    [`https://m.youtube.com/watch?v=${YT_ID}`],
    // v param NOT first in the query string
    [`https://www.youtube.com/watch?app=desktop&v=${YT_ID}`],
    [`https://youtu.be/${YT_ID}`],
    [`https://youtu.be/${YT_ID}?si=abc123`],
    [`https://www.youtube.com/shorts/${YT_ID}`],
    [`https://www.youtube.com/embed/${YT_ID}`],
    [`https://www.youtube.com/live/${YT_ID}`],
    [`https://www.youtube-nocookie.com/embed/${YT_ID}`],
  ])("resolves %s to an embed", (url) => {
    const source = parseVideoSource(url);
    expect(source.provider).toBe("youtube");
    expect(source.embedUrl).toContain(`/embed/${YT_ID}`);
    expect(source.isDirect).toBe(false);
  });

  it("rejects malformed/non-YouTube ids", () => {
    expect(parseVideoSource("https://example.com/watch?v=" + YT_ID).provider).toBe("unknown");
    expect(parseVideoSource("https://www.youtube.com/watch?v=short").provider).toBe("unknown");
    expect(parseVideoSource("not a url").provider).toBe("unknown");
  });

  it("passes origin identity params when provided", () => {
    const source = parseVideoSource(`https://youtu.be/${YT_ID}`, {
      origin: "https://app.studysync.example",
    });
    expect(source.embedUrl).toContain("enablejsapi=1");
    expect(source.embedUrl).toContain(
      `origin=${encodeURIComponent("https://app.studysync.example")}`
    );
  });

  it("keeps autoplay off by default and on when requested", () => {
    expect(parseVideoSource(`https://youtu.be/${YT_ID}`).embedUrl).toContain("autoplay=0");
    expect(
      parseVideoSource(`https://youtu.be/${YT_ID}`, { autoplay: true }).embedUrl
    ).toContain("autoplay=1");
  });
});

describe("parseVideoSource — Vimeo / Loom", () => {
  it("resolves vimeo urls (including channel paths)", () => {
    expect(parseVideoSource("https://vimeo.com/123456789").embedUrl).toContain(
      "player.vimeo.com/video/123456789"
    );
    expect(
      parseVideoSource("https://www.vimeo.com/channels/staffpicks/123456789").embedUrl
    ).toContain("player.vimeo.com/video/123456789");
  });

  it("resolves loom share urls", () => {
    const source = parseVideoSource("https://www.loom.com/share/abc123DEF456");
    expect(source.provider).toBe("loom");
    expect(source.embedUrl).toContain("loom.com/embed/abc123DEF456");
  });

  it("does not resolve loom non-share paths", () => {
    expect(parseVideoSource("https://loom.com/other/abc").provider).toBe("unknown");
  });
});

describe("parseVideoSource — direct files", () => {
  it.each([
    ["https://cdn.example.com/clip.mp4"],
    ["https://cdn.example.com/clip.webm?token=xyz"],
    ["https://uynoykcratwbcdzmsxfw.supabase.co/storage/v1/object/public/videos/clip"],
    ["https://bucket.s3.amazonaws.com/clip"],
  ])("classifies %s as direct", (url) => {
    const source = parseVideoSource(url);
    expect(source.provider).toBe("direct");
    expect(source.isDirect).toBe(true);
    expect(source.embedUrl).toBeNull();
  });

  it("does not classify pages or embeds as direct", () => {
    expect(parseVideoSource("https://example.com/page.html").isDirect).toBe(false);
    expect(parseVideoSource(`https://youtu.be/${YT_ID}`).isDirect).toBe(false);
  });
});

describe("parseVideoSource — unknown fallback", () => {
  it("returns unknown with the original url preserved for external-link fallback", () => {
    const source = parseVideoSource("https://example.com/somepage");
    expect(source.provider).toBe("unknown");
    expect(source.embedUrl).toBeNull();
    expect(source.originalUrl).toBe("https://example.com/somepage");
  });
});
