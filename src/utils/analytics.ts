// Analytics utility for tracking user interactions
import { logger } from "@/utils/logger";
import { captureSentryFrontendException, addSentryFrontendBreadcrumb } from "@/lib/sentryFrontend";

export const analytics = {
  // Track page views
  pageView: (page: string) => {
    if (typeof window !== 'undefined') {
      logger.info('Analytics: Page view', page);
      // In production, integrate with Google Analytics, Mixpanel, etc.
    }
  },

  // Track user actions
  track: (event: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      logger.info('Analytics: Event', event, properties);
      // Breadcrumbs make Sentry error reports show what the user was doing.
      // No-ops when Sentry isn't initialized (no DSN).
      try {
        addSentryFrontendBreadcrumb(event, 'user-action', 'info', properties);
      } catch { /* never let telemetry break the app */ }
    }
  },

  // Track errors
  error: (error: Error, context?: string) => {
    if (typeof window !== 'undefined') {
      logger.error('Analytics: Error', error, context);
      // Forward to Sentry (no-op when DSN unset).
      try {
        captureSentryFrontendException(
          error instanceof Error ? error : new Error(String(error)),
          context ? { analytics: { context } } : undefined,
        );
      } catch { /* never let telemetry break the app */ }
    }
  },

  // Track performance
  performance: (metric: string, value: number) => {
    if (typeof window !== 'undefined') {
      logger.info('Analytics: Performance', metric, value);
      // In production, send to performance monitoring
    }
  }
};