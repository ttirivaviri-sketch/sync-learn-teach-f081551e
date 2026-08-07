import { describe, it, expect, beforeEach } from 'vitest';
import {
  setStudyIntent,
  consumeStudyIntent,
  clearStudyIntent,
  resolveIntentSubject,
} from './studyIntent';

const subjects = [
  { id: 'sub-phys', name: 'Physical Science', topics: [{ name: 'Newton Laws' }] },
  { id: 'sub-life', name: 'Life Science', topics: [{ name: 'Photosynthesis' }] },
];

describe('studyIntent bus', () => {
  beforeEach(() => {
    clearStudyIntent();
  });

  it('round-trips an intent and is single-use', () => {
    setStudyIntent({ subjectId: 'sub-life', subjectName: 'Life Science', topic: 'Photosynthesis' });
    expect(consumeStudyIntent()).toEqual({
      subjectId: 'sub-life',
      subjectName: 'Life Science',
      topic: 'Photosynthesis',
    });
    expect(consumeStudyIntent()).toBeNull();
  });

  it('ignores empty intents', () => {
    setStudyIntent({});
    expect(consumeStudyIntent()).toBeNull();
  });

  it('broadcasts a live studymode-intent event', () => {
    const seen: unknown[] = [];
    const handler = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener('studymode-intent', handler);
    setStudyIntent({ subjectId: 'sub-phys' });
    window.removeEventListener('studymode-intent', handler);
    expect(seen).toEqual([{ subjectId: 'sub-phys' }]);
  });
});

describe('resolveIntentSubject', () => {
  it('matches by id first', () => {
    expect(resolveIntentSubject({ subjectId: 'sub-phys', subjectName: 'Life Science' }, subjects)?.id)
      .toBe('sub-phys');
  });

  it('falls back to case-insensitive name', () => {
    expect(resolveIntentSubject({ subjectName: 'physical science' }, subjects)?.id).toBe('sub-phys');
  });

  it('falls back to the subject owning the topic', () => {
    expect(resolveIntentSubject({ topic: 'photosynthesis' }, subjects)?.id).toBe('sub-life');
  });

  it('returns undefined for unknown intents or empty subjects', () => {
    expect(resolveIntentSubject({ subjectName: 'Latin' }, subjects)).toBeUndefined();
    expect(resolveIntentSubject({ subjectId: 'sub-phys' }, [])).toBeUndefined();
    expect(resolveIntentSubject(null, subjects)).toBeUndefined();
  });
});
