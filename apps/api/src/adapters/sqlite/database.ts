import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type BatonDatabase = Database.Database;
export function openDatabase(path: string = ':memory:', options: { verbose?: (sql: string) => void } = {}): BatonDatabase {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path, options.verbose ? { verbose: (sql: unknown) => options.verbose!(String(sql)) } : {});
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
    return db;
  } catch (error) { db.close(); throw error; }
}
