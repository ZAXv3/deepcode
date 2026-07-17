// ==========================================
// Deepcode Logger
// ==========================================

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Colors
const COLORS = {
  DEBUG: "\x1b[36m", // Cyan
  INFO: "\x1b[32m",  // Green
  WARN: "\x1b[33m",  // Yellow
  ERROR: "\x1b[31m", // Red
  RESET: "\x1b[0m",
  DIM: "\x1b[2m",
} as const;

class Logger {
  private level: LogLevel = "INFO";
  private prefix: string;

  constructor(prefix: string = "deepcode") {
    this.prefix = prefix;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private format(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString().slice(11, 23);
    const color = COLORS[level];
    return `${COLORS.DIM}${timestamp}${COLORS.RESET} ${color}[${level}]${COLORS.RESET} ${COLORS.DIM}${this.prefix}:${COLORS.RESET} ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("DEBUG")) {
      console.debug(this.format("DEBUG", message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("INFO")) {
      console.info(this.format("INFO", message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("WARN")) {
      console.warn(this.format("WARN", message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("ERROR")) {
      console.error(this.format("ERROR", message), ...args);
    }
  }

  child(prefix: string): Logger {
    return new Logger(`${this.prefix}:${prefix}`);
  }
}

export const logger = new Logger();
export { Logger };
