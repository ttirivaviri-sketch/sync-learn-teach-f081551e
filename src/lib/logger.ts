import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Configure Pino logger with environment-appropriate settings.
 * - Development: Pretty-printed, human-readable logs
 * - Production: JSON-formatted logs for log aggregation
 */
const loggerConfig = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        singleLine: false,
        translateTime: 'SYS:standard',
      },
    },
  }),
};

/**
 * Main logger instance
 */
export const logger = pino(loggerConfig);

/**
 * Express middleware for HTTP request/response logging
 * Automatically logs incoming requests with correlation IDs
 */
export const httpLogger = pinoHttp({
  logger: logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'debug';
    return 'info';
  },
  genReqId: () => uuidv4(),
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.getHeaders(),
    }),
  },
});

/**
 * Database query logger
 * Use this to log database operations with timing
 */
export function logDatabaseQuery(
  query: string,
  params: any[] = [],
  durationMs: number
) {
  const level = durationMs > 1000 ? 'warn' : 'debug';
  logger[level]({
    type: 'database_query',
    query: query.substring(0, 100), // Truncate for readability
    params: params.length,
    durationMs,
    slow: durationMs > 1000,
  });
}

/**
 * Authentication event logger
 * Logs login, logout, token refresh, and auth failures
 */
export function logAuthEvent(
  event: 'login' | 'logout' | 'token_refresh' | 'auth_failure',
  userId?: string,
  details?: any
) {
  logger.info({
    type: 'auth_event',
    event,
    userId,
    ...details,
  });
}

/**
 * Error logger with context
 * Includes stack traces and request correlation IDs
 */
export function logError(
  error: Error,
  context?: any,
  requestId?: string
) {
  logger.error({
    type: 'error',
    message: error.message,
    stack: error.stack,
    requestId,
    ...context,
  });
}

/**
 * Background job/queue event logger
 */
export function logJobEvent(
  jobName: string,
  status: 'started' | 'completed' | 'failed',
  durationMs?: number,
  details?: any
) {
  const level = status === 'failed' ? 'error' : 'info';
  logger[level]({
    type: 'job_event',
    jobName,
    status,
    durationMs,
    ...details,
  });
}

/**
 * Business event logger
 * Logs significant state changes (user enrolled, assessment submitted, etc.)
 */
export function logBusinessEvent(
  eventName: string,
  userId?: string,
  details?: any
) {
  logger.info({
    type: 'business_event',
    eventName,
    userId,
    ...details,
  });
}
