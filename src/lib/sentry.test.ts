import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
import {
  setSentryUserContext,
  clearSentryUserContext,
  addSentryBreadcrumb,
  captureSentryException,
  captureSentryMessage,
} from './sentry';

vi.mock('@sentry/node');

describe('Sentry Backend Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set user context', () => {
    const mockSetUser = vi.fn();
    (Sentry as any).setUser = mockSetUser;

    setSentryUserContext('user-123', 'user@example.com', { role: 'learner' });

    expect(mockSetUser).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'user@example.com',
      role: 'learner',
    });
  });

  it('should clear user context', () => {
    const mockSetUser = vi.fn();
    (Sentry as any).setUser = mockSetUser;

    clearSentryUserContext();

    expect(mockSetUser).toHaveBeenCalledWith(null);
  });

  it('should add breadcrumb', () => {
    const mockAddBreadcrumb = vi.fn();
    (Sentry as any).addBreadcrumb = mockAddBreadcrumb;

    addSentryBreadcrumb('User enrolled in course', 'enrollment', 'info', {
      courseId: 'course-123',
    });

    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      message: 'User enrolled in course',
      category: 'enrollment',
      level: 'info',
      data: { courseId: 'course-123' },
    });
  });

  it('should capture exception with context', () => {
    const mockWithScope = vi.fn((callback) => callback({ setContext: vi.fn() }));
    const mockCaptureException = vi.fn();
    (Sentry as any).withScope = mockWithScope;
    (Sentry as any).captureException = mockCaptureException;

    const error = new Error('Test error');
    captureSentryException(error, { userId: 'user-123' });

    expect(mockWithScope).toHaveBeenCalled();
  });

  it('should capture message with context', () => {
    const mockWithScope = vi.fn((callback) => callback({ setContext: vi.fn() }));
    const mockCaptureMessage = vi.fn();
    (Sentry as any).withScope = mockWithScope;
    (Sentry as any).captureMessage = mockCaptureMessage;

    captureSentryMessage('Test message', 'warning', { source: 'api' });

    expect(mockWithScope).toHaveBeenCalled();
  });
});
