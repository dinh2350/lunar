// packages/shared/src/logger.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

export function createLogger(service: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => emit('debug', service, msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => emit('info',  service, msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => emit('warn',  service, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => emit('error', service, msg, data),
  };
}

function emit(level: LogLevel, service: string, message: string, data?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...data,
  };

  // JSON for Docker, pretty for dev
  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const icon = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level];
    console.log(`${icon} [${service}] ${message}`, data ? JSON.stringify(data) : '');
  }
}
