## Goal

Make the SAIL admin dashboard do real work: when an event triggers a task, an LLM analyzes it and writes a `code_patch` (proposed fix / recommendation) onto the task. Approvals then produce something meaningful instead of a no-op status flip.

## Scope

Backend-only changes. No UI redesign — the existing dashboard at `/admin/sail` already renders `code_patch`, agent logs, etc., so once the function fills those fields the dashboard "comes alive" automatically.

## Changes

### 1. Update `supabase/functions/sail-agent/index.ts`

After creating the task row, call the Lovable AI Gateway with an agent-specific system prompt and the event payload. Save the model output to `sail_tasks.code_patch` and append a `sail_agent_logs` row with the LLM duration and token usage.

- Model: `google/gemini-3-flash-preview` (default per platform rules).
- Use tool-calling for structured output: `{ summary, root_cause, proposed_patch, risk_assessment, confidence }`.
- System prompts per agent (debug / frontend / backend / learning / monetization / reviewer) — short, role-scoped, instructing the model to suggest a patch only, never claim to deploy.
- On 429/402, log to `sail_agent_logs` with `success=false` and a clear error; still return the created task so the UI shows it.
- Keep the existing low-risk auto-advance to `review`; high/medium remain pending until admin approves.

### 2. New edge function `sail-execute-approved` (optional second step)

Triggered when admin approves a task. Reads `code_patch`, posts a follow-up "execution plan" via the LLM (still no real code deploy — SAIL safety rules forbid it), writes the result into `sail_tasks` (new column) and flips status to `deployed`. If you'd rather not add this now, approval simply marks `approved` and we stop there.

### 3. No DB schema change required

`sail_tasks.code_patch` is already `text | null` and the dashboard already renders it inside the task detail dialog. No migration unless we add the second function (which would need a `sail_tasks.execution_notes text` column).

### 4. Secrets

`LOVABLE_API_KEY` is already configured. Nothing to add.

## Out of scope

- No client-side changes to `useSAILTasks` or `SAIL.tsx`.
- No real code deployment / git operations — SAIL stays advisory.
- No cron / autonomous scheduler — triggers stay manual + `globalErrorHandler`.
- No changes to `src/sail/agents/*` client modules (those remain unused stubs for now).

## Validation

1. Open `/admin/sail` → click "Error Scan" → new task appears within ~5s with a populated `code_patch` (visible via the eye icon → "Code Patch" section).
2. Agent Logs tab shows two rows per trigger: `process_<event>` and `llm_analysis` with non-zero `duration_ms`.
3. Trigger with severity "high" → task lands in `pending` and the Approve/Reject buttons are visible.
4. Edge function logs show no 4xx/5xx; on 429 the task still appears with an error log row.

## Decision needed

Do you want step 2 (`sail-execute-approved`) included now, or just the analysis step? I'd recommend analysis-only first — it's the smallest change that makes the dashboard actually useful.
