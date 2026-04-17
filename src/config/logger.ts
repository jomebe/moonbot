import { env, type LogLevel } from './env.js';

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const shouldLog = (level: LogLevel): boolean => priorities[level] >= priorities[env.LOG_LEVEL];

const write = (level: LogLevel, message: string, meta?: unknown): void => {
  if (!shouldLog(level)) return;

  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  if (meta === undefined) {
    console.log(prefix, message);
    return;
  }

  if (level === 'error') {
    console.error(prefix, message, meta);
    return;
  }

  if (level === 'warn') {
    console.warn(prefix, message, meta);
    return;
  }

  console.log(prefix, message, meta);
};

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
