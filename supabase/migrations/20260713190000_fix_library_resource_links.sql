-- Fix broken / improperly-registered seeded library resources.
-- Every replacement URL below was verified live (HTTP 200/206, or YouTube oEmbed OK)
-- before being written here.
--
-- Bug classes fixed:
--   A. OpenStax renamed several PDFs on their CDN — old asset URLs now return 403.
--   B. Two archive.org past-paper URLs had filename typos ("P 1" vs "P1", "By" vs
--      "by") — 404.
--   C. Five seeded YouTube videos were removed/privated — oEmbed "Not Found".
--   D. Siyavula / CK-12 thumbnail URLs are hotlink-protected (403/404) so cards
--      rendered broken covers; University Physics Vol 1 pointed at the wrong cover.
--
-- The library_resource_classify trigger keeps kind/video_url/pdf_url consistent
-- on every UPDATE below.

-- ── A. OpenStax PDF renames (403 → live) ──────────────────────────────────
UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/Biology-2e_-_WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/Biology2e-WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/Concepts-Biology_-_WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/ConceptsofBiology-WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/Psychology2e_WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/psychology-2e_-_WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/World_History_Volume_1-WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/world-history-volume-1-to-1500_-_WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/WritingGuide-WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/writing-guide-with-handbook_-_WEB.pdf';

UPDATE public.library_system_resources SET pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/US_History_-_WEB.pdf'
WHERE pdf_url = 'https://assets.openstax.org/oscms-prodcms/media/documents/us-history_-_WEB.pdf';

-- ── B. archive.org filename typos (404 → live) ────────────────────────────
UPDATE public.library_system_resources
SET pdf_url = 'https://archive.org/download/IGCSEOLevelComputerP1WorkbookByInqilabPatel/IGCSE%20O%20Level%20Computer%20P1%20Workbook%20by%20Inqilab%20Patel.pdf'
WHERE pdf_url = 'https://archive.org/download/IGCSEOLevelComputerP1WorkbookByInqilabPatel/IGCSE%20O%20Level%20Computer%20P%201%20Workbook%20By%20Inqilab%20Patel.pdf';

UPDATE public.library_system_resources
SET pdf_url = 'https://archive.org/download/IGCSEOLevelComputerP2WorkbookByInqilabPatel/IGCSE%20O%20Level%20Computer%20P2%20Workbook%20by%20Inqilab%20Patel.pdf'
WHERE pdf_url = 'https://archive.org/download/IGCSEOLevelComputerP2WorkbookByInqilabPatel/IGCSE%20O%20Level%20Computer%20P%202%20Workbook%20By%20Inqilab%20Patel.pdf';

-- ── C. Removed YouTube videos (oEmbed "Not Found" → verified live) ────────
-- These were originally seeded into pdf_url with kind='video' and later moved
-- to video_url by the classify backfill — match either column to be safe.

-- Romeo and Juliet → CrashCourse Literature #2 (the real episode)
UPDATE public.library_system_resources
SET video_url = 'https://www.youtube.com/watch?v=I4kz-C7GryY',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/I4kz-C7GryY/hqdefault.jpg'
WHERE video_url LIKE '%Y2H3DXyTSlA%' OR pdf_url LIKE '%Y2H3DXyTSlA%';

-- Supply and Demand → CrashCourse Economics #4 (correct ID)
UPDATE public.library_system_resources
SET video_url = 'https://www.youtube.com/watch?v=g9aDizJpd_s',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/g9aDizJpd_s/hqdefault.jpg'
WHERE video_url LIKE '%g9aDayNGVfs%' OR pdf_url LIKE '%g9aDayNGVfs%';

-- Plate Tectonics → CrashCourse Geography #19 "The Plate Tectonics Revolution"
UPDATE public.library_system_resources
SET video_url = 'https://www.youtube.com/watch?v=7CPv0NSIG2M',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/7CPv0NSIG2M/hqdefault.jpg'
WHERE video_url LIKE '%RA2-Vc4PIeo%' OR pdf_url LIKE '%RA2-Vc4PIeo%';

-- Climate and Weather → Crash Course Kids "Weather vs. Climate"
UPDATE public.library_system_resources
SET video_url = 'https://www.youtube.com/watch?v=YbAWny7FV3w',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/YbAWny7FV3w/hqdefault.jpg'
WHERE video_url LIKE '%K0-ENXofxJI%' OR pdf_url LIKE '%K0-ENXofxJI%';

-- "How to Take Smart Notes" → CrashCourse Study Skills #1 "Taking Notes"
UPDATE public.library_system_resources
SET title = 'CrashCourse — Taking Notes (Study Skills #1)',
    video_url = 'https://www.youtube.com/watch?v=E7CwqNHn_Ns',
    pdf_url = NULL,
    thumbnail_url = 'https://i.ytimg.com/vi/E7CwqNHn_Ns/hqdefault.jpg'
WHERE video_url LIKE '%BUgMl_a4FlA%' OR pdf_url LIKE '%BUgMl_a4FlA%';

-- ── D. Broken thumbnails ──────────────────────────────────────────────────
-- Siyavula covers are behind auth (403); CK-12 covers were deleted (404).
-- Replace with reliable placeholder covers matching the original colour scheme.
UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/1a3fc4/ffffff?text=Siyavula%0AMaths%0AGrade+10'
WHERE thumbnail_url = 'https://intl.siyavula.com/read/_static/img/grade10/za-maths-cover.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/7c3aed/ffffff?text=Siyavula%0AMaths+Lit%0AGrade+10'
WHERE thumbnail_url = 'https://intl.siyavula.com/read/_static/img/grade10/za-maths-lit-cover.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/0f766e/ffffff?text=Siyavula%0APhys+Sci%0AGrade+10'
WHERE thumbnail_url = 'https://intl.siyavula.com/read/_static/img/grade10/za-physci-cover.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/15803d/ffffff?text=Siyavula%0ALife+Sci%0AGrade+10'
WHERE thumbnail_url = 'https://intl.siyavula.com/read/_static/img/grade10/za-lifesci-cover.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/1a3fc4/ffffff?text=CK-12%0AAlgebra+I'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a6e8e0e08762a14fef9.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/1a3fc4/ffffff?text=CK-12%0AGeometry'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a808e0e08762a14ff2c.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/0f766e/ffffff?text=CK-12%0APhysical%0AScience'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a988e0e08762a14ff96.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/15803d/ffffff?text=CK-12%0ALife%0AScience'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a8b8e0e08762a14ff5d.png';

UPDATE public.library_system_resources
SET thumbnail_url = 'https://placehold.co/600x800/1a3fc4/ffffff?text=CK-12%0AMiddle+School%0AMath'
WHERE thumbnail_url = 'https://www.ck12.org/flx/show/cover/book/5d574a778e0e08762a14ff0d.png';

-- University Physics Volume 1 was seeded with the College Physics cover — use its own.
UPDATE public.library_system_resources
SET thumbnail_url = 'https://openstax.org/exports/cnx/university-physics-volume-1/cover.png'
WHERE title = 'University Physics Volume 1 (OpenStax)'
  AND thumbnail_url = 'https://openstax.org/exports/cnx/college-physics-2e/cover.png';
