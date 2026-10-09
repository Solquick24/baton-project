import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadApiEnv, readConfig } from '../apps/api/src/shared/config.js';
import { OpenAILLM } from '../apps/api/src/adapters/ai/openai.js';
import { validatedLLM, type LLMRequest } from '../apps/api/src/adapters/ai/providers.js';
import { validatePrevisit } from '../apps/api/src/ai/safety/output-validator.js';

/** Explicit manual probe only. No database writes, fixtures fallback, AWS or originals in output. */
async function main() {
  loadApiEnv();
  const config = readConfig();
  if (config.llmProvider !== 'openai' || config.llmMode !== 'live' || config.liveFallbackToFixture) throw new Error('실제 점검은 LLM_PROVIDER=openai, LLM_MODE=live, LIVE_FALLBACK_TO_FIXTURE=false가 필요해요.');
  const raw = new OpenAILLM(config.openaiApiKey, config.openaiModel);
  const request: LLMRequest = { attempt: 1,
    instruction: '입력의 가상 가족 질문 하나만 통합한다. 추가 질문을 만들지 않는다. 원 질문 ID와 인용을 full.basisRefs에 보존한다.',
    input: { patientId: 'p_virtual_check', visitId: 'v_virtual_check', dept: '내과', purpose: 'questions',
      questions: [{ id: 'q_virtual_check', authorId: 'u_virtual_check', visibility: 'companion', text: '다음 진료 날짜를 확인하고 싶어요.' }], records: [], alerts: [] },
  };
  try {
    const result = await validatedLLM(raw).generate(request);
    const checked = validatePrevisit('questions', result.blocks, request.input, []);
    if (result.mode !== 'live' || checked.state !== 'ready') throw new Error('실제 응답의 저장 전 검증을 통과하지 못했어요.');
    console.log(JSON.stringify({ provider: 'openai', model: config.openaiModel, mode: result.mode, state: checked.state, persisted: false }));
  } finally { raw.destroy(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    // All adapter errors are safe. Never print raw upstream error objects or stack.
    console.error(error instanceof Error ? error.message : 'OpenAI 점검을 완료하지 못했어요.'); process.exitCode = 1;
  });
}
