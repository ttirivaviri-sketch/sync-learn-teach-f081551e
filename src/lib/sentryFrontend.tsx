// @ts-nocheck
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import React from 'react';

/**
 * Initialize Sentry for React frontend
 * Captures React errors, performance monitoring, and user interactions
 */
export function initSentryFrontend() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.MODE || 'development';

  if (!dsn && environment === 'production') {
    console.warn('VITE_SENTRY_DSN not set in production - error tracking disabled');
  }

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations: [
      new BrowserTracing({
        // Set sampling rate for transactions
        tracingOrigins: ['localhost', /^\//],
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          window.history
        ),
      }),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Capture replays for 10% of transactions in production
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0, // Always capture replays for errors
  });
}

/**
 * Set user context for frontend error tracking
 */
export function setSentryFrontendUserContext(
  userId: string,
  email?: string,
  extra?: any
) {
  Sentry.setUser({
    id: userId,
    email,
    ...extra,
  });
}

/**
 * Clear user context on logout
 */
export function clearSentryFrontendUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for tracing user interactions
 */
export function addSentryFrontendBreadcrumb(
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
export function captureSentryFrontendException(
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
 * React Error Boundary for catching component errors
 */
export const SentryErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
  },
  {
    fallback: (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
        }}
      >
        <h1>Something went wrong</h1>
        <p>Our team has been notified. Please try refreshing the page.</p>
      </div>
    ),
    showDialog: true,
    dialogOptions: {
      title: 'Error',
      subtitle: 'Something unexpected happened',
      subtitle2: 'Our team has been notified',
      labelComments: 'What happened?',
      labelClose: 'Close',
      labelSubmit: 'Submit',
      onSubmit: () => {},
    },
  }
);

export default Sentry;
