# Quickstart and Validation: 로컬 시연

## 현재 상태와 검증 출처

Fastify·SQLite·JWT·React와 실제 API 연결이 구현되어 있다. 글씨/고대비·정적 병원 안내·복구·반복 시연의 최신 결과는 [최종 체크포인트](../../docs/final-validation-checkpoint.md)를 따른다. preview 응답 테스트와 실제 API 브라우저 검증은 구분한다. Tier C(T052~T064)는 제외했다.

자동 검증·시연은 텍스트 AI/STT 모두 fixture이며 실제 OpenAI/AWS 호출을 하지 않는다. 사용자의 별도 단일 OpenAI 응답 성공 보고(`gpt-4.1-mini-2025-04-14`, live/ready/persisted=false)는 전체 생성·저장·공유의 live 검증이 아니다.

## 준비

저장소 루트에서 Node 22.22.0·npm 10.9.8과 기존 lockfile을 사용한다.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install chromium
```

개발 서버가 실행 중이면 종료하거나 DB를 초기화하지 않는다. 아래는 별도 임시 경로와 미사용 포트를 쓰는 수동 fixture 시연 예다. `NODE_ENV=test`로 로컬 .env 읽기를 끄며 필수 모드를 명시한다. 이 예의 API에는 테스트 전용 reset/중단 경로를 등록하지 않는다. 선택한 포트가 사용 중이면 다른 빈 포트를 지정한다.

```bash
export BATON_DEMO_DIR="$(mktemp -d /tmp/baton-demo.XXXXXX)"
export NODE_ENV=test
export JWT_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
export SQLITE_PATH="$BATON_DEMO_DIR/baton.sqlite"
export UPLOAD_DIR="$BATON_DEMO_DIR/uploads"
export API_PORT=3315 WEB_PORT=5315
export LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false
export LLM_PROVIDER=openai DEMO_TODAY=2026-03-12 ENABLE_TEST_ENDPOINTS=false
export OPENAI_API_KEY= OPENAI_MODEL=
npm run seed -- --database "$SQLITE_PATH"
npm run dev
```

http://127.0.0.1:5315에서 로그인한다. `seed`는 대상 DB를 재생성하므로 기존 DB로 바꾸지 않는다. `--pregenerate`를 추가하면 fixture provider→jobs→저장 전 검증→저장으로 질문·브리핑을 미리 생성한다. 수동 생성 경로를 보여주려면 추가하지 않는다. 반복 시연의 초기 상태는 매회 새 임시 DB로 준비한다. 사용자 서버와 별도이므로 현재 터미널에서 띄운 시연 서버만 Ctrl+C로 종료한다.

기존 개발용 .env를 사용할 경우 `apps/api/.env.example`을 참고해 백엔드 `JWT_SECRET`, `LLM_PROVIDER`, `LLM_MODE`, `STT_MODE`, DB/업로드 경로를 직접 설정한다. `.env`를 덮어쓰거나 커밋하지 않는다. OpenAI live에는 `OPENAI_API_KEY`·`OPENAI_MODEL`이 필요하고 직접 연결 점검은 `LIVE_FALLBACK_TO_FIXTURE=false`로 수동 수행한다. 키는 서버 파일에만 입력한다. 전사 provider는 별개이며 이번에는 fixture만 검증했다.

## 검증 명령

```bash
LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false npm run typecheck
LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false npm run test
LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false npm run build
LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false npm run test:e2e
LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false npm run test:web
LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false node --import tsx scripts/evaluate.ts --report docs/references/final-fixture-evaluation.json
```

API 테스트는 메모리/전용 임시 DB다. 실제 API E2E는 3314/5314·메모리 DB·매회 새 임시 업로드를 사용하고 `.env`를 읽지 않는다. 외부 fetch를 차단하고 키/모델을 지운다. preview 검사는 5313에서 실행하며 실제 API 검증에 합산하지 않는다. 두 Playwright 명령은 결과 폴더를 공유하므로 순서대로 실행한다. `npm run test:e2e -- tests/e2e/rehearsal.spec.ts`는 두 시연 경로를 각각 두 번 연속 실행한다. 리허설 JSON은 test-results에 생성되므로 보존하려면 다음 Playwright 실행 전에 복사한다.

## 가상 계정

비밀번호는 모두 `baton-demo-2026`(가상 시드 전용). 상세는 [seed-story.md](seed-story.md).

| 계정 | 이메일 | 범위 |
|---|---|---|
| 환자 박하늘 | patient@baton.demo | 본인(full) |
| A 박지원 | a@baton.demo | full, 대표 보호자, 위임 꺼짐 |
| B 박지후 | b@baton.demo | companion, 첫 동행 |
| C 정다온 | c@baton.demo | schedule |
| 비구성원 | outsider@baton.demo | 거부 검사 전용 |

## 시연 순서·한계

메모를 저장하면 성공 안내와 내용/질문 체크가 유지된다. 새로 바꾼 메모는 다시 저장해야 정리할 수 있다. 정리는 최신 입력 버전을 확인하고 job 성공의 검토본을 조회한 후 검토 화면으로 간다. 오류는 입력 변경/AI 연결/응답 검증 실패를 구분하며 입력을 유지한다. 공유 확인 후 `공유한 기록 확인하기`로 타임라인을 연다. 자동 공유는 없다. 실제 OpenAI record 재실행 성공은 이번 fixture 검사로 대신하지 않는다.

두 경로의 초기 상태·계정·실행 순서·각 관찰 결과는 [demo.md](../../docs/demo.md)를 따른다. 진료 전 질문·브리핑의 검증된 ready 결과는 허용 범위에 바로 제공하며 record는 명시적 POST share 전까지 가족에게 새 공유본으로 공개하지 않는다.

390×844 Chromium에서 가장 큰 글씨·고대비로 주요 화면의 스크롤 후 조작/내용 잘림을 검사했다. 같은 브라우저 컨텍스트에서 페이지를 닫고 다시 열어 설정 유지를 확인했으며 OS 브라우저 재시작·보조기기 전체 검사는 하지 않았다.

축소 평가 분모는 validation 4건·alert 1건이며 별도 재서술 실패 1건을 기록했다. 20장 문서/실제 음성 평가·의료적 정확성·사람의 30초 이해도는 미검증이다. 실제 음성 파일 대신 가상 바이트와 준비된 STT fixture를 사용한다. 배포·AWS 자원/IAM 변경은 없다.
