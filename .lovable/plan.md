

## Plan: Fix Video Upload RLS Error

### Root Cause

The upload path is `tutor-videos/undefined/...` — the `tutorId` prop is `undefined` at upload time. This causes the RLS policy (`auth.uid()::text = (storage.foldername(name))[1]`) to reject the upload since `"undefined" ≠ "cad1e43c-..."`.

The code passes `tutorId` correctly through props, but it appears to be undefined at runtime. This could be a stale build issue, or a subtle race condition.

### Fix

**`src/components/tutor-creator/TutorialFormDialog.tsx`**
- Instead of relying solely on the `tutorId` prop, also fetch `auth.uid()` directly from the Supabase client as a fallback at upload time
- Add a guard: if no valid tutor ID is available, show an error instead of uploading to `undefined/`

The key change in `handleFileSelect`:
```typescript
const { data: { session } } = await supabase.auth.getSession();
const effectiveTutorId = tutorId || session?.user?.id;
if (!effectiveTutorId) {
  setUploadError("Not signed in. Please refresh and try again.");
  return;
}
const path = `${effectiveTutorId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
```

This is a single-line defensive fix that guarantees the correct user ID is always used, regardless of prop timing.

