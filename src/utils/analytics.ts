// Analytics utility for tracking user interactions
export const analytics = {
  // Track page views
  pageView: (page: string) => {
    if (typeof window !== 'undefined') {
      console.log('Analytics: Page view', page);
      // In production, integrate with Google Analytics, Mixpanel, etc.
    }
  },

  // Track user actions
  track: (event: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      console.log('Analytics: Event', event, properties);
      // In production, send to analytics service
    }
  },

  // Track errors
  error: (error: Error, context?: string) => {
    if (typeof window !== 'undefined') {
      console.error('Analytics: Error', error, context);
      // In production, send to error tracking service like Sentry
    }
  },

  // Track performance
  performance: (metric: string, value: number) => {
    if (typeof window !== 'undefined') {
      console.log('Analytics: Performance', metric, value);
      // In production, send to performance monitoring
    }
  }
};