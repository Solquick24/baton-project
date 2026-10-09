# AGENTS.md — 바통 백엔드 작업 지침

이 파일은 `apps/api`의 작업 지침이다. [루트 AGENTS.md](../../AGENTS.md)를 함께 따르며, 공통 안전 규칙·명세 우선순위·Tier·브랜치 절차를 유지한다. 기본 작업 위치는 `apps/api`다.

## 담당 범위와 참고 문서

- 최신 이슈 #32 작업 브랜치의 실제 API 화면 통합·검증·종료 범위는 [통합 체크포인트](../../docs/api-integration-checkpoint.md)를 우선 확인한다. T020·T026~T029·T033~T036·T045~T047을 fixture API/브라우저로 검증했고 OpenAI key/model 미설정으로 실제 호출은 미실시다. STT fixture, T048~T051·Tier C 미완료 유지. 아래 이전 체크포인트의 미완료 문장은 당시 기록이다. 이번 통합은 사용자 요청대로 커밋 후 중지하며 push/PR/병합은 하지 않는다.

- 기본 수정 범위는 이 앱의 `src/`, `tests/`, API 설정·안내 문서다. 프론트가 연동할 endpoint·응답·오류·버전·모드와 실제 구현 여부를 인수인계한다.
- 루트의 읽는 순서를 따른 뒤 [백엔드 기반 기록](../../docs/backend-foundation-checkpoint.md), [최신 Phase 3 기록](../../docs/phase3-backend-checkpoint.md), [FE 연동 기준](../../docs/fe-api-contract.md)을 확인한다. 이전 기록의 미구현 상태는 최신 코드·검증 기록과 대조한다.
- Phase 4·5 제품 API는 [Phase 4 기록](../../docs/phase4-backend-checkpoint.md), [Phase 5 최신 결과](../../docs/phase5-backend-checkpoint.md), [실제 요청/응답·폴링·버전·파일·캐시 인수인계](../../docs/phase5-api-handoff.md)를 확인한다. 백엔드 직접 API 검증과 프론트 preview/health/실제 화면 통합을 구분한다.
- 블록·응답·작업·검증 형태는 [schemas.md](../../specs/001-baton-mvp/contracts/schemas.md), HTTP는 [api.md](../../specs/001-baton-mvp/contracts/api.md), DB는 [data-model.md](../../specs/001-baton-mvp/data-model.md), 기대값은 [seed-story.md](../../specs/001-baton-mvp/seed-story.md)가 기준이다.
- 루트 scripts·fixtures·공통 계약 변경이 이슈에 필요하면 영향과 연동 범위를 기록한다. 웹 변경이 필요하면 [프론트 지침](../web/AGENTS.md)도 읽는다. 공통 계약·DB 스키마·루트 package.json/lockfile은 한 작업자씩 변경·통합한다. 다른 담당자의 변경을 덮어쓰지 않는다.

## API·권한·저장 경계

- Fastify·SQLite·시드 JWT·TypeScript와 루트에서 고정한 버전을 유지한다. `src/app.ts`는 앱 조립, `src/handlers/`는 HTTP, `src/modules/`는 기능, `src/workers/`는 작업 처리, `src/adapters/`는 외부·저장소 연결이다.
- 매 요청 JWT sub에서 현재 구성원 관계·active·role·scope·행동 권한을 확인한다. JWT나 요청자가 보낸 범위를 권한의 근거로 신뢰하지 않는다. 전체 내용을 볼 수 있는 일반 보호자도 범위 관리 권한은 없다.
- `src/auth/block-policy.ts`의 `ALLOWED_KINDS`가 유일한 범위→kind 표다. 외부 조회는 허용 kind만 SQL SELECT하고 strict 응답을 조립한다. 전체 블록을 읽은 뒤 금지 키를 삭제하는 방식은 금지한다.
- 원문·파일·jobs·질문·홈 개수·오류에도 동일한 권한 경계를 적용한다. 금지 블록 키 자체와 범위 이름·잠금·숨긴 개수가 일반 보호자 응답에 없어야 한다.
- 외부 조회는 `src/adapters/sqlite/visit-repository.ts`, 내부 AI 입력은 `generation-repository.ts`로 분리한다. 생성 입력은 같은 환자·같은 진료과의 적법한 자료만 사용하며 비공개 메모를 어떤 AI 입력에도 넣지 않는다.
- SQL 바인딩·foreign key·트랜잭션을 사용한다. 공유본·검토본·입력 버전을 구분하고 오래된 입력·현재 권한·작업 중복을 저장 직전에 다시 확인한다.
- record는 검토 후 `POST share` 확정으로만 가족에게 공개한다. blocked·입력 버전 불일치는 409이며 공유본·공유 기록·멱등 정보를 원자적으로 저장한다. 진료 전 질문 통합·브리핑 ready 결과는 별도 share 없이 허용 범위에 제공한다.
- 로그·오류 응답에 원문·토큰·비밀·범위 상세를 넣지 않는다. 파일·SQLite·업로드는 공개 static 밖에 두고 `.env`·자격 증명·`data/`는 커밋하지 않는다.

## AI provider 규칙

- `RawLLMProvider`·`LLMProvider` 뒤에 `openai`·`bedrock` 텍스트와 `fixture`를 둔다. 2026-10-09 사용자 결정으로 텍스트 기본 provider는 OpenAI이며 이전 'AI만 AWS' 방향의 추가 예외다([결정·검증](../../docs/openai-provider-checkpoint.md)). `TranscriptionProvider`·STT 선택은 바꾸지 않는다. `buildApp({ llm, stt })`로 주입해 테스트에서 spy로 호출 횟수를 센다.
- `LLM_PROVIDER=openai|bedrock`(기본 openai), `LLM_MODE=fixture|live`(기본 fixture)를 독립적으로 설정한다. OpenAI live에는 백엔드 `OPENAI_API_KEY`·`OPENAI_MODEL`이 필수다. 키는 apps/api/.env에 사용자가 직접 입력하며 채팅·로그·Git·VITE_*에 넣지 않는다. 모델 ID/계정 권한을 확인하지 않고 성공으로 보고하지 않는다.
- OpenAI는 Node fetch로 Responses API POST `/v1/responses`, `store:false`, strict `text.format`을 사용한다. 기존 스키마에서 wire schema만 변환하고 nullable/선택 필드 의미를 바꾸지 않는다. 도구·대화 상태·모델별 temperature/reasoning 옵션을 추가하지 않는다. 거부/불완전 출력은 안전하게 실패하고 형식 오류만 기존 validatedLLM의 최대 1회 재시도를 거친다. fallback 결과는 mode=fixture이며 실제 연결 점검은 fallback=false다.
- fixture provider는 루트 `fixtures/expected/manifest.json`의 규칙으로 파일을 고른다(위에서부터 첫 일치, `whenNoteIncludes`, `failOnAttempts`). 맞는 규칙이 없으면 `ai_unavailable`로 실패한다.
- **fixture 결과도 live와 똑같이 검증기를 통과해야 저장된다.** fixture라고 검증을 건너뛰지 않는다.
- Bedrock: `BedrockRuntimeClient({ region: 'ap-northeast-2' })`, `ConverseCommand`, 모델 ID `anthropic.claude-sonnet-5`(AWS 모델 카드상 서울 in-region 지원, Structured outputs 미지원). 블록 세 개를 한 번에 받는 tool 1개(`save_blocks`)로 유도하되 **스키마 준수를 보장으로 취급하지 않는다**. tool 응답이 없거나 형식이 틀리면 1회 재호출, 그래도 실패면 `validation_failed`. Converse tool use 지원 여부는 T007 샘플 호출로 확인하고, 안 되면 'JSON만 출력' 지시 + 텍스트 파싱으로 바꾼 뒤 기록한다. temperature 0.
- 시스템 프롬프트에 반드시: 정보 정리만, 진단·처방·수치 해석·치료 권고 금지, companion·schedule 문자열에 진단명·검사 수치·변경 사유 금지, 근거 없으면 null.
- Transcribe: ko-KR 배치, 기존 `TRANSCRIBE_STAGING_BUCKET`에 `baton-staging/{patientId}/{jobId}/{uploadId}`로 임시 업로드, 결과를 회수해 구간 id `ts_01, ts_02 …`로 저장. 버킷 값이 비었거나 실패하면 fixture 전사로 대체하고 `mode='fixture'` 표시.
- T039는 기존 Amazon Transcribe를 `transcribe.ts`에 연결했다. fallback은 LIVE_FALLBACK_TO_FIXTURE=true일 때만 사용한다. false이면 버킷 누락/실패를 stt_unavailable로 유지한다. fixture·live·주입 STT 모두 저장 전 구간 검증을 거친다. staging 정리 실패도 live 성공으로 처리하지 않으며 실제 AWS 성공/정리는 미검증이다.
- GET·scope 변경은 저장된 블록만 조회하며 AI를 호출하지 않는다. worker는 실제 저장 결과 없이 성공을 표시하지 않고 자동 공유하지 않는다.
- 기본 LLM/STT 모드는 fixture다. OpenAI/Bedrock 모두 기존 validatedLLM과 파이프라인의 저장 전 안전 검증을 통과해야 저장·공개할 수 있다. 실제 live 성공·의미 안전성은 별도로 검증하고 스키마 통과만으로 안전성을 주장하지 않는다. AWS 호출은 Bedrock·Transcribe와 기존 staging 버킷 사용 범위에 한정하며 새 AWS 자원·IAM 변경·배포는 금지한다.

## apps/api에서 실행하는 명령

| 목적 | 명령 |
|---|---|
| API 개발 서버(:3001) | `npm run dev` |
| API 서버(watch 없음) | `npm run start` |
| API 타입검사 | `npm run typecheck` |
| API fixture·메모리 SQLite 테스트 | `npm run test` |
| 전체 타입검사 / 웹 포함 빌드 | `npm --prefix ../.. run typecheck` / `npm --prefix ../.. run build` |
| 실제 API 기반 E2E | `npm --prefix ../.. run test:e2e` |
| 개발용 가상 DB 재시드 | `npm --prefix ../.. run seed` |
| fixture 질문 통합·브리핑 사전 생성 | `npm --prefix ../.. run seed -- --pregenerate` |

여기의 `npm run build`는 API 타입검사이며 JS 산출물을 만들지 않는다. API는 tsx로 실행하고 공통 계약은 TS 소스로 export한다. 설치와 공통 명령은 루트에서 실행한다.
`.env.example`의 서버 상대 경로는 시작 위치와 관계없이 이 앱 기준으로 해석한다. seed는 지정 DB의 가상 데이터를 다시 만들므로 기존 데이터를 보존해야 하는 검증은 별도 임시 DB·메모리 DB를 사용한다.

## 테스트와 완료 기준

- 각 사용자 이야기의 테스트 작업(T011·T012·T021·T030·T037·T038)을 먼저 쓰고 실패를 확인한 뒤 구현한다.
- 권한 테스트는 화면이 아니라 **API 직접 호출**(Fastify inject)로 한다. 응답 검사는 `Object.keys`로 금지 키의 **부재**를 확인하고 SQL의 허용 kind 제한도 검증한다.
- 기대값은 seed-story.md 4장과 루트 `fixtures/expected/validation.json`·`alerts.json`을 그대로 쓴다. 테스트는 fixture·`SQLITE_PATH=:memory:`이며 실제 AWS 호출을 하지 않는다.
- AI 호출 0회 검증: GET 10회 + scope 변경 3회 동안 provider spy 호출 수가 늘지 않아야 한다.
- 진료과 격리 검증: v_im_03 생성 시 provider가 받은 입력에 `v_os_01`·`ob_03`·`rx_os_01`·`가상록소정`이 없어야 한다.
- 공개 전 검토·blocked 우회 거부·입력 변경·현재 권한 철회·중복 요청·멱등·부분 저장 방지의 해당 수용 기준을 확인한다.
- Phase 체크포인트에서는 루트 전체 typecheck·API test를 실행한다. 실제 기능 handler 없이 계약·repository·테스트 경로만 있는 작업은 제품 API 완료로 계산하지 않는다. Tier C는 명시적 요청이 없으면 미완료로 둔다.
- 완료한 작업 ID·실제 명령/결과·live/fixture·남은 작업·결정 기록을 보고하고 관련 이슈·PR에도 기록한다. 프론트 인수인계에는 실제 등록 API·요청/응답·오류·미구현 의존성을 남긴다.
