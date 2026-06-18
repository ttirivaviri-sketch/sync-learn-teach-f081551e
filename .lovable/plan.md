## Problem

The teacher's "New classroom" dialog shows empty **Grade** and **Subject** dropdowns and has no **Curriculum** field at all. Root cause: `grades` and `school_subjects` are empty for the school (0 rows in both tables), and the schema never had a curriculum field on classes.

## Fix

### 1. Schema (migration)

- `ALTER TABLE classes ADD COLUMN curriculum text` — so each classroom records its syllabus (ZIMSEC, CAPS, IEB, Cambridge, Other).

### 2. Inline create in the dialog (`CreateClassroomDialog.tsx`)

- **Grade picker**: keep the existing `Select` of existing grades, with a sticky "➕ Add new grade…" item at the bottom. Picking it swaps the trigger for a small inline input ("Form 4", "Grade 10", …) + ✓/✕. On confirm, insert into `grades` (school-scoped) via the existing `useUpsertGrade` hook and auto-select the new row.
- **Subject picker**: same pattern using `school_subjects` + `useUpsertSubject`.
- **Curriculum picker**: new required `Select` with the four standard options + "Other". Saved onto the new `classes.curriculum` column.
- Empty-state copy on the triggers becomes "Add your first grade" / "Add your first subject" so it's obvious that creating one is the next step.

### 3. Wire-through

- `useUpsertClass` payload now includes `curriculum`.
- `class_subjects` insert unchanged.

### Files touched

- New migration: add `classes.curriculum`.
- `src/components/school/CreateClassroomDialog.tsx` — inline-create UX + curriculum field.

No other pages affected; the rest of the school workspace already reads grade/subject by id.

### Out of scope

- Auto-seeding a full standard grade/subject list per curriculum (we considered it, but inline-create gives the teacher control and avoids polluting schools that already curate their own lists).
