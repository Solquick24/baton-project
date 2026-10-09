import { buildApp } from './app.js';
import { loadApiEnv, readConfig } from './shared/config.js';

async function start() {
  loadApiEnv();
  const config = readConfig();
  const app = await buildApp({ config, logger: true });
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10_000).unref();
    try { await app.close(); }
    catch { process.exitCode = 1; }
    finally { clearTimeout(timeout); }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try { await app.listen({ port: config.port, host: '127.0.0.1' }); }
  catch {
    console.error('API를 시작하지 못했어요. 포트와 환경 설정을 확인해 주세요.');
    await shutdown();
    process.exitCode = 1;
  }
}

start().catch((error: unknown) => {
  // Configuration validation only reports variable names, never their values.
  console.error(error instanceof Error && error.message.startsWith('환경 설정')
    ? error.message : 'API 초기화에 실패했어요.');
  process.exitCode = 1;
});
