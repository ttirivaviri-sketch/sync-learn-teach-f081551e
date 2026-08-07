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
