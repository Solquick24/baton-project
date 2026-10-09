import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { apiDirectory, loadApiEnv, readConfig } from '../apps/api/src/shared/config.js';

// The CLI is wired in Phase 1. DB schema/seed behavior belongs to T009/T010.
// Reject execution before touching a database until those prerequisites exist.
loadApiEnv();
readConfig();
try {
  await access(resolve(apiDirectory, 'src/adapters/sqlite/schema.sql'));
  throw new Error('시드 투입 구현(T010)이 필요합니다.');
} catch {
  console.error('시드 투입은 아직 사용할 수 없어요. Phase 2의 T009(DB)·T010(시드)을 먼저 완료해 주세요. DB는 변경하지 않았습니다.');
  process.exitCode = 1;
}
