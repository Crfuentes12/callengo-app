/**
 * Structured Logger
 * Provides consistent, structured logging across the application.
 * Ready to be connected to external services (Sentry, Datadog, etc.)
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.error('Payment failed', { companyId, error });
 *   logger.warn('Rate limit approaching', { userId, remaining });
 *   logger.info('Sync completed', { provider: 'hubspot', created: 5 });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
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
  context?: Record<string, unknown>
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (context) {
    // Separate error objects from context
    const { error, ...rest } = context;
    if (Object.keys(rest).length > 0) entry.context = rest;
    if (error) entry.error = formatError(error);
  }

  return entry;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = createLogEntry(level, message, context);

  // Structured JSON output for production (parseable by log aggregators)
  const output = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(output);
      // TODO: Send to Sentry/Datadog when configured
      // if (process.env.SENTRY_DSN) Sentry.captureException(...)
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

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
};
