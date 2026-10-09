import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DAY, isDue, hasFreeSession } from './rules.ts';
Deno.test('first reminder requires more than five inactive days', () => {
  assertEquals(isDue(0, 5 * DAY, 0, null), false);
  assertEquals(isDue(0, 5 * DAY + 1, 0, null), true);
});
Deno.test('follow-up waits three days after previous delivery', () => {
  assertEquals(isDue(0, 8 * DAY - 1, 1, 5 * DAY), false);
  assertEquals(isDue(0, 8 * DAY, 1, 5 * DAY), true);
});
Deno.test('three reminders exhaust the sequence', () => {
  assertEquals(isDue(0, 12 * DAY, 3, 8 * DAY), false);
});
Deno.test('return or unsubscribe stops reminders', () => {
  assertEquals(isDue(0, 12 * DAY, 1, 6 * DAY, true), false);
  assertEquals(isDue(11 * DAY, 12 * DAY, 1, 6 * DAY), false);
});
Deno.test('free session only advertised when lifetime daily task unused', () => {
  assertEquals(hasFreeSession(0), true);
  assertEquals(hasFreeSession(1), false);
});