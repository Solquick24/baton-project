import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type BatonDatabase = Database.Database;
export function initializeSchema(db: BatonDatabase) {
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  const columns = db.pragma('table_info(jobs)') as Array<{ name: string }>;
  db.transaction(() => {
    // Preserve pre-contract-update jobs. Their absent upload identity is never guessed.
    if (columns.length && !columns.some((column) => column.name === 'uploadId')) {
      db.exec('ALTER TABLE jobs RENAME TO jobs_before_upload_identity');
      db.exec(schema);
      db.exec(`INSERT INTO jobs (id,patientId,visitId,requestedBy,kind,inputVersion,status,attempt,mode,resultVersion,resultState,errorCode,createdAt,updatedAt)
        SELECT id,patientId,visitId,requestedBy,kind,inputVersion,status,attempt,mode,resultVersion,resultState,errorCode,createdAt,updatedAt FROM jobs_before_upload_identity`);
      db.exec('DROP TABLE jobs_before_upload_identity');
    } else db.exec(schema);
  })();
}
export function openDatabase(path: string = ':memory:', options: { verbose?: (sql: string) => void } = {}): BatonDatabase {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path, options.verbose ? { verbose: (sql: unknown) => options.verbose!(String(sql)) } : {});
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    initializeSchema(db);
    return db;
  } catch (error) { db.close(); throw error; }
}
