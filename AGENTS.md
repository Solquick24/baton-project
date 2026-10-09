# AGENTS.md — 바통(Baton) 구현 에이전트 안내

이 파일은 Codex 같은 코딩 에이전트가 이 저장소에서 작업을 시작하기 전에 읽는 안내다. 사람용 설명은 README.md에 있다.

## 작업 시작 위치와 지침 적용

| 작업 | Codex를 여는 위치 | 함께 읽을 지침 |
|---|---|---|
| 프론트 UI·접근성·API 연결 | `apps/web` | 이 파일 + [프론트 지침](apps/web/AGENTS.md) |
| 백엔드 API·권한·DB·AI·작업 처리 | `apps/api` | 이 파일 + [백엔드 지침](apps/api/AGENTS.md) |
| 공통 계약·루트 설정·여러 앱 통합 | 저장소 루트 | 이 파일 + 변경하는 앱의 지침 |

- 하위 폴더에서 시작해도 루트 지침을 함께 따른다. 앱별 지침은 담당 범위와 검증 방법을 보완하며 공통 안전 규칙·명세 우선순위·Tier·팀 작업 절차를 완화하지 않는다.
- 루트에서 앱 코드를 수정할 때도 해당 앱의 `AGENTS.md`를 먼저 읽는다.
- 이 파일의 경로와 명령은 별도 표시가 없으면 **저장소 루트 기준**이다. 하위 지침의 문서 링크는 해당 파일 기준이다. `apps/web`·`apps/api`에서 루트 명령을 실행할 때는 `npm --prefix ../.. run <명령>`을 사용한다.
- 시작 폴더는 기본 작업 위치다. 수정 범위는 요청한 이슈를 기준으로 정하고, 공통 파일 변경은 9장의 순차 통합 절차를 따른다.

## 1. 지금 상태와 목표

- 바통은 가족이 번갈아 진료에 동행해도 맥락이 끊기지 않게 하는 모바일 웹 MVP다. **해커톤 당일(약 5시간·4명) 로컬 시연용**이다.
- Phase 1(T001–T007), T008–T020 백엔드·공통 기반과 Phase 3 백엔드 T021–T025를 구현했다. T010의 --pregenerate도 fixture provider와 질문·브리핑 파이프라인으로 검증했다. 실제 API는 health·로그인·jobs·환자 목록·홈·타임라인·진료 조회·질문 등록/통합·브리핑 생성/조회다. T020 실제 JWT 세션·요청 취소·캐시 정리는 실제 API로 검증했다. T026–T029 전체 화면 수용 검증과 후속 진료 기능은 미완료다. Phase 3 전체 완료가 아니다. docs/frontend-session-checkpoint.md도 확인한다. docs/phase3-backend-checkpoint.md, docs/backend-foundation-checkpoint.md와 docs/frontend-plan.md를 함께 확인한다.
- 목표: `specs/001-baton-mvp/tasks.md`의 **Tier A 작업**을 끝내 두 시연 경로(이어받기·범위 변경)를 로컬에서 2회 연속 완주하는 것.
- T030~T032의 범위 관리·공유 로그·full 원문 API가 devlop에 병합됐다. [Phase 4 백엔드 체크포인트](docs/phase4-backend-checkpoint.md)를 따른다. T033~T036과 Phase 4 전체 통합은 미완료다. 당시의 사전 검토·게시 보류는 Phase 4 작업에 대한 지시이며 이후 요청의 명시적 커밋·push·PR 승인을 막지 않는다.
- Phase 5 백엔드 T037~T044는 [최신 체크포인트](docs/phase5-backend-checkpoint.md)와 [실제 API 인수인계](docs/phase5-api-handoff.md)를 따른다. 업로드·전사·메모·정리·검토·공유·불일치 제품 API의 fixture 검증은 완료했다. 화면 통합(T045~T047 포함)과 외부 AI 실제 호출 검증은 미완료이며 Phase 5 전체 완료가 아니다. 사용자 담당은 이번 요청에서 백엔드다.

## 2. 읽는 순서

1. `specs/001-baton-mvp/spec.md` — 요구사항(FR·SC)과 범위별 허용표
2. `specs/001-baton-mvp/contracts/schemas.md` — 블록·응답·작업·검증기의 **정확한 형태**
3. `specs/001-baton-mvp/screens.md` — 화면 번호·경로·범위별 표시·testid
   - 실제 화면 배치는 `docs/references/baton-ui-wireframe-selection.pdf`와 `docs/wireframe-integration.md`를 함께 본다. PDF 쪽 번호와 화면 번호는 다르며, PDF가 기능·권한 계약이나 Tier C 구현 범위를 확대하지 않는다.
4. `specs/001-baton-mvp/seed-story.md` — 시드 인물·이야기·범위별 기대값
5. `specs/001-baton-mvp/plan.md`, `data-model.md`, `contracts/api.md`, `research.md`
6. `specs/001-baton-mvp/tasks.md` — 작업 순서와 Tier
7. `.specify/memory/constitution.md` — 원칙 I~V
8. 배경이 더 필요할 때만 `docs/baton_planning_최종.md` 7·8장

`docs/archive/`의 이전 기획안은 **읽지 않는다**(폐기된 자동 공유·Cognito 구성이 남아 있다).

## 3. 충돌할 때의 우선순위

헌장 원칙 I~V > spec.md > schemas.md·screens.md·seed-story.md > plan.md·data-model.md·api.md > tasks.md > 최종 기획안.

- 헌장의 '기본 기술 방향'(Cognito·Lambda·DynamoDB·S3)은 이번 데모에서 로컬 Fastify·SQLite·시드 JWT의 사용자 승인 예외로 대체됐다. 이후 2026-10-09 사용자가 텍스트 생성은 OpenAI API로 변경하기로 명시 결정했다. 이전 plan.md의 'AI만 AWS' 방향에서 텍스트에 한정한 추가 예외이며 [변경 근거·검증](docs/openai-provider-checkpoint.md)과 docs/decisions.md를 따른다. STT는 변경하지 않는다.
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

1. **배포·AWS 자원 생성 금지.** SAM·CDK·Amplify·CloudFormation·새 버킷·IAM 변경을 하지 않는다. 텍스트는 사용자 결정에 따라 OpenAI Responses를 기본 provider로 선택하고 Bedrock 선택지도 보존한다. AWS 사용은 Bedrock·Transcribe 호출과 기존 staging 버킷 범위만.
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

프론트 개발용 모드는 `npm run dev:preview`, 실제 API 프록시는 `npm run dev:web`이다. 프론트 검사는 `typecheck:web`·`build:web`·`test:web`으로 실행한다. `npm run dev`는 기존 API·웹 동시 실행을 유지한다.

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
- `LLM_PROVIDER=openai`(기본) | `bedrock`는 live 텍스트 provider 선택이다. `OPENAI_API_KEY`·`OPENAI_MODEL`은 백엔드 전용이며 OpenAI live에서 필수다. 기본 시연 fixture는 키 없이 동작한다. 실제 연결 확인은 fallback=false로 별도 수행하며 설정만으로 성공이라 보고하지 않는다.
- `LIVE_FALLBACK_TO_FIXTURE=true`면 live 호출이 실패할 때 같은 입력의 fixture를 쓰고 `mode='fixture'`로 저장·표시한다.
- `DEMO_TODAY=2026-03-12` — 서버의 '오늘'(다음 진료 판단). 로그 시각은 실제 시각.
- `ENABLE_TEST_ENDPOINTS=true`일 때만 `GET /api/__test/ai-calls`(provider 호출 횟수)를 등록한다. e2e에서만 켠다.

## 7. AI provider 규칙

provider 구현·fixture 선택·Bedrock·Transcribe 세부 규칙은 [백엔드 지침의 AI provider 규칙](apps/api/AGENTS.md#ai-provider-규칙)에 있다. 루트에서 AI 관련 작업을 시작할 때도 먼저 읽는다.
fixture와 live는 동일한 검증을 통과해야 저장하며, 조회·범위 변경에서 AI 호출은 0회다. 프론트에는 저장된 결과의 실제 모드를 전달해 표시한다.

## 8. 테스트 규칙

- 각 사용자 이야기의 테스트 작업(T011·T012·T021·T030·T037·T038)을 먼저 쓰고 실패를 확인한 뒤 구현한다.
- 권한 테스트는 화면이 아니라 **API 직접 호출**(Fastify inject)로 한다. 응답 검사는 `Object.keys`로 금지 키의 **부재**를 확인한다.
- 기대값은 `specs/001-baton-mvp/seed-story.md` 4장과 `fixtures/expected/validation.json`·`alerts.json`을 그대로 쓴다.
- API의 AI 호출 0회·진료과 격리 검증은 [백엔드 지침](apps/api/AGENTS.md#테스트와-완료-기준), UI·접근성·개발용/실제 API 검증은 [프론트 지침](apps/web/AGENTS.md#검증과-완료-기준)을 따른다.

## 9. 작업 방식

- 사용자는 이 프로젝트의 FE 리드다. 프론트 계획·공통 UI·접근성·API 연결과 리뷰 기준을 이 역할에 맞춰 정리한다.
- 새 작업은 GitHub 이슈를 만들고 최신 `origin/devlop`에서 이슈별 작업 브랜치를 생성해 진행한다. 작업 브랜치를 원격에 push하고 `devlop` 대상으로 PR을 만든 뒤 리뷰·검증 후 병합한다. `main` 반영은 검증한 `devlop → main` PR로 한다. 세부 순서는 [브랜치 작업 방식](docs/branch-workflow.md)을 따른다.
- 코드·문서·환경 설정 변경에 같은 흐름을 적용한다. 실제 `.env`·인증 정보는 5장 10번에 따라 로컬에 두고, 공유할 환경 설정은 `.env.example`에 반영한다.
- Phase 순서대로 진행하고 Phase 체크포인트(tasks.md 각 Phase의 Independent Test)를 통과하면 그 작업을 `- [X]`로 표시한다. 통과 못 한 작업은 체크하지 않는다.
- Phase가 끝날 때마다 `npm run typecheck`와 `npm run test`를 돌리고 커밋한다. 메시지는 팀이 확정한 [커밋 컨벤션](docs/commit-convention.md)을 따른다(예: `Feat: 동행 범위의 저장된 브리핑 조회 추가`).
- 공통 계약(`packages/contracts`)·`schema.sql`·루트 `package.json`/lockfile 변경은 한 번에 한 작업자만. 병렬 작업 중이면 먼저 merge한다.
- 시드·fixture JSON을 바꿔야 하면 `fixtures/expected/validation.json`과 seed-story.md 기대값도 같이 고친다.
- UI는 screens.md의 testid를 그대로 붙인다(e2e가 의존).
- 변경 요약·실제 검증·계약/문서 링크·남은 한계·후속 작업을 채팅뿐 아니라 관련 이슈와 PR 본문 또는 댓글에 기록한다. PR 제목과 본문은 최종 변경 범위에 맞춰 갱신한다.
- devlop/main 병합 뒤 이슈·PR에 반영 결과와 PR/커밋 링크를 갱신하고 저장된 본문·병합 상태를 다시 조회해 확인한다. 푸시·PR 생성·각 브랜치 병합을 구분하며 이슈 완료 조건을 충족했을 때만 닫는다.
- GitHub 작업 양식은 [.github/ISSUE_TEMPLATE/task.yml](.github/ISSUE_TEMPLATE/task.yml)·[.github/pull_request_template.md](.github/pull_request_template.md)를 따른다. CLI로 생성할 때도 같은 항목을 채우며, 본문은 실제 줄바꿈을 보존한 파일을 --body-file로 전달한다.

## 10. 완료 보고

작업을 마치면 다음을 짧게 보고한다: 완료한 작업 ID, 실행한 명령과 결과(통과·실패 수), live/fixture 중 실제로 쓴 모드, 미완료·건너뛴 작업(Tier C 포함), 구현 중 결정(decisions.md에 남긴 것). 실제로 측정하지 않은 수치는 쓰지 않는다. 관련 이슈·PR 링크와 실제 반영 단계도 보고한다. 완료 요약은 최종 응답 전 이슈·PR에도 기록하고 저장 여부를 확인한다.
