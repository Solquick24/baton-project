# AGENTS.md — 바통(Baton) 구현 에이전트 안내

이 파일은 Codex 같은 코딩 에이전트가 이 저장소에서 작업을 시작하기 전에 읽는 안내다. 사람용 설명은 README.md에 있다.

## 1. 지금 상태와 목표

- 바통은 가족이 번갈아 진료에 동행해도 맥락이 끊기지 않게 하는 모바일 웹 MVP다. **해커톤 당일(약 5시간·4명) 로컬 시연용**이다.
- Phase 1(T001–T007)의 로컬 실행·설정·검증 기반이 구현됐다. API는 health만 제공하고 웹은 시작 화면만 있다. DB·로그인·사용자 기능·AI provider는 Phase 2 이후 대상이다. 현재 검증 결과는 docs/phase1-checkpoint.md를 읽는다.
- 목표: `specs/001-baton-mvp/tasks.md`의 **Tier A 작업**을 끝내 두 시연 경로(이어받기·범위 변경)를 로컬에서 2회 연속 완주하는 것.

## 2. 읽는 순서

1. `specs/001-baton-mvp/spec.md` — 요구사항(FR·SC)과 범위별 허용표
2. `specs/001-baton-mvp/contracts/schemas.md` — 블록·응답·작업·검증기의 **정확한 형태**
3. `specs/001-baton-mvp/screens.md` — 화면 번호·경로·범위별 표시·testid
4. `specs/001-baton-mvp/seed-story.md` — 시드 인물·이야기·범위별 기대값
5. `specs/001-baton-mvp/plan.md`, `data-model.md`, `contracts/api.md`, `research.md`
6. `specs/001-baton-mvp/tasks.md` — 작업 순서와 Tier
7. `.specify/memory/constitution.md` — 원칙 I~V
8. 배경이 더 필요할 때만 `docs/baton_planning_최종.md` 7·8장

`docs/archive/`의 이전 기획안은 **읽지 않는다**(폐기된 자동 공유·Cognito 구성이 남아 있다).

## 3. 충돌할 때의 우선순위

헌장 원칙 I~V > spec.md > schemas.md·screens.md·seed-story.md > plan.md·data-model.md·api.md > tasks.md > 최종 기획안.

- 헌장의 '기본 기술 방향'(Cognito·Lambda·DynamoDB·S3)은 이번 데모에서 plan.md의 승인 예외(로컬 Fastify·SQLite·시드 JWT, AI만 AWS)로 대체됐다. 그 부분은 plan.md를 따른다.
- 확정되지 않은 사항을 결정의 근거로 사용하지 않는다.
- 문서끼리 맞지 않거나 문서에 없는 결정이 필요하면 **더 좁게 공개하는 쪽**(정보가 덜 나가는 쪽)을 고르고, `docs/decisions.md` 맨 아래 '구현 중 결정' 표에 한 줄을 남긴다. 명세 파일 자체는 고치지 않는다.

## 4. 이번 구현 범위

| Tier | 작업 | 지시 |
|---|---|---|
| A | T001–T049 (Setup·Foundation·US1·US2·US3·US4 설정) | 순서대로 반드시 |
| B | T050, T051, T065(축소판), T066 | Tier A가 끝난 뒤 |
| 항상 마지막 | T067, T068 | 실제 결과 기록 |
| C | T052–T064 (2단계·화면만) | **사람이 명시적으로 요청할 때만** |

`$speckit-implement`를 쓸 때도 Tier C는 건너뛰고 미완료로 둔다. Phase 체크포인트마다 멈추고 결과를 보고한다.

## 5. 절대 규칙(위반하면 완료가 아니다)

1. **배포·AWS 자원 생성 금지.** SAM·CDK·Amplify·CloudFormation·새 버킷·IAM 변경을 하지 않는다. AWS는 Bedrock·Transcribe 호출과 기존 staging 버킷 사용만.
2. **가상 자료만.** 실존 인물·병원·약·질환을 만들지 않는다. 모든 화면에 `가상 데이터` 배지.
3. **조회·범위 변경에서 AI 호출 0회.** GET 경로와 PUT scope는 저장된 블록만 고른다.
4. **허용 블록만 SELECT.** 범위→kind 표(`ALLOWED_KINDS`)는 `apps/api/src/auth/block-policy.ts` 한 곳. 전체를 읽고 키를 지우는 방식 금지. 응답에 금지 블록 **키 자체가 없어야** 한다.
5. **원문·인용·근거 위치·진단·수치·이유·답변·전사·메모 원문·불일치 상세는 full 전용.** companion에게 '원문 보기' 버튼도 만들지 않는다.
6. **자동 공유 금지.** 진료 정리(record)는 `POST share` 확정 후에만 가족에게 보인다. `blocked`·입력 버전 불일치는 409.
7. **범위 정보 비노출.** 일반 보호자 응답·JWT·화면에 다른 가족의 범위, 잠금, 숨긴 개수를 넣지 않는다. 본인 범위 이름도 응답에 넣지 않는다.
8. **AI는 정리만.** 진단·처방 결정·수치 해석·치료 권고 문구를 만들지 않는다. 근거 없는 값은 `null` + `needsCheck=true`.
9. **같은 환자·같은 진료과 입력만.** 생성 입력 repository는 외부 조회 repository와 파일을 분리한다. 비공개 메모는 어떤 AI 입력에도 넣지 않는다.
10. **비밀 커밋 금지.** `.env`, AWS 자격 증명, `apps/api/data/`(SQLite·업로드)는 Git에 넣지 않는다.

## 6. 고정 기술 결정

2026-10-09 npm 조회 후 Node 22.22.0 임시 프로젝트에서 전부 함께 설치하고 `tsc --noEmit`(AWS 클라이언트 포함)·Vitest(Fastify inject + JWT aud/iss/alg=none 거부)·`vite build`가 통과한 조합이다. AWS 실제 호출과 Playwright 브라우저 실행은 확인하지 않았다. T001에서 이 버전으로 고정한다.

| 용도 | 패키지@버전 |
|---|---|
| API | fastify@5.12.5, @fastify/jwt@10.2.4, @fastify/multipart@10.1.3, better-sqlite3@13.0.3, zod@4.6.5 |
| AWS | @aws-sdk/client-bedrock-runtime@3.1148.0, @aws-sdk/client-transcribe@3.1148.0, @aws-sdk/client-s3@3.1148.0 |
| 웹 | react@19.3.0, react-dom@19.3.0, react-router-dom@7.18.4, vite@8.3.4, @vitejs/plugin-react@6.1.2 |
| 도구 | typescript@7.0.2, tsx@4.23.15, vitest@5.0.3, @playwright/test@1.64.0, concurrently@10.0.6 |
| 타입 | @types/node@22.20.5, @types/react@19.3.0, @types/react-dom@19.3.0, @types/better-sqlite3@9.6.0 |

- TypeScript 7에서 문제가 생기면 typescript@5.9.3으로 내리고 `docs/decisions.md`에 기록한다.
- `node:sqlite`는 쓰지 않는다(Node 22에서 experimental). better-sqlite3는 `npm ci --ignore-scripts`로 설치해도 동봉된 prebuild(macOS·Windows·Linux)로 로드됐다(Linux에서 확인).
- 모듈: 모든 워크스페이스 `"type": "module"`, tsconfig는 `module: ESNext`, `moduleResolution: Bundler`, `noEmit: true`, `tsconfig.base.json` 상속(엄격 옵션 유지).
- `@baton/contracts`는 빌드하지 않고 TS 소스를 export한다: `"exports": { ".": "./src/index.ts" }`. API는 `tsx`로 실행한다(배포가 없으므로 JS 빌드 불필요).
- 비밀번호 해시는 `node:crypto` scrypt(`scrypt$<saltB64>$<hashB64>`), 추가 의존성 없음.
- 환경 변수는 Node 22 `process.loadEnvFile()`로 읽는다(파일이 없으면 건너뜀). dotenv 불필요.
- 지도는 외부 SDK 없이 `apps/web/public/hospital/map.svg`·`floor.svg` 정적 그림.

### 실행 명령(T005에서 만든다)

| 명령 | 내용 |
|---|---|
| `npm run dev` | concurrently로 API(`tsx watch apps/api/src/server.ts`, :3001)와 web(Vite, :5173) 동시 실행 |
| `npm run seed` | DB를 지우고 `fixtures/seed`로 다시 만든다. `-- --pregenerate`면 fixture provider로 v_im_03 질문 통합·브리핑까지 생성 |
| `npm run typecheck` | 세 워크스페이스 `tsc --noEmit` |
| `npm run build` | typecheck + `vite build` |
| `npm run test` | Vitest(API). 항상 fixture 모드, `SQLITE_PATH=:memory:` |
| `npm run test:e2e` | Playwright. webServer가 e2e 전용 DB로 seed 후 API·web 실행. 처음 한 번 `npx playwright install chromium` |

입력 없이 성공만 출력하는 가짜 명령을 만들지 않는다.

### 환경 변수

`apps/api/.env.example`·`apps/web/.env.example`에 이름과 기본값이 있다. 상대 경로는 **apps/api 폴더 기준**으로 해석한다(`config.ts`가 `import.meta.url`로 계산). 핵심 값:

- `LLM_MODE`·`STT_MODE` = `fixture`(기본) | `live`. 테스트는 항상 fixture.
- `LIVE_FALLBACK_TO_FIXTURE=true`면 live 호출이 실패할 때 같은 입력의 fixture를 쓰고 `mode='fixture'`로 저장·표시한다.
- `DEMO_TODAY=2026-03-12` — 서버의 '오늘'(다음 진료 판단). 로그 시각은 실제 시각.
- `ENABLE_TEST_ENDPOINTS=true`일 때만 `GET /api/__test/ai-calls`(provider 호출 횟수)를 등록한다. e2e에서만 켠다.

## 7. AI provider 규칙

- `LLMProvider`·`TranscriptionProvider` 인터페이스 뒤에 `bedrock`·`transcribe`(live)와 `fixture` 구현을 둔다. `buildApp({ llm, stt })`로 주입해 테스트에서 spy로 호출 횟수를 센다.
- fixture provider는 `fixtures/expected/manifest.json`의 규칙으로 파일을 고른다(위에서부터 첫 일치, `whenNoteIncludes`, `failOnAttempts`). 맞는 규칙이 없으면 `ai_unavailable`로 실패한다.
- **fixture 결과도 live와 똑같이 검증기를 통과해야 저장된다.** fixture라고 검증을 건너뛰지 않는다.
- Bedrock: `BedrockRuntimeClient({ region: 'ap-northeast-2' })`, `ConverseCommand`, 모델 ID `anthropic.claude-sonnet-5`(AWS 모델 카드상 서울 in-region 지원, Structured outputs 미지원). 블록 세 개를 한 번에 받는 tool 1개(`save_blocks`)로 유도하되 **스키마 준수를 보장으로 취급하지 않는다**. tool 응답이 없거나 형식이 틀리면 1회 재호출, 그래도 실패면 `validation_failed`. Converse tool use 지원 여부는 T007 샘플 호출로 확인하고, 안 되면 'JSON만 출력' 지시 + 텍스트 파싱으로 바꾼 뒤 기록한다. temperature 0.
- 시스템 프롬프트에 반드시: 정보 정리만, 진단·처방·수치 해석·치료 권고 금지, companion·schedule 문자열에 진단명·검사 수치·변경 사유 금지, 근거 없으면 null.
- Transcribe: ko-KR 배치, 기존 `TRANSCRIBE_STAGING_BUCKET`에 `baton-staging/{patientId}/{jobId}/{uploadId}`로 임시 업로드, 결과를 회수해 구간 id `ts_01, ts_02 …`로 저장. 버킷 값이 비었거나 실패하면 fixture 전사로 대체하고 `mode='fixture'` 표시.

## 8. 테스트 규칙

- 각 사용자 이야기의 테스트 작업(T011·T012·T021·T030·T037·T038)을 먼저 쓰고 실패를 확인한 뒤 구현한다.
- 권한 테스트는 화면이 아니라 **API 직접 호출**(Fastify inject)로 한다. 응답 검사는 `Object.keys`로 금지 키의 **부재**를 확인한다.
- 기대값은 `specs/001-baton-mvp/seed-story.md` 4장과 `fixtures/expected/validation.json`·`alerts.json`을 그대로 쓴다.
- AI 호출 0회 검증: GET 10회 + scope 변경 3회 동안 provider spy 호출 수가 늘지 않아야 한다.
- 진료과 격리 검증: v_im_03 생성 시 provider가 받은 입력에 `v_os_01`·`ob_03`·`rx_os_01`·`가상록소정`이 없어야 한다.

## 9. 작업 방식

- 새 작업·커밋·push는 `devlop`에서 진행하고, 검증한 변경을 `main`에 병합한다. 세부 순서는 [브랜치 작업 방식](docs/branch-workflow.md)을 따른다.
- 코드·문서·환경 설정 변경에 같은 흐름을 적용한다. 실제 `.env`·인증 정보는 5장 10번에 따라 로컬에 두고, 공유할 환경 설정은 `.env.example`에 반영한다.
- Phase 순서대로 진행하고 Phase 체크포인트(tasks.md 각 Phase의 Independent Test)를 통과하면 그 작업을 `- [X]`로 표시한다. 통과 못 한 작업은 체크하지 않는다.
- Phase가 끝날 때마다 `npm run typecheck`와 `npm run test`를 돌리고 커밋한다. 메시지는 팀이 확정한 [커밋 컨벤션](docs/commit-convention.md)을 따른다(예: `Feat: 동행 범위의 저장된 브리핑 조회 추가`).
- 공통 계약(`packages/contracts`)·`schema.sql`·루트 `package.json`/lockfile 변경은 한 번에 한 작업자만. 병렬 작업 중이면 먼저 merge한다.
- 시드·fixture JSON을 바꿔야 하면 `fixtures/expected/validation.json`과 seed-story.md 기대값도 같이 고친다.
- UI는 screens.md의 testid를 그대로 붙인다(e2e가 의존).

## 10. 완료 보고

작업을 마치면 다음을 짧게 보고한다: 완료한 작업 ID, 실행한 명령과 결과(통과·실패 수), live/fixture 중 실제로 쓴 모드, 미완료·건너뛴 작업(Tier C 포함), 구현 중 결정(decisions.md에 남긴 것). 실제로 측정하지 않은 수치는 쓰지 않는다.
