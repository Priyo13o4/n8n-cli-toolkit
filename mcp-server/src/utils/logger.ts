const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const MCP_MODE = process.env.MCP_MODE === 'stdio';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[LOG_LEVEL as LogLevel];
}

function log(level: LogLevel, message: string, ...args: any[]) {
  if (!shouldLog(level)) return;

  // In MCP stdio mode, only log to stderr to avoid interfering with JSON-RPC
  if (MCP_MODE) {
    console.error(`[${level.toUpperCase()}] ${message}`, ...args);
  } else {
    console.log(`[${level.toUpperCase()}] ${message}`, ...args);
  }
}

export const logger = {
  debug: (message: string, ...args: any[]) => log('debug', message, ...args),
  info: (message: string, ...args: any[]) => log('info', message, ...args),
  warn: (message: string, ...args: any[]) => log('warn', message, ...args),
  error: (message: string, ...args: any[]) => log('error', message, ...args),
};
