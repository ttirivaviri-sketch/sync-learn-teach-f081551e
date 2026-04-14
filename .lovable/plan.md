

## Plan: Declutter Study Mode — Subjects-Only First Tab + New Profile Tab

### Current Problem
The Study Mode Subjects tab is overloaded with: academic profile card, AI intelligence status, risk indicators, syllabus setup gate, document upload gate, AI readiness message, quick action buttons, exam date prompts, and daily progress stats — all before the actual subject cards.

### Changes

**Dashboard.tsx** — Restructure tabs from 4 to 5:

**Tab 1: Subjects** (clean, subjects only)
- Show ONLY the subject cards grid (sorted by exam proximity)
- Keep the "No subjects yet" empty state
- Keep the document gate badge on individual cards
- Remove everything else from this tab: academic profile card, syllabus gate, document upload CTA, AI message, quick actions bar, exam date prompt, daily progress grid

**Tab 2: Progress** (unchanged)
- AI Progress Insights + Progress Charts (as-is)

**Tab 3: Calendar** (unchanged)
- Exam countdowns + Study Calendar (as-is)

**Tab 4: Review** (unchanged)
- Spaced repetition + weak topics (as-is)

**Tab 5: Profile** (new tab — absorbs removed content)
- Academic Profile card (curriculum/grade/exam year/subjects/AI status/risk levels)
- Syllabus & Paper Codes setup gate (`SyllabusSetupGate`)
- Document upload card
- Daily progress summary grid
- Quick action buttons (Upload, Past Papers, Daily Summary)

**Tab bar**: Change from `grid-cols-4` to `grid-cols-5`, add a Profile tab with `GraduationCap` or `Settings` icon.

### Files Changed
- `src/studymode/components/Dashboard.tsx` — Move content between tabs, add "profile" tab value to state type, add new TabsTrigger + TabsContent

