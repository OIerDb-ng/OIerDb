import sqlite3 from 'sqlite3';

/**
 * Promise-based wrapper for sqlite3.Database
 * Converts callback-based sqlite3 API to async/await
 */
export class AsyncDatabase {
  private db: sqlite3.Database;

  constructor(filename: string) {
    this.db = new sqlite3.Database(filename);
  }

  async run(sql: string, ...params: any[]): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: Error | null, row: any) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Serialize ensures sequential execution (useful for transactions)
   */
  serialize(fn: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(async () => {
        try {
          await fn();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}
