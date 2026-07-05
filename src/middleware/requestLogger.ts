import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Express middleware to add correlation ID and logging context to requests
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Generate or use existing correlation ID
  const correlationId = req.get('X-Correlation-ID') || uuidv4();
  (req as any).correlationId = correlationId;

  // Log incoming request
  logger.debug({
    type: 'http_request',
    correlationId,
    method: req.method,
    url: req.url,
    headers: sanitizeHeaders(req.headers),
    query: req.query,
  });

  // Capture response time
  const startTime = Date.now();

  // Log response on completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    logger[level]({
      type: 'http_response',
      correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      userAgent: req.get('user-agent'),
    });
  });

  // Pass correlation ID to response headers
  res.set('X-Correlation-ID', correlationId);

  next();
}

/**
 * Remove sensitive headers before logging
 */
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  const sensitiveKeys = ['authorization', 'cookie', 'x-api-key'];
  sensitiveKeys.forEach((key) => {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  });
  return sanitized;
}
