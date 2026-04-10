// Analytics utility for tracking user interactions
import { logger } from "@/utils/logger";

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
      // In production, send to analytics service
    }
  },

  // Track errors
  error: (error: Error, context?: string) => {
    if (typeof window !== 'undefined') {
      logger.error('Analytics: Error', error, context);
      // In production, send to error tracking service like Sentry
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