## Goal

Bring per-student AI cost down to the **Moderate** band ($3–$6/month) so the $15 Standard plan yields a $9–$12 profit. Today every AI feature runs on `gemini-3-flash-preview` with no caps, no caching, and large `max_tokens` — a heavy student can easily hit $10–$16/month.

We'll attack cost on **four levers** without removing features.

---

## 1. Per-user daily AI quotas (hard cap)

Add a `ai_usage_daily` table and a shared `checkQuota()` helper that every edge function calls before hitting the model.

```text
ai_usage_daily
├─ user_id      uuid
├─ usage_date   date
├─ requests     int    (count of AI calls)
├─ tokens_in    int
├─ tokens_out   int
└─ PK (user_id, usage_date)
```

Caps for the **Standard / Moderate** plan:

| Feature group                  | Daily cap |
|--------------------------------|-----------|
| Quiz / exam-question generation | 25 questions |
| Flashcards                      | 30 cards |
| Explain-answer / mark-answer    | 40 calls |
| AI tutor chat messages          | 30 messages |
| Daily task / study-plan         | 3 generations |
| Mock paper / mock exam          | 1 paper |

When a cap is hit the function returns `429` with `{ error: "daily_limit_reached", resetsAt }` — UI shows a friendly "You've used today's free AI — comes back tomorrow or upgrade to Premium."

Premium plan gets ~3× these caps (still bounded — protects against runaway cost).

## 2. Tier the model by task complexity

Right now everything uses `gemini-3-flash-preview`. Split into two tiers in `_shared/ai-config.ts`:

```text
getAIConfig("cheap")    →  google/gemini-2.5-flash-lite   (≈80% cheaper)
getAIConfig("standard") →  google/gemini-3-flash-preview  (current)
```

Route by task:

| Function                          | Tier      |
|-----------------------------------|-----------|
| generate-flashcards               | cheap     |
| explain-answer (short)            | cheap     |
| ai-greeting / streak-celebration  | cheap     |
| daily-summary                     | cheap     |
| map-question-concepts             | cheap     |
| generate-quiz                     | standard  |
| generate-exam-questions           | standard  |
| generate-mock-paper               | standard  |
| ai-tutor                          | standard  |
| evaluate-topic-answer             | standard  |
| generate-student-insights         | standard  |

Estimated saving: 40–60% on total token spend.

## 3. Output token ceilings

Every `callAI` / `callAIStream` invocation must pass `maxTokens`. Today many calls have no limit and the model can return 4–8K tokens. New defaults:

| Function                  | maxTokens |
|---------------------------|-----------|
| generate-quiz (1 Q)       | 1500 |
| generate-quiz (batch)     | 3500 |
| generate-flashcards (10)  | 1800 |
| explain-answer            | 700 |
| ai-tutor reply            | 600 |
| generate-mock-paper       | 6000 (rare call) |
| daily-summary             | 400 |
| greeting/celebration      | 200 |

Enforced centrally — `callAI` will set a sane default if none provided.

## 4. Caching repeat work

Add a `ai_response_cache` table keyed by a hash of `(function_name, normalized_input)`:

```text
ai_response_cache
├─ cache_key   text PK   (sha256 of fn + canonical JSON input)
├─ response    jsonb
├─ created_at  timestamptz
└─ hits        int
```

- **Flashcards / quiz / exam-questions**: cache for 30 days, scoped to `(curriculum, subject, topic, difficulty, type)`. Multiple students hitting the same ZIMSEC O-Level Maths "Quadratic Equations / medium" share results. The function picks a *random* cached item (out of N) so students don't all see the same question. After 7 days regenerate to refresh the pool.
- **explain-answer**: cache by `(question_hash, student_answer_hash)` — identical answers from different students reuse the explanation.
- **daily-summary / greeting**: not cached (personalised).

Expected hit rate at scale: 40–70% for content generation = proportional cost saving.

## 5. Surface usage to the user

- Add a small **"AI usage today"** chip on the StudyMode dashboard showing `requests used / daily cap` for the heaviest bucket.
- When a cap is hit, show an upgrade CTA pointing to the Premium plan.
- Track `ai_usage_daily` rolling totals for the founder (admin dashboard) so we can see actual $/student.

---

## Files to change

**New / migration**
- `supabase/migrations/<ts>_ai_usage_and_cache.sql` — creates `ai_usage_daily`, `ai_response_cache`, plus `check_and_increment_ai_usage(user_id, bucket, limit)` SECURITY DEFINER function with RLS.

**Shared**
- `supabase/functions/_shared/ai-config.ts`
  - `getAIConfig(tier: "cheap" | "standard" = "standard")`
  - `enforceQuota(userId, bucket, limit)` helper (calls the SQL function)
  - `getCached(key)` / `setCached(key, value)` helpers
  - `callAI` defaults `maxTokens` if caller omits

**Edge functions** — wire quota check + tier + maxTokens + cache (where applicable):
- `generate-quiz/index.ts`
- `generate-exam-questions/index.ts`
- `generate-flashcards/index.ts`
- `explain-answer/index.ts`
- `ai-tutor/index.ts`
- `generate-daily-task/index.ts`
- `generate-mock-paper/index.ts`
- `generate-student-insights/index.ts`
- `evaluate-topic-answer/index.ts`
- `generate-topic-session/index.ts`
- `generate-concept-review/index.ts`
- `map-question-concepts/index.ts`

**Frontend**
- `src/studymode/lib/aiClient.ts` — handle new `429 daily_limit_reached` response with a toast + upgrade CTA.
- `src/studymode/components/Dashboard.tsx` — add "AI usage today" chip (read from `ai_usage_daily`).
- `src/hooks/useSubscription.ts` — expose `getAITier()` returning `"standard" | "premium"` so UI can show the right cap.

---

## Expected outcome

| Metric                         | Before     | After       |
|--------------------------------|------------|-------------|
| Avg cost / Standard student    | ~$8–$16    | ~$3–$6      |
| Cost ceiling (hard cap)        | none       | ~$5         |
| Profit on $15 Standard plan    | -$1 to $7  | $9–$12      |
| Premium cap                    | none       | ~$10        |

Caps are tunable in one config block, so we can loosen/tighten after watching real usage for 2 weeks.

## Out of scope (mention only)
- Switching to OpenAI `gpt-4o-mini` — possible later if Lovable Gateway pricing changes.
- Embeddings-based semantic cache — bigger lift; revisit if exact-match cache hit rate is low.
