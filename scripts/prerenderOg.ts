/**
 * Build-time prerender of social metadata.
 *
 * This app is a static SPA, so social crawlers (Facebook, LinkedIn, Slack,
 * WhatsApp, X) never execute the React code that sets per-route head tags —
 * they only read the HTML the server hands them. This plugin fixes that
 * without SSR: after the bundle is written, it emits one static HTML file per
 * key route (e.g. dist/legal/privacy/index.html) whose <head> already contains
 * that route's title, description, canonical, og:* and twitter:* tags —
 * including a per-page 1200x630 preview image.
 *
 * The body is the same SPA bootstrap, so a real browser hydrates as normal.
 */
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { ROUTE_SEO, SITE_URL } from "../src/lib/seoRoutes";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Drop every tag the per-route head is about to replace. */
function stripManagedTags(html: string): string {
  const patterns = [
    /<title>[\s\S]*?<\/title>\s*/gi,
    /<meta\s+name="title"[^>]*>\s*/gi,
    /<meta\s+name="description"[^>]*>\s*/gi,
    /<link\s+rel="canonical"[^>]*>\s*/gi,
    /<meta\s+(?:property|name)="og:(?:title|description|url|image|image:width|image:height|type)"[^>]*>\s*/gi,
    /<meta\s+(?:property|name)="twitter:(?:title|description|url|image|card)"[^>]*>\s*/gi,
  ];
  return patterns.reduce((acc, re) => acc.replace(re, ""), html);
}

function headFor(route: (typeof ROUTE_SEO)[number]): string {
  const url = `${SITE_URL}${route.path}`;
  const image = `${SITE_URL}${route.image}`;
  const title = escapeHtml(route.title);
  const description = escapeHtml(route.description);

  return `
    <title>${title}</title>
    <meta name="title" content="${title}" />
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${url}" />

    <meta property="og:type" content="${route.type ?? "website"}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:url" content="${url}" />
    <meta name="twitter:image" content="${image}" />
`;
}

export function prerenderOg(): Plugin {
  let outDir = "dist";

  return {
    name: "studysync-prerender-og",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const root = path.resolve(process.cwd(), outDir);
      const indexPath = path.join(root, "index.html");
      if (!fs.existsSync(indexPath)) return;

      const baseHtml = fs.readFileSync(indexPath, "utf8");

      for (const route of ROUTE_SEO) {
        const html = stripManagedTags(baseHtml).replace(
          "</head>",
          `${headFor(route)}  </head>`,
        );

        const target =
          route.path === "/"
            ? indexPath
            : path.join(root, route.path.replace(/^\//, ""), "index.html");

        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, html, "utf8");
      }

      // eslint-disable-next-line no-console
      console.log(`[prerender-og] wrote ${ROUTE_SEO.length} static head files`);
    },
  };
}

export default prerenderOg;
