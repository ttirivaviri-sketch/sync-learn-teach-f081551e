import { describe, it, expect, vi } from 'vitest';
import {
  logger,
  logDatabaseQuery,
  logAuthEvent,
  logError,
  logJobEvent,
  logBusinessEvent,
} from './logger';

describe('Logger', () => {
  // Mock logger methods
  const mockInfo = vi.spyOn(logger, 'info');
  const mockWarn = vi.spyOn(logger, 'warn');
  const mockError = vi.spyOn(logger, 'error');
  const mockDebug = vi.spyOn(logger, 'debug');

  it('should log database query as debug when fast', () => {
    logDatabaseQuery('SELECT * FROM users', [], 50);
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'database_query',
        durationMs: 50,
        slow: false,
      })
    );
  });

  it('should log database query as warn when slow', () => {
    logDatabaseQuery('SELECT * FROM users', [], 2000);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'database_query',
        durationMs: 2000,
        slow: true,
      })
    );
  });

  it('should log auth event', () => {
    logAuthEvent('login', 'user-123', { ip: '192.168.1.1' });
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'auth_event',
        event: 'login',
        userId: 'user-123',
        ip: '192.168.1.1',
      })
    );
  });

  it('should log auth failure', () => {
    logAuthEvent('auth_failure', undefined, { reason: 'invalid_password' });
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'auth_event',
        event: 'auth_failure',
        reason: 'invalid_password',
      })
    );
  });

  it('should log errors with stack trace', () => {
    const error = new Error('Test error');
    logError(error, { context: 'test' }, 'req-123');
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Test error',
        requestId: 'req-123',
        context: 'test',
      })
    );
  });

  it('should log job events', () => {
    logJobEvent('email-digest', 'started');
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'job_event',
        jobName: 'email-digest',
        status: 'started',
      })
    );

    logJobEvent('email-digest', 'completed', 5000);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'job_event',
        jobName: 'email-digest',
        status: 'completed',
        durationMs: 5000,
      })
    );

    logJobEvent('email-digest', 'failed', 1000, { reason: 'timeout' });
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'job_event',
        jobName: 'email-digest',
        status: 'failed',
        reason: 'timeout',
      })
    );
  });

  it('should log business events', () => {
    logBusinessEvent('course_enrolled', 'user-123', {
      courseId: 'course-456',
    });
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'business_event',
        eventName: 'course_enrolled',
        userId: 'user-123',
        courseId: 'course-456',
      })
    );
  });
});
