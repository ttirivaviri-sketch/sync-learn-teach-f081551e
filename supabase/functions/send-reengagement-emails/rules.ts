export const DAY = 86_400_000;
export function isDue(lastActive: number, now: number, step: number, lastSent: number | null, stopped = false) {
  return !stopped && step < 3 && now - lastActive > 5 * DAY && (lastSent === null || now - lastSent >= 3 * DAY);
}
export function hasFreeSession(taskCount: number) { return taskCount === 0; }