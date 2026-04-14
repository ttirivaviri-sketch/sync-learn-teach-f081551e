

## Plan: Uber-Style Clean Profile Tabs (Learner + Tutor)

Redesign both profile tabs to follow the Uber Account screen pattern: a clean header with avatar/name/rating, then a 2x2 grid of quick-action buttons, followed by organized menu rows — all detailed content hidden behind taps, not dumped on screen.

### Learner Profile Tab (`src/pages/learner/LearnerProfileTab.tsx`)

**Top section** — Large name (bold, left-aligned like "Solo Cash"), avatar on the right, star rating or study level badge below the name. Clean, no card wrapper.

**2x2 action grid** — Rounded gray buttons (like Uber's Help/Wallet/Safety/Inbox):
- Academic Profile
- Wallet (Payment Methods)
- Bookings
- Study Mode

**Stacked menu rows** — Simple icon + label + chevron rows (no cards). Each navigates or opens a modal:
- Payment History → `onShowAllPayments`
- My Reviews → activity tab
- Change Study Level → navigate
- Syllabus & Paper Codes → existing SyllabusSetupGate
- Settings (sign out lives here)

**Remove from surface**: All the inline academic profile details (curriculum grid, exam dates, subjects list, contact info, goals) — these stay accessible via the "Academic Profile" button which opens the existing `onShowAcademicSetup` modal. Profile stats (sessions/upcoming/spent) move into a subtle single row below the name.

### Tutor Profile Tab (`src/pages/tutor/TutorProfileTab.tsx`)

**Top section** — Bold name, avatar right, rating below.

**2x2 action grid**:
- Earnings (opens inline earnings detail or scrolls to it)
- Wallet (TutorWalletPanel, opened as a section or modal)
- Subjects (TutorSubjectManager)
- Tutorials

**Stacked menu rows**:
- Recent Earnings → shows recent earnings list
- Download Tax Report → existing CSV logic
- Edit Profile → TutorProfile settings
- Earn as Creator → tutorials tab

**Remove from surface**: The 4 earnings stat cards, earnings chart, recent earnings list, wallet panel, subject manager, and profile editor — all hidden behind their respective menu buttons. Content appears when tapped (either scroll-to-section or expandable accordion).

### Technical Approach

- No new components needed — just restructuring JSX in both files
- Use `useState` for toggling expanded sections (e.g., `showEarnings`, `showWallet`)
- Reuse all existing child components (`TutorWalletPanel`, `TutorSubjectManager`, `PaymentHistory`, etc.)
- Style: `bg-muted/50 rounded-2xl` for the 2x2 grid buttons, simple `border-b` divider rows for menu items, `ChevronRight` icons on the right

### Files Changed

- `src/pages/learner/LearnerProfileTab.tsx` — Full restructure
- `src/pages/tutor/TutorProfileTab.tsx` — Full restructure

