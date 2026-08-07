/**
 * End-to-end style test for the Home tab navigation contract:
 * pressing a subject card or the "Continue …" agenda row must publish a study
 * intent that Study Mode resolves to the right subject/topic destination.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeContinueLearning } from './HomeContinueLearning';
import { consumeStudyIntent, resolveIntentSubject, clearStudyIntent } from '@/studymode/lib/studyIntent';

const subjects = [
  { id: 'sub-phys', name: 'Physical Science', overallMastery: 42, topics: [{ name: 'Newton Laws' }] },
  { id: 'sub-life', name: 'Life Science', overallMastery: 71, topics: [{ name: 'Photosynthesis' }] },
];

vi.mock('@/studymode/hooks/useSubjects', () => ({
  useSubjects: () => ({ data: subjects, isLoading: false }),
}));

vi.mock('@/hooks/useLastSubjectActivity', () => ({
  useLastSubjectActivity: () => ({
    data: {
      'sub-life': {
        subjectId: 'sub-life',
        topicName: 'Photosynthesis',
        source: 'topic_session',
        occurredAt: new Date().toISOString(),
      },
    },
  }),
}));

vi.mock('@/lib/haptics', () => ({ haptic: () => {} }));

describe('Home → Study Mode navigation', () => {
  beforeEach(() => clearStudyIntent());

  it('opens the exact subject when a subject card is tapped', () => {
    const onOpenStudy = vi.fn();
    render(<HomeContinueLearning onOpenStudy={onOpenStudy} />);

    fireEvent.click(screen.getByText('Physical Science'));

    expect(onOpenStudy).toHaveBeenCalledTimes(1);
    const intent = consumeStudyIntent();
    expect(intent).toMatchObject({ subjectId: 'sub-phys', subjectName: 'Physical Science' });
    expect(resolveIntentSubject(intent, subjects)?.name).toBe('Physical Science');
  });

  it('resumes the last topic for a subject with prior activity', () => {
    const onOpenStudy = vi.fn();
    render(<HomeContinueLearning onOpenStudy={onOpenStudy} />);

    expect(screen.getByText(/Resume · Photosynthesis/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Life Science'));

    const intent = consumeStudyIntent();
    expect(intent).toMatchObject({
      subjectId: 'sub-life',
      subjectName: 'Life Science',
      topic: 'Photosynthesis',
      taskType: 'topic_session',
    });
    expect(resolveIntentSubject(intent, subjects)?.id).toBe('sub-life');
    expect(onOpenStudy).toHaveBeenCalled();
  });

  it('never sends a subject card to another subject', () => {
    render(<HomeContinueLearning onOpenStudy={() => {}} />);
    fireEvent.click(screen.getByText('Physical Science'));
    const intent = consumeStudyIntent();
    expect(resolveIntentSubject(intent, subjects)?.id).not.toBe('sub-life');
  });
});
