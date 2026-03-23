/**
 * Structured Logger with Correlation IDs
 * Provides consistent, structured logging across the application.
 * Ready to be connected to external services (Sentry, Datadog, etc.)
 *
 * FIX #11: Added correlation ID support for request tracing and
 * createLogger() factory for module-scoped loggers.
 *
 * Usage:
 *   import { logger, createLogger } from '@/lib/logger';
 *
 *   // Global logger (simple usage)
 *   logger.error('Payment failed', { companyId, error });
 *
 *   // Module-scoped logger with correlation ID (for request tracing)
 *   const log = createLogger('webhook', { correlationId: callId });
 *   log.info('Processing call webhook', { companyId });
 *   log.error('Failed to process', { error: err.message });
 */

import crypto from 'crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  module?: string;
  message: string;
  timestamp: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface LoggerInstance {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  /** Create a child logger that inherits module + correlation ID and adds extra context */
  child: (extraContext: Record<string, unknown>) => LoggerInstance;
}

function formatError(err: unknown): LogEntry['error'] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: 'UnknownError', message: String(err) };
}

function createLogEntry(
  level: LogLevel,
  message: string,
  module?: string,
  correlationId?: string,
  context?: Record<string, unknown>
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (module) entry.module = module;
  if (correlationId) entry.correlationId = correlationId;

  if (context) {
    // Separate error objects from context
    const { error, ...rest } = context;
    if (Object.keys(rest).length > 0) entry.context = rest;
    if (error) entry.error = formatError(error);
  }

  return entry;
}

function emitLog(level: LogLevel, entry: LogEntry) {
  // Structured JSON output for production (parseable by log aggregators)
  const output = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'info':
      console.info(output);
      break;
    case 'debug':
      if (process.env.NODE_ENV !== 'production') {
        console.debug(output);
      }
      break;
  }
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = createLogEntry(level, message, undefined, undefined, context);
  emitLog(level, entry);
}

/** Global logger (backwards-compatible) */
export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
};

/**
 * Create a module-scoped logger with optional correlation ID.
 * All log entries include the module name and correlation ID for tracing.
 */
export function createLogger(
  module: string,
  initialContext: { correlationId?: string; [key: string]: unknown } = {}
): LoggerInstance {
  const { correlationId, ...baseContext } = initialContext;

  function moduleLog(level: LogLevel, message: string, data?: Record<string, unknown>) {
    const mergedContext = { ...baseContext, ...data };
    const entry = createLogEntry(level, message, module, correlationId, mergedContext);
    emitLog(level, entry);
  }

  return {
    debug: (message, data) => moduleLog('debug', message, data),
    info: (message, data) => moduleLog('info', message, data),
    warn: (message, data) => moduleLog('warn', message, data),
    error: (message, data) => moduleLog('error', message, data),
    child: (extraContext) => createLogger(module, { correlationId, ...baseContext, ...extraContext }),
  };
}

/** Generate a unique correlation ID for request tracing */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}
