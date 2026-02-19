import type { Pool, PoolClient, QueryResult } from 'pg';
import { errorHandler } from './errorHandler';

const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

// IPC wrapper for Electron
class ElectronPoolWrapper {
  private clientId: string | null = null;

  async connect(): Promise<PoolClient> {
    if (!isElectron) throw new Error('Electron API not available');

    try {
      const result = await (window as any).electronAPI?.dbConnect?.();

      if (!result) throw new Error('No response from database process');
      if (!result.success) throw new Error(result.error || 'Database connection failed');

      this.clientId = result.clientId;

      if (!this.clientId) throw new Error('Failed to get client ID from Electron');

      return this.createMockClient(this.clientId) as unknown as PoolClient;
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      errorHandler.log('Database', err, { operation: 'connect' }, 'high');
      throw err;
    }
  }

  private createMockClient(clientId: string): { query: (text: string, params?: unknown[]) => Promise<unknown>; release: () => Promise<void> } {
    return {
      query: async (text: string, params?: unknown[]) => {
        return await (window as any).electronAPI?.dbQuery?.(text, params, clientId);
      },
      release: async () => {
        await (window as any).electronAPI?.dbRelease?.(clientId);
      },
    };
  }

  async query(text: string, params?: unknown[]) {
    try {
      return await (window as any).electronAPI?.dbQuery?.(text, params);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      errorHandler.log('Database', err, { operation: 'query', query: text }, 'high');
      throw err;
    }
  }

  // Mock 'on' method to satisfy usage
  on(event: string, listener: (...args: any[]) => void) {
    return this;
  }
}

// Export appropriate pool based on environment (always Electron wrapper in renderer)
export const pool = new ElectronPoolWrapper() as unknown as Pool;
export const dbPool = pool;

// Helper function for transactions
export const withTransaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await (pool as any).connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e: unknown) {
    await client.query('ROLLBACK');
    const err = e instanceof Error ? e : new Error(String(e));
    errorHandler.log('Database', err, { operation: 'transaction' }, 'high');
    throw err;
  } finally {
    client.release();
  }
};

// Health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const client = await (pool as any).connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    errorHandler.log('Database', err, { operation: 'healthCheck' }, 'critical');
    return false;
  }
};
