/**
 * studyIntent — tiny deep-link bus between Home and Study Mode.
 *
 * Home tab buttons ("Physical Science", "Continue Life Science: active recall")
 * set an intent and switch to the Study tab. Study Mode's Dashboard consumes it
 * on mount (or live, via the `studymode-intent` event) and opens the exact
 * subject / resumes the exact topic the learner last worked on.
 */

const KEY = "studymode:intent";

export interface StudyIntent {
  /** Preferred — exact subjects.id */
  subjectId?: string;
  /** Fallback match when the id isn't known (case-insensitive) */
  subjectName?: string;
  /** When set, Study Mode resumes this topic in a session runner */
  topic?: string;
  /** Optional label of the last activity (e.g. "active-recall") */
  taskType?: string;
}

export function setStudyIntent(intent: StudyIntent): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    /* storage blocked */
  }
  try {
    window.dispatchEvent(new CustomEvent("studymode-intent", { detail: intent }));
  } catch {
    /* no window */
  }
}

/** Reads and clears the pending intent (single-use). */
export function consumeStudyIntent(): StudyIntent | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as StudyIntent;
    if (!parsed || (!parsed.subjectId && !parsed.subjectName && !parsed.topic)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStudyIntent(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/**
 * Resolves which subject a study intent points at, given the learner's
 * subjects. Matching order: exact id → case-insensitive name → subject that
 * owns the intent's topic. Shared by Study Mode's Dashboard so Home buttons
 * always land on the right destination.
 */
export function resolveIntentSubject<
  T extends { id: string; name: string; topics?: Array<{ name: string }> }
>(intent: StudyIntent | null | undefined, subjects: T[]): T | undefined {
  if (!intent || subjects.length === 0) return undefined;
  return (
    subjects.find((s) => !!intent.subjectId && s.id === intent.subjectId) ??
    subjects.find(
      (s) => s.name.toLowerCase() === (intent.subjectName ?? "").toLowerCase()
    ) ??
    (intent.topic
      ? subjects.find((s) =>
          (s.topics ?? []).some(
            (t) => t.name.toLowerCase() === intent.topic!.toLowerCase()
          )
        )
      : undefined)
  );
}

