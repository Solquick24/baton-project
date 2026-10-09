import { resolve } from 'node:path';
import { apiDirectory } from '../src/shared/config.js';
import { openDatabase } from '../src/adapters/sqlite/database.js';
import { seedDatabase } from '../../../scripts/seed.js';

export const fixturesDir = resolve(apiDirectory, '../../fixtures');
export const password = 'baton-demo-2026';
export function fixtureDatabase(verbose?: (sql: string) => void) {
  const db = openDatabase(':memory:', verbose ? { verbose } : {});
  seedDatabase(db, { fixturesDir });
  return db;
}
