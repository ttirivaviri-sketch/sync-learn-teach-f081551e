

## Plan: Fix Study Level Mismatch Filtering Out All Tutors

### Problem
The learner's `study_level` values (`junior_primary`, `senior_primary`, `junior_high`, `senior_high`, `tertiary`) don't match tutor subject `level` values (`Grade 1-3`, `Grade 4-6`, `Grade 7-9`, `Grade 10-12`, `University`, `Adult Education`). The current filter uses `includes()` which finds no matches, so **all tutors are hidden**.

### Fix

**`src/hooks/useTutorData.ts`** — Replace the study level filter (around line 140) with a mapping function that translates the learner's study level to the corresponding tutor subject levels:

```
junior_primary  → ["Grade 1-3"]
senior_primary  → ["Grade 4-6"]
junior_high     → ["Grade 7-9"]
senior_high     → ["Grade 10-12"]
tertiary        → ["University", "Adult Education"]
```

The filter will check if any of the tutor's subjects have a level that matches one of the mapped values (case-insensitive).

### Files Changed
- `src/hooks/useTutorData.ts` — Add level mapping and fix the study level filter logic

