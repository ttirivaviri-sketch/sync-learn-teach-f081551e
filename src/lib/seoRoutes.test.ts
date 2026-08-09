/**
 * Guards the SEO surface:
 *  - every ROUTE_SEO path is listed in public/sitemap.xml (and vice versa),
 *    so new landing pages can't ship half-wired;
 *  - all sitemap URLs use the canonical production domain;
 *  - titles/descriptions stay within the length budgets Google displays.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ROUTE_SEO, SITE_URL } from "./seoRoutes";

const sitemap = fs.readFileSync(
  path.resolve(__dirname, "../../public/sitemap.xml"),
  "utf8",
);

const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
  const url = new URL(m[1]);
  return url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
});

describe("seoRoutes ↔ sitemap.xml", () => {
  it("uses the canonical production domain everywhere", () => {
    expect(SITE_URL).toBe("https://studysync.co.za");
    for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      expect(m[1]).toMatch(/^https:\/\/studysync\.co\.za(\/|$)/);
    }
    expect(sitemap).not.toContain("lovable.app");
  });

  it("lists every ROUTE_SEO path in the sitemap", () => {
    for (const route of ROUTE_SEO) {
      expect(sitemapPaths, `sitemap.xml is missing ${route.path}`).toContain(route.path);
    }
  });

  it("has ROUTE_SEO metadata for every sitemap URL", () => {
    for (const p of sitemapPaths) {
      expect(
        ROUTE_SEO.some((r) => r.path === p),
        `${p} is in sitemap.xml but has no ROUTE_SEO entry (no prerendered head)`,
      ).toBe(true);
    }
  });

  it("keeps titles and descriptions within display budgets", () => {
    for (const route of ROUTE_SEO) {
      expect(route.title.length, `${route.path} title too long`).toBeLessThanOrEqual(70);
      expect(route.description.length, `${route.path} description`).toBeGreaterThanOrEqual(50);
      expect(route.description.length, `${route.path} description too long`).toBeLessThanOrEqual(170);
      expect(route.image.startsWith("/"), `${route.path} image must be root-relative`).toBe(true);
    }
  });

  it("has unique paths and titles", () => {
    const paths = ROUTE_SEO.map((r) => r.path);
    const titles = ROUTE_SEO.map((r) => r.title);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
