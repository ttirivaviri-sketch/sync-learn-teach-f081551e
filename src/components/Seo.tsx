/**
 * Seo — per-route head tags (title, description, canonical, og/twitter).
 *
 * The static tags in index.html stay as the sitewide fallback for
 * social crawlers that don't execute JS; this component overrides them
 * for JS-executing crawlers on a per-route basis.
 */
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://studysync.co.za";

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
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[property="twitter:title"]',
  'meta[property="twitter:description"]',
  'meta[property="twitter:url"]',
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
  /** Set for pages that should not be indexed (private/app areas). */
  noindex?: boolean;
  type?: "website" | "article";
}

export const Seo = ({ title, description, path, noindex, type = "website" }: SeoProps) => {
  const url = `${SITE_URL}${path === "/" ? "/" : path}`;
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

      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

export default Seo;
