# feat(learning-ops): Phase 3 — invitation acceptance, automation cadence, concept trends, outcome analytics

## Summary

Phase 3 evolves the Learning Operating System from a modeled foundation into an operational, closed-loop system.

**Highlights**

- **Real workspace invitation acceptance flow.** Owners/admins can now issue secure, time-bound join links from `SchoolAdminConsole`. Invited users open `/school/join?token=…` and are joined to the workspace (and any invited cohorts) atomically via a server-side RPC.
- **Automation cadence visibility.** New `learning_ops_automation_runs` table + RLS provides a workspace-scoped audit log of nightly recomputations, rollups, and digest jobs — surfaced directly in the Teacher Command Center.
- **Concept graph provenance.** `learning_concept_catalog` now carries `source_document_id`, `source_kind`, `ingested_at`, and `confidence`, and the service layer accepts prerequisites per concept plus source metadata. Sets up Phase 3.1 document-to-catalog ingestion.
- **Outcome analytics.** Two new SQL views ship:
  - `learning_concept_trends` — daily concept-level mastery movement (evidence count, avg confidence, score delta)
  - `learning_intervention_outcomes` — per-intervention hours open, post-action score delta, post-evidence count
  Both are consumed by the Teacher Command Center to show concept momentum, resolved counts, average hours-to-resolve, and total post-action mastery delta.
- **Typed LOS surface expanded.** `learning-os-types.ts` now types the new tables, views, and RPCs; `losView()` is added alongside `losFrom()`. No new `as any` casts are introduced in the LOS layer.

## Migration

`supabase/migrations/20260628090000_learning_ops_phase3_automation_and_invites.sql`

- Adds invite acceptance columns to `learning_workspace_invitations` (`token`, `token_hash`, `expires_at`, `accepted_at`, `accepted_by_user_id`) + unique token index.
- Creates `learning_ops_automation_runs` with RLS restricted to workspace members.
- Adds concept-graph provenance columns to `learning_concept_catalog`.
- Creates `learning_concept_trends` and `learning_intervention_outcomes` views.
- Adds two SECURITY DEFINER functions:
  - `generate_workspace_invite_token(uuid)` — owner/admin/teacher only
  - `accept_workspace_invitation(text)` — atomically creates membership + cohort assignments and marks the invite accepted

## New surface

- `src/pages/SchoolInvitationPage.tsx` — mounted at `/school/join`
- `TeacherCommandCenter.tsx` — new sections: **Automation cadence**, **Concept momentum**, KPI tiles for resolved outcomes / avg hours open / post-action Δ
- `SchoolAdminConsole.tsx` — invite issuance UI: **Generate join link**, **Copy link**, expiry visibility, accepted state

## Contract changes (LOS lib)

- `generateWorkspaceInvitationToken(invitationId)` → `string`
- `acceptWorkspaceInvitation(token)` → membership id
- `upsertConceptCatalogEntries(...)` now accepts:
  - `prerequisitesByConcept?: Record<string, string[]>`
  - `sourceDocumentId?: string | null`
  - `sourceKind?: 'syllabus' | 'past_paper' | 'notes' | 'manual' | 'topic_seed'`
  - `confidence?: number`
- `loadTeacherCommandCenter()` snapshot now includes:
  - `automationRuns`, `conceptTrendLeaders`, `interventionOutcomeSummary`

## Manual edits required

See `MANUAL_EDITS.md`. Two small edits:
1. `src/App.tsx` — add lazy import + route for `SchoolInvitationPage` at `/school/join`
2. `tests/suite.mjs` — append Section 11 (Learning Operating System Phase 3) block

## Validation

- Full test suite passes: `node tests/suite.mjs` → **69 passed / 0 failed**
- Includes 5 new Phase 3 checks covering the migration, typed LOS surface, service exports, mounted route, and dashboard UI.

## Backwards compatibility

- Existing invitation records without tokens continue to work; `generate_workspace_invite_token()` mints one on demand.
- Existing concept catalog rows are unchanged; new provenance columns default to `NULL` / `topic_seed`.
- No `as any` casts introduced. `losFrom()` and the new `losView()` remain the sole typed access points.

## Next up (Phase 3.1)

1. Automation execution runtime (nightly intervention sweep + weekly cohort rollup) writing into `learning_ops_automation_runs`
2. Document-to-concept ingestion pipeline populating `learning_concept_catalog` with real provenance
3. Concept-trend charts + intervention attribution drilldown UI
