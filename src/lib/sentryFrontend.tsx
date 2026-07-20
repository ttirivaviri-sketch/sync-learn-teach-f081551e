import * as Sentry from '@sentry/react';

/**
 * Sentry init for the React frontend (SDK v8 APIs).
 *
 * - No-op when VITE_SENTRY_DSN is unset (dev/sandbox/CI builds stay clean).
 * - 10% trace sampling in production, 100% in development.
 * - Session replay only on errors in production to control quota.
 *
 * Called once from main.tsx before the app renders.
 */
export function initSentryFrontend() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const environment = import.meta.env.MODE || 'development';

  if (!dsn) {
    if (environment === 'production') {
      // eslint-disable-next-line no-console
      console.warn('VITE_SENTRY_DSN not set in production — error tracking disabled');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

/** Set user context after sign-in so errors are attributable. */
export function setSentryFrontendUserContext(
  userId: string,
  email?: string,
  extra?: Record<string, unknown>,
) {
  Sentry.setUser({ id: userId, email, ...extra });
}

/** Clear user context on sign-out. */
export function clearSentryFrontendUserContext() {
  Sentry.setUser(null);
}

/** Add breadcrumb for tracing user interactions. */
export function addSentryFrontendBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>,
) {
  Sentry.addBreadcrumb({ message, category, level, data });
}

/** Capture exception with optional structured context. */
export function captureSentryFrontendException(
  error: Error,
  context?: Record<string, Record<string, unknown>>,
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

export default Sentry;
