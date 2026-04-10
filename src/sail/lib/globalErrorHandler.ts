/**
 * SAIL Global Error Handler
 *
 * Captures unhandled errors and promise rejections and feeds them
 * into the SAIL Detection System for automatic task creation.
 *
 * This should be initialized once at app startup.
 */

import { detectionSystem } from '../detection/detectionSystem';
import { logger } from "@/utils/logger";

let isInitialized = false;

export function initSAILErrorHandler(): void {
  if (isInitialized) return;
  isInitialized = true;

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    detectionSystem.detectError({
      message: event.message || 'Unhandled error',
      stack: event.error?.stack,
      component: event.filename || 'global',
      url: window.location.href,
    }).catch(() => { /* non-critical */ });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    detectionSystem.detectError({
      message: `Unhandled Promise: ${message}`,
      stack,
      component: 'promise-rejection',
      url: window.location.href,
    }).catch(() => { /* non-critical */ });
  });

  // Monitor API performance
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resource = entry as PerformanceResourceTiming;
          // Flag slow API calls (>3s)
          if (resource.duration > 3000 && resource.name.includes('/api/')) {
            detectionSystem.detectSystemIssue({
              type: 'api_latency_high',
              details: `Slow API call: ${resource.name} took ${Math.round(resource.duration)}ms`,
              data: {
                url: resource.name,
                duration_ms: Math.round(resource.duration),
                transferSize: resource.transferSize,
              },
            }).catch(() => { /* non-critical */ });
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    } catch {
      // PerformanceObserver not fully supported
    }
  }

  logger.info('[SAIL] Global error handler initialized');
}
