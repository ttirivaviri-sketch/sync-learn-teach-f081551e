// @ts-nocheck
import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for Node.js backend
 * Captures exceptions, performance monitoring, and distributed tracing
 */
export function initSentryBackend() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (!dsn && environment === 'production') {
    console.warn('SENTRY_DSN not set in production - error tracking disabled');
  }

  // Profiling is optional: @sentry/profiling-node is a native module that may
  // not be installed in every environment (e.g. CI, serverless). Load lazily.
  const integrations: any[] = [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.OnUncaughtException(),
    new Sentry.Integrations.OnUnhandledRejection(),
  ];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ProfilingIntegration } = require('@sentry/profiling-node');
    integrations.unshift(new ProfilingIntegration());
  } catch {
    // Profiling package not installed — continue without profiling.
  }

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations,
    beforeSend(event, hint) {
      // Filter out errors in development that are not useful
      if (environment === 'development') {
        if (event.exception) {
          const error = hint.originalException;
          if (error instanceof Error) {
            // Skip test errors
            if (error.message.includes('VITEST')) return null;
          }
        }
      }

      return event;
    },
  });
}

/**
 * Attach user context to Sentry
 * Call this after user authenticates
 */
export function setSentryUserContext(userId: string, email?: string, extra?: any) {
  Sentry.setUser({
    id: userId,
    email,
    ...extra,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearSentryUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for tracing request flow
 */
export function addSentryBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Capture exception with context
 */
export function captureSentryException(
  error: Error,
  context?: Record<string, any>
) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture a message with optional context
 */
export function captureSentryMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureMessage(message, level);
    });
  } else {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Express error handler middleware for Sentry
 */
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

/**
 * Express request handler middleware for Sentry
 */
export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

export default Sentry;
