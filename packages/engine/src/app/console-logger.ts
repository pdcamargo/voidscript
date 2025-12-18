/**
 * ConsoleLogger - Intercepts and stores console logs for debug panel
 *
 * This resource monkey-patches native console methods to capture all logs
 * in a circular buffer. Logs are stored with timestamps, levels, and extracted
 * prefixes for filtering and display in the debug panel.
 */

export type ConsoleLogLevel = 'log' | 'error' | 'warn' | 'info' | 'debug';

export interface ConsoleLogEntry {
  timestamp: number; // performance.now()
  level: ConsoleLogLevel;
  message: string;
  args: any[];
  prefix?: string; // Extracted [ComponentName]
  source?: string; // File:line where the log was called
}

/**
 * Console logger resource that intercepts console methods and stores logs
 */
export class ConsoleLogger {
  private entries: ConsoleLogEntry[] = [];
  private readonly maxEntries = 1000; // Circular buffer limit

  // Store original console methods for restoration
  private originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  private isIntercepting = false;

  /**
   * Start intercepting console methods
   */
  startIntercepting(): void {
    if (this.isIntercepting) {
      return;
    }

    this.isIntercepting = true;

    // Monkey-patch console methods
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.addEntry('log', args);
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.addEntry('error', args);
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.addEntry('warn', args);
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.addEntry('info', args);
    };

    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      this.addEntry('debug', args);
    };
  }

  /**
   * Stop intercepting and restore original console methods
   */
  stopIntercepting(): void {
    if (!this.isIntercepting) {
      return;
    }

    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;

    this.isIntercepting = false;
  }

  /**
   * Get all captured log entries (readonly)
   */
  getEntries(): readonly ConsoleLogEntry[] {
    return this.entries;
  }

  /**
   * Clear all captured logs
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Add entry to circular buffer
   */
  private addEntry(level: ConsoleLogLevel, args: any[]): void {
    // Implement circular buffer - remove oldest if at capacity
    if (this.entries.length >= this.maxEntries) {
      this.entries.shift();
    }

    const message = this.formatArgs(args);
    const prefix = this.extractPrefix(message);
    const source = this.extractSource();

    this.entries.push({
      timestamp: performance.now(),
      level,
      message,
      args,
      prefix,
      source,
    });
  }

  /**
   * Format console arguments into a single string
   */
  private formatArgs(args: any[]): string {
    return args
      .map((arg) => {
        if (typeof arg === 'string') {
          return arg;
        }
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return '[Circular]';
          }
        }
        return String(arg);
      })
      .join(' ');
  }

  /**
   * Extract prefix from message (e.g., "[ComponentName]")
   */
  private extractPrefix(message: string): string | undefined {
    const match = message.match(/^\[([^\]]+)\]/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract source file and line number from stack trace
   */
  private extractSource(): string | undefined {
    try {
      // Create a stack trace
      const stack = new Error().stack;
      if (!stack) return undefined;

      // Split stack into lines
      const lines = stack.split('\n');

      // Find the first line that's not this file and not the console wrapper
      // Usually the caller is at index 3-4 (Error, addEntry, console.x, actual caller)
      for (let i = 3; i < Math.min(lines.length, 6); i++) {
        const line = lines[i];

        // Skip lines from console-logger.ts itself
        if (line?.includes('console-logger')) continue;

        // Try to extract file:line:column from the stack trace
        // Formats: "at function (file:line:column)" or "at file:line:column"
        const match = line?.match(/(?:at\s+.*?\s+\()?([^)]+):(\d+):(\d+)\)?/);
        if (match) {
          const [, filePath, lineNum] = match;

          // Extract just the filename (not the full path)
          const fileName =
            filePath?.split('/').pop()?.split('?')[0] || filePath;

          // Skip internal files
          if (
            fileName?.includes('node_modules') ||
            fileName?.includes('vite')
          ) {
            continue;
          }

          return `${fileName}:${lineNum}`;
        }
      }
    } catch (e) {
      // Silently fail if stack extraction doesn't work
    }
    return undefined;
  }
}
