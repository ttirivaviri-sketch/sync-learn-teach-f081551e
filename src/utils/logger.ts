/**
 * Structured logger — replaces raw console.log/warn/error across the codebase.
 *
 * - In production builds (import.meta.env.PROD) only `error` and `warn` emit.
 * - In development, all levels emit with a consistent prefix.
 * - Provides a `createLogger(scope)` factory for component/hook-scoped loggers.
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.info('Booking loaded', { id: booking.id });
 *
 *   // Or scoped:
 *   import { createLogger } from '@/utils/logger';
 *   const log = createLogger('useRealtimeBookings');
 *   log.info('Channel subscribed');
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const isProd = typeof import.meta !== "undefined" && import.meta.env?.PROD;

const shouldEmit = (level: LogLevel): boolean => {
  if (isProd) return level === "warn" || level === "error";
  return true;
};

const formatPrefix = (level: LogLevel, scope?: string): string => {
  const tag = scope ? `[${scope}]` : "";
  const ts = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
  return `${ts} ${level.toUpperCase().padEnd(5)} ${tag}`.trim();
};

const emit = (level: LogLevel, scope: string | undefined, args: unknown[]) => {
  if (!shouldEmit(level)) return;
  const prefix = formatPrefix(level, scope);
  switch (level) {
    case "error":
      console.error(prefix, ...args);
      break;
    case "warn":
      console.warn(prefix, ...args);
      break;
    default:
      console.log(prefix, ...args);
      break;
  }
};

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** Create a scoped logger (e.g. `createLogger('useBookings')`) */
export const createLogger = (scope: string): Logger => ({
  debug: (...args) => emit("debug", scope, args),
  info: (...args) => emit("info", scope, args),
  warn: (...args) => emit("warn", scope, args),
  error: (...args) => emit("error", scope, args),
});

/** Global unscoped logger */
export const logger: Logger = createLogger("");
