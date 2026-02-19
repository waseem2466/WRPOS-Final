/**
 * Local Error Handler for AI Assistant Server
 * Provides consistent error handling within the ai-assistant module
 */

export interface ErrorLog {
  timestamp: string;
  component: string;
  error: Error | string;
  context?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class ErrorHandler {
  private logs: ErrorLog[] = [];
  private maxLogs: number = 100;
  private listeners: ((log: ErrorLog) => void)[] = [];

  /**
   * Log an error with full context
   */
  log(
    component: string,
    error: Error | string | unknown,
    context?: Record<string, unknown>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    const logEntry: ErrorLog = {
      timestamp: new Date().toISOString(),
      component,
      error: errorObj,
      context,
      severity
    };

    this.logs.unshift(logEntry);
    
    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(logEntry);
      } catch (e) {
        console.error('Error listener failed:', e);
      }
    });

    // Console output based on severity
    const consoleMethod = severity === 'critical' || severity === 'high' 
      ? console.error 
      : severity === 'medium' 
        ? console.warn 
        : console.log;

    consoleMethod(`[${component}] ${severity.toUpperCase()}:`, errorObj.message, context || '');
  }

  /**
   * Safe async wrapper that catches and logs errors
   */
  async safeAsync<T>(
    component: string,
    operation: () => Promise<T>,
    fallback?: T,
    context?: Record<string, unknown>
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.log(component, error, context, 'high');
      return fallback;
    }
  }

  /**
   * Safe sync wrapper that catches and logs errors
   */
  safeSync<T>(
    component: string,
    operation: () => T,
    fallback?: T,
    context?: Record<string, unknown>
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      this.log(component, error, context, 'high');
      return fallback;
    }
  }

  /**
   * Get all logs
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Subscribe to error logs
   */
  subscribe(listener: (log: ErrorLog) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Higher-order function to wrap async functions with error handling
 */
export function withAsyncErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  component: string,
  fn: T,
  context?: Record<string, unknown>
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    try {
      return await fn(...args) as ReturnType<T>;
    } catch (error) {
      errorHandler.log(component, error, { args, ...context }, 'high');
      return undefined;
    }
  };
}

/**
 * Higher-order function to wrap sync functions with error handling
 */
export function withSyncErrorHandling<T extends (...args: unknown[]) => unknown>(
  component: string,
  fn: T,
  context?: Record<string, unknown>
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    try {
      return fn(...args) as ReturnType<T>;
    } catch (error) {
      errorHandler.log(component, error, { args, ...context }, 'high');
      return undefined;
    }
  };
}

/**
 * Database error wrapper with specific handling
 */
export async function withDbErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Classify database errors
    let severity: 'medium' | 'high' | 'critical' = 'medium';
    
    if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
      severity = 'critical';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('deadlock')) {
      severity = 'high';
    }

    errorHandler.log('Database', error, { operation }, severity);
    return fallback;
  }
}

/**
 * API error wrapper with specific handling
 */
export async function withApiErrorHandling<T>(
  apiName: string,
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    let severity: 'medium' | 'high' | 'critical' = 'medium';
    
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      severity = 'critical'; // Auth issues
    } else if (errorMessage.includes('429') || errorMessage.includes('quota')) {
      severity = 'high'; // Rate limiting
    }

    errorHandler.log(`API:${apiName}`, error, { api: apiName }, severity);
    return fallback;
  }
}
