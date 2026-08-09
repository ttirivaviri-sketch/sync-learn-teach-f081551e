/**
 * Seo — per-route head tags (title, description, canonical, og/twitter).
 *
 * The static tags in index.html stay as the sitewide fallback for
 * social crawlers that don't execute JS; this component overrides them
 * for JS-executing crawlers on a per-route basis.
 */
import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://studysync.co.za";

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
