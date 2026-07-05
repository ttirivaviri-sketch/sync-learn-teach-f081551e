import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requestLoggerMiddleware } from './requestLogger';
import { logger } from '../lib/logger';

describe('requestLoggerMiddleware', () => {
  const mockDebug = vi.spyOn(logger, 'debug');
  const mockInfo = vi.spyOn(logger, 'info');
  const mockWarn = vi.spyOn(logger, 'warn');

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let listeners: any = {};

  beforeEach(() => {
    mockDebug.mockClear();
    mockInfo.mockClear();
    mockWarn.mockClear();
    listeners = {};

    req = {
      method: 'GET',
      url: '/api/courses',
      headers: {
        'user-agent': 'test-client',
      },
      get: vi.fn((key: string) => {
        if (key === 'X-Correlation-ID') return undefined;
        return (req as any).headers[key];
      }),
      query: {},
      body: {},
    };

    res = {
      statusCode: 200,
      set: vi.fn(),
      on: vi.fn((event: string, callback: any) => {
        listeners[event] = callback;
      }),
      getHeaders: vi.fn(() => ({})),
    };

    next = vi.fn();
  });

  it('should generate correlation ID if not provided', () => {
    requestLoggerMiddleware(req as Request, res as Response, next);

    expect((req as any).correlationId).toBeDefined();
    expect(res.set).toHaveBeenCalledWith(
      'X-Correlation-ID',
      (req as any).correlationId
    );
  });

  it('should use existing correlation ID from headers', () => {
    const existingId = 'existing-id-123';
    (req as any).get = vi.fn((key: string) => {
      if (key === 'X-Correlation-ID') return existingId;
      return undefined;
    });

    requestLoggerMiddleware(req as Request, res as Response, next);

    expect((req as any).correlationId).toBe(existingId);
  });

  it('should log incoming request', () => {
    requestLoggerMiddleware(req as Request, res as Response, next);

    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'http_request',
        method: 'GET',
        url: '/api/courses',
      })
    );
  });

  it('should log response on finish with success status', () => {
    requestLoggerMiddleware(req as Request, res as Response, next);

    (res as any).statusCode = 200;
    listeners['finish']();

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'http_response',
        statusCode: 200,
        durationMs: expect.any(Number),
      })
    );
  });

  it('should log response as warn for 4xx status', () => {
    requestLoggerMiddleware(req as Request, res as Response, next);

    (res as any).statusCode = 404;
    listeners['finish']();

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'http_response',
        statusCode: 404,
      })
    );
  });

  it('should log response as warn for 5xx status', () => {
    requestLoggerMiddleware(req as Request, res as Response, next);

    (res as any).statusCode = 500;
    listeners['finish']();

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'http_response',
        statusCode: 500,
      })
    );
  });

  it('should call next middleware', () => {
    requestLoggerMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});
