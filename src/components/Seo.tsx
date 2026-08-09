/**
 * Seo — per-route head tags (title, description, canonical, og/twitter).
 *
 * Static per-route HTML is emitted at build time by scripts/prerenderOg.ts so
 * non-JS social crawlers get the right preview; this component keeps the head
 * correct for client-side navigation and JS-executing crawlers.
 */
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { DEFAULT_OG_IMAGE, SITE_URL, getRouteSeo } from "@/lib/seoRoutes";

export { SITE_URL };

/**
 * Helmet appends tags rather than replacing the static ones shipped in
 * index.html, which would leave crawlers with two conflicting descriptions
 * and og:urls. Once the app has hydrated, drop the static duplicates —
 * non-JS social crawlers still see them in the raw HTML.
 */
const STATIC_DUPLICATE_SELECTORS = [
  'meta[name="description"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[property="og:image"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[property="twitter:title"]',
  'meta[property="twitter:description"]',
  'meta[property="twitter:url"]',
  'meta[name="twitter:image"]',
  'meta[property="twitter:image"]',
  "link[rel=canonical]",
].join(",");

function useStripStaticHeadDuplicates() {
  useEffect(() => {
    document
      .head!.querySelectorAll(STATIC_DUPLICATE_SELECTORS)
      .forEach((el) => {
        if (!el.hasAttribute("data-rh")) el.remove();
      });
  }, []);
}


interface SeoProps {
  /** Under 60 chars. */
  title: string;
  /** 50–160 chars. */
  description: string;
  /** Route path, e.g. "/learner/auth". Used for canonical + og:url. */
  path: string;
  /** Root-relative 1200x630 preview image. Defaults to the route's own card. */
  image?: string;
  /** Set for pages that should not be indexed (private/app areas). */
  noindex?: boolean;
  type?: "website" | "article";
}

export const Seo = ({ title, description, path, image, noindex, type = "website" }: SeoProps) => {
  const url = `${SITE_URL}${path === "/" ? "/" : path}`;
  const imagePath = image ?? getRouteSeo(path)?.image ?? DEFAULT_OG_IMAGE;
  const imageUrl = imagePath.startsWith("http") ? imagePath : `${SITE_URL}${imagePath}`;
  useStripStaticHeadDuplicates();

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
};

export default Seo;
