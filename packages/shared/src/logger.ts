// packages/shared/src/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDocker = process.env.NODE_ENV === 'production';

export function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };

  if (isDocker) {
    // JSON for Docker log aggregation (like CloudWatch, Datadog)
    console.log(JSON.stringify(entry));
  } else {
    // Pretty print for development
    const icons = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' };
    console.log(`${icons[level]} [${level.toUpperCase()}] ${message}`, data || '');
  }
}
