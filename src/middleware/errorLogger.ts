import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

/**
 * Express error handling middleware
 * Logs all unhandled exceptions with full context
 */
export function errorLoggerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const correlationId = (req as any).correlationId;

  logger.error({
    type: 'unhandled_exception',
    correlationId,
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
  });

  // Continue with error handling
  next(err);
}
