

## Plan: Gallery Video Upload + Content Compliance Agreement

### What Changes

Two features added to the tutor tutorial upload flow:

1. **Direct video upload from phone gallery** — Replace the URL-only input with a file picker that accepts video files, uploads them to a Supabase storage bucket, and stores the resulting public URL as the tutorial's `video_url`.

2. **Content Compliance Agreement gate** — Before the upload form opens, tutors must read and accept content guidelines via a modal with a required checkbox. The "Continue to Upload" button stays disabled until agreed.

---

### Files to Create

**`src/components/tutor-creator/ContentComplianceModal.tsx`**
- Full-screen dialog with scrollable guidelines text
- Guidelines cover: educational appropriateness, no offensive language, no nudity, no hate speech, no violence, original content ownership, consequence of violations
- Checkbox: "I have read and agree that my content complies with the above guidelines"
- "Continue to Upload" button disabled until checkbox is checked
- Subtle footer line: "This step helps keep StudySync safe and valuable for all students."
- Stores acceptance in `sessionStorage` so it's only shown once per session (resets on app reload)

### Files to Modify

**`src/components/tutor-creator/TutorialFormDialog.tsx`**
- Replace the Video URL text input with a dual-option section:
  - **Option A**: "Upload from Gallery" — an `<input type="file" accept="video/*">` styled as a button. On file select, upload to `tutor-videos` storage bucket, then set the form's `videoUrl` to the public URL. Show upload progress.
  - **Option B**: "Paste a link" — the existing URL text input (YouTube/Loom/Vimeo), kept as a fallback
- Show a toggle or tabs between the two options
- Display video thumbnail/filename after successful upload

**`src/components/TutorCreatorDashboard.tsx`**
- Add state `showCompliance` (boolean)
- When "Upload Tutorial" is clicked, check `sessionStorage` for prior acceptance:
  - If not accepted → show `ContentComplianceModal`
  - On accept → set sessionStorage flag, then open `TutorialFormDialog`
  - If already accepted this session → open form directly

### Storage Bucket Migration

Create a new public storage bucket `tutor-videos` with RLS policies:
- **SELECT**: anyone (public bucket for playback)
- **INSERT**: authenticated users where `(bucket_id = 'tutor-videos' AND auth.uid()::text = (storage.foldername(name))[1])` — videos stored under `{user_id}/filename.mp4`
- **DELETE**: owner only (same pattern)

### Upload Flow

```text
Tutor taps "Upload Tutorial"
  → Compliance modal (first time per session)
  → Accepts → Form dialog opens
  → Picks "Upload from Gallery"
  → Selects video file (max 100MB)
  → File uploads to tutor-videos/{tutor_id}/{timestamp}-{filename}
  → Progress bar shown
  → On success: videoUrl set to public URL
  → Fills in title, subject, topic, etc.
  → Publishes
```

### Technical Details

- File size limit: 100MB enforced client-side before upload
- Accepted formats: `video/mp4, video/quicktime, video/webm`
- Upload uses `supabase.storage.from('tutor-videos').upload(path, file)`
- Public URL via `supabase.storage.from('tutor-videos').getPublicUrl(path)`
- No new database tables needed — `video_url` column on `tutor_tutorials` already stores the URL

