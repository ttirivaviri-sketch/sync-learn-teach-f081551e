-- Purge dead ZIMSEC past-paper links.
--
-- All 45 ZIMSEC past_paper rows seeded in
-- 20260808221500_seed_verified_books_papers_novels_clips.sql pointed at
-- https://www5.zimsec.co.zw/download/... URLs. Audit on 2026-09-06 found:
--   • every one of the 45 URLs returns 404,
--   • zimsec.co.zw and www5.zimsec.co.zw have both been domain-hijacked
--     (now serving unrelated commercial/gambling content),
--   • no alternative source publishing individual ZIMSEC PDFs could be
--     verified (zimsake.co.zw serves ZIP/DOCX bundles; the
--     zimsecpapers.github.io Firebase storage returns 402 Payment Required;
--     other mirrors are dead).
--
-- Broken download links are worse than no links, so these rows are removed.
-- ZIMSEC-track students remain covered by the Cambridge O-Level/IGCSE papers
-- (seeded 2026-09-06), which the personalization layer already maps to the
-- ZIMSEC O-Level track via the O-Level ≡ IGCSE ≡ Form 4 equivalence.
--
-- Scoped tightly: only past_paper rows whose pdf_url points at the dead
-- www5.zimsec.co.zw download host. Idempotent (DELETE matches nothing on
-- re-run).

DELETE FROM public.library_system_resources
WHERE kind = 'past_paper'
  AND pdf_url LIKE 'https://www5.zimsec.co.zw/download/%';
