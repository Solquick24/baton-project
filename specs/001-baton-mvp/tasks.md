---
description: "최종 기획안 기반 로컬 MVP 구현 작업"
---

# Tasks: 바통 진료 인수인계 MVP

**Input**: `specs/001-baton-mvp/`의 spec·plan·research·data-model·contracts.
**Created**: 2026-10-09
**Prerequisites**: plan.md·spec.md와 현재 사용자 결정: 로컬 서버·SQLite·시드 로그인, AI만 AWS, 검토 후 공유.
**Tests**: 명세 SC와 헌장이 요구하는 권한·근거·저장 블록·공유·E2E 검증을 포함한다. 기능 코드는 아직 없다.
**Organization**: 사용자 이야기별 독립 시연·검증 단위로 나눈다. Phase 1(T001–T007) 실행 기반을 구현·검증했다. 이후 작업은 미수행이다.

## 해커톤 실행 범위 (2026-10-09 보완)

| Tier | 작업 | 기준 |
|---|---|---|
| A — 필수 | T001–T049 | 두 시연 경로(이어받기·범위 변경)와 접근성 설정. 순서대로 |
| B — A 완료 후 | T050, T051, T065(축소판), T066 | 정적 병원 안내·접근성 e2e·평가·복구 검증 |
| 항상 마지막 | T067, T068 | 실제 결과·한계 기록 |
| C — 요청 시에만 | T052–T064 | 2단계·화면만. 시간이 남고 사람이 지시할 때만. 하지 않으면 미완료로 둔다 |

보완 문서: [contracts/schemas.md](contracts/schemas.md)(정확한 JSON 형태), [screens.md](screens.md)(화면 번호·경로·testid),
[seed-story.md](seed-story.md)(시드 이야기·범위별 기대값). 시드·fixture JSON은 `fixtures/`에 이미 있다.
작업 설명과 이 문서들이 다르면 보완 문서를 따른다(AGENTS.md 3장).

## Format: `[ID] [P?] [Story] Description`

[P]는 같은 단계의 서로 다른 파일에서 실행 가능한 작업이다. Setup/Foundation 및 명시된 선행은 먼저 완료한다.
[US1]~[US6]은 spec의 사용자 이야기다. 작업 경로는 만들거나 수정할 실제 위치다.

## Path Conventions

apps/web, apps/api, packages/contracts, fixtures, scripts, tests/e2e를 사용한다.
현재 폴더·workspace 뼈대는 이미 만들어졌으므로 재생성 작업은 넣지 않았다.
작업은 실제 검증 후에만 체크한다. Phase 1 결과·seed 명령의 T010 선행 조건·Bedrock 접근 거부는 docs/phase1-checkpoint.md에 기록했다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 현재 뼈대에 실제 실행·빌드·검증 도구를 추가한다. 배포 도구는 추가하지 않는다.

**Independent Test / Checkpoint**: web/api/contracts 실제 타입 검사·빌드와 SQLite 바인딩 로딩, 로컬 web/API 시작 확인.

- [X] T001 package.json, apps/web/package.json, apps/api/package.json, packages/contracts/package.json과 package-lock.json에 React/Vite/TypeScript/Fastify5/JWT/better-sqlite3/Zod/AWS SDK/Vitest/Playwright를 호환성 확인 후 고정하고 SQLite 네이티브 바인딩을 점검한다.
- [X] T002 apps/web/index.html, apps/web/src/main.tsx, apps/web/vite.config.ts와 apps/web/src/app/App.tsx에 로컬 프론트 진입점·API 프록시·라우팅 기반을 추가한다. 선행: T001.
- [X] T003 apps/api/src/app.ts, apps/api/src/server.ts에 Fastify 조립·로컬 시작·안전한 종료를 추가하고 apps/api/package.json에 실제 dev/build 명령을 정의한다. 선행: T001.
- [X] T004 apps/api/src/shared/config.ts에 환경 변수 로딩(`process.loadEnvFile`)·필수값 검증·apps/api 기준 상대 경로 해석을 구현한다. `.env.example` 두 개와 `.gitignore`(apps/api/data/)는 2026-10-09 보완에서 이미 로컬 구조로 교체했다. 선행: T001.
- [X] T005 package.json, packages/contracts/package.json, packages/contracts/src/index.ts, tsconfig.base.json과 워크스페이스 tsconfig에 실제 dev/seed/typecheck/build/test/test:e2e·계약 export를 추가하고 입력 없는 가짜 성공 명령을 사용하지 않는다. 선행: T002, T003.
- [X] T006 apps/api/vitest.config.ts, playwright.config.ts에 API inject·단위검증·로컬 E2E 도구를 설정하고 테스트는 fixture 모드에서 비용 없이 실행되게 한다. 선행: T005.
- [X] T007 scripts/check-ai-access.ts와 docs/decisions.md에 제공 계정의 서울 Bedrock 후보 모델·Transcribe·기존 staging 버킷 접근과 샘플 호출 결과를 기록한다. 새 AWS 자원을 배포하지 않고 실패 시 fixture로 시연함을 명시한다. 선행: T004.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 공통 계약·저장·인증·권한·jobs·AI provider를 만든다. 이 단계 전에는 사용자 기능을 연결하지 않는다.

**Independent Test / Checkpoint**: 4계정 로그인, 금지 kind 미조회, 원문·위임 권한 거부, 내부 생성 입력과 외부 조회 경로 분리 검증.

- [ ] T008 [P] packages/contracts/src/core.ts와 packages/contracts/src/blocks.ts에 "role=patient/lead/guardian", "scope=schedule/companion/full", "kind=schedule/companion/full", "mode=live/fixture" 및 meta·id/needsCheck·full sourceRefs의 엄격한 런타임 스키마를 정의한다.
- [ ] T009 [P] apps/api/src/adapters/sqlite/schema.sql과 apps/api/src/adapters/sqlite/database.ts에 data-model.md의 users/patients/members/hospitals/visits/block_sets/visit_blocks/questions/notes/transcripts/prescriptions/observations/alerts/jobs/share_logs/uploads 구조·외래키·UNIQUE(visitId,section,version)·UNIQUE(blockSetId,kind)·바인딩·트랜잭션을 구현한다.
- [ ] T010 scripts/seed.ts에 이미 작성된 fixtures/seed/*.json(accounts·patient·hospital·visits·records·questions·observations·prescriptions)을 읽어 DB를 다시 만들고, demoPassword를 scrypt 해시로만 저장하고, alerts 코드 비교를 실행해 fixtures/expected/alerts.json과 같은 Alert를 만든다. `--pregenerate`는 fixture provider로 v_im_03 질문 통합·브리핑을 생성한다. 테스트용 `seedDatabase(db, opts)` 함수로도 export한다. 선행: T009, T008.
- [ ] T011 [P] apps/api/tests/auth.test.ts에 JWT 변조·만료·issuer/audience·비구성원·위임false·현재 관계 재조회·scope 토큰 고정 금지 테스트를 먼저 작성한다.
- [ ] T012 [P] apps/api/tests/block-policy.test.ts에 scope→kind 합집합·미정full 기본·금지 블록 미조회·응답 키 부재·일반 가족 scope 비노출·외부/내부repository 분리 테스트를 먼저 작성한다.
- [ ] T013 apps/api/src/auth/session.ts와 apps/api/src/handlers/auth.ts에 시드 passwordHash 검증·서명 JWT·POST /auth/login을 구현하고 유저 식별만 토큰 인증 문맥으로 신뢰한다. 선행: T011, T010.
- [ ] T014 apps/api/src/auth/permissions.ts와 apps/api/src/auth/block-policy.ts에 매 요청 active/role/scope/위임 검사, 행동 권한과 블록 조회 권한 분리, 기본거부를 구현한다. 선행: T008, T011, T012.
- [ ] T015 apps/api/src/adapters/sqlite/visit-repository.ts와 apps/api/src/shared/response-assembler.ts에 허용 kind만 SELECT·화이트리스트 조립·draft/publishedVersion 선택을 구현한다. 전체 payload 읽기 후 삭제는 쓰지 않는다. 선행: T009, T014.
- [ ] T016 apps/api/src/adapters/sqlite/generation-repository.ts에 patientId/dept/생성목적 검사와 비공개 메모 제외를 구현하고 일반 가족 조회에서는 이 원본 경로를 사용하지 않는다. 선행: T009, T014.
- [ ] T017 apps/api/src/shared/errors.ts와 apps/api/src/shared/logger.ts에 401/403/404/400/409/502 계약·requestId·안전한 오류를 구현하고 원문·토큰·내부경로·다른scope 개수를 노출하지 않는다. 선행: T008.
- [ ] T018 apps/api/src/adapters/ai/providers.ts, apps/api/src/adapters/ai/bedrock.ts, apps/api/src/adapters/ai/fixture.ts에 공통 LLMProvider·live/fixture 출처·모델 tool input 수집·서버 스키마 검사·최대1회 재시도를 구현한다. structured output 보장을 단정하지 않는다. fixture provider는 fixtures/expected/manifest.json 규칙(whenNoteIncludes·failOnAttempts)으로 응답을 고른다. 선행: T008, T017.
- [ ] T019 apps/api/src/modules/jobs/service.ts, apps/api/src/workers/runner.ts와 apps/api/src/handlers/jobs.ts에 "status=queued/running/succeeded/failed"·attempt·버전별중복·재시작running→failed·안전한resultVersion 조회를 구현한다. 선행: T009, T014, T017.
- [ ] T020 apps/web/src/lib/api.ts와 apps/web/src/app/session.tsx에 JWT 연결·401 처리·환자별 캐시·로그아웃·범위변경 시 캐시 제거를 구현하고 브라우저 scope로 서버 권한을 결정하지 않는다. 선행: T013, T008, T002.

## Phase 3: User Story 1 - 진료 맥락 이어받기 (Priority: P1)

**Purpose**: B가 저장된 변경·질문을 보고 같은 과 맥락을 이어받는다.

**Independent Test / Checkpoint**: US3 없이 과거 시드 공유본으로 B의 브리핑·질문을 독립 시연한다. full 근거 확인은 A 계정에서 수행.

- [ ] T021 [P] [US1] apps/api/tests/briefing.test.ts와 apps/api/tests/questions.test.ts에 내과/정형외과 격리·원 질문 관계·companion 원문/이유 부재·조회 AI 0회·미확인 값null/needsCheck=true를 검증하는 테스트를 먼저 작성한다.
- [ ] T022 [US1] apps/api/src/modules/questions/service.ts와 apps/api/src/handlers/questions.ts에 질문별 행 저장·목록·통합 결과·권한·공개 문자열 검증을 구현한다. 선행: T021.
- [ ] T023 [US1] apps/api/src/ai/prompts/merge-questions.ts와 apps/api/src/ai/pipelines/merge-questions.ts에 원 질문 3개→통합 2개+근거 추가 1개, questions 섹션 블록 세트(companion.mergedQuestions·full.basisRefs) 저장과 ready 시 visits.questionsVersion 갱신을 구현한다. fixture 기대값: fixtures/expected/merge-questions/v_im_03.json. 선행: T022.
- [ ] T024 [US1] apps/api/src/ai/prompts/briefing.ts, apps/api/src/ai/pipelines/briefing.ts, apps/api/src/modules/briefing/service.ts와 apps/api/src/handlers/briefing.ts에 같은 과의 공유본 blocks·관찰 메모·열린 alerts·통합 질문으로 briefing 섹션 블록 세트(companion 변경/질문·full 이유/watch/tests/prep/sourceRefs) 생성·버전 포인터·stale 표시·허용 조회를 구현한다. fixture 기대값: fixtures/expected/briefing/v_im_03.json. 선행: T023.
- [ ] T025 [US1] apps/api/src/modules/visits/query.ts와 apps/api/src/handlers/visits.ts에 /me/patients·/home·/timeline·/visits 조회를 공통 assembler로 연결하고 schedule의 확인 항목 개수/질문/원문과 companion의 ALERT 상세를 제외한다. 선행: T015, T021.
- [ ] T026 [US1] apps/web/src/features/auth/LoginPage.tsx와 apps/web/src/features/home/HomePage.tsx에 4계정 로그인·기록 주인 칩·내 기록의 빈 화면·범위에 따른 홈·지난 내과 기록을 구현한다. 선행: T025.
- [ ] T027 [US1] apps/web/src/features/questions/QuestionsPage.tsx에 질문등록·작성자·통합관계·AI 추가·needsCheck를 표시하고 근거는 full에서만 연결한다. 선행: T022, T023.
- [ ] T028 [US1] apps/web/src/features/briefing/BriefingPage.tsx와 apps/web/src/components/SourceViewer.tsx에 B의 변경/질문 중심, A의 전체 내용과 저장된 full.sourceRefs 인용을 표시하고 full이 없으면 원문 버튼 자체를 만들지 않는다. 원문 파일 연결은 T032 완료 후 붙인다. 선행: T024.
- [ ] T029 [US1] tests/e2e/handoff.spec.ts에 B의 첫 동행 30초읽기·질문3개·내과격리·원문 부재·A의 저장 근거 인용 조회·GET10회 AI 0회 수용 시나리오를 검증한다. 파일 다운로드 권한 검증은 US2에서 수행한다. 선행: T026, T027, T028.

## Phase 4: User Story 2 - 공개 범위 관리 (Priority: P1)

**Purpose**: 환자가 세 범위를 변경하고 보호자 응답·공유 기록을 확인한다.

**Independent Test / Checkpoint**: 생성 기능 없이 시드 공유본과4계정으로 세 scope·위임·원문·로그를 독립 검증.

- [ ] T030 [P] [US2] apps/api/tests/members.test.ts와 apps/api/tests/source-access.test.ts에 B의 무단 변경 403·위임 false인 A의 변경 403·scope 반영·원문·인용 full 전용·로그 비노출·kind SELECT spy를 먼저 작성한다.
- [ ] T031 [US2] apps/api/src/modules/members/service.ts와 apps/api/src/handlers/members.ts에 GET members/PUT scope/GET members/{uid}/share-log/GET share-log, "action=start/scope_change/stop/publish" 중 1단계 scope_change 기록(start·publish 시드 기록 조회 포함)과 현재/새값·actor·time 트랜잭션을 구현한다. 같은 값 변경은 로그를 남기지 않는다. 선행: T030.
- [ ] T032 [US2] apps/api/src/adapters/local/files.ts와 apps/api/src/handlers/sources.ts에 full 전용 인증 스트림·환자·진료 소속·경로 탈출 거부·내부 경로 비노출을 구현한다. 공개 static은 사용하지 않는다. 선행: T030.
- [ ] T033 [US2] apps/web/src/features/settings/SharingPage.tsx에 25-2의 세 단계 항목표·민감표시·환자·위임 대표 관리·공유 기록·일반 보호자 범위명 비노출을 구현한다. 선행: T031.
- [ ] T034 [US2] apps/web/src/features/timeline/TimelinePage.tsx에 schedule 공통 정보, companion 약 변경/주의/쉬운요약/질문, full내용을 저장 블록으로 표시하고 이유/진단/수치/원문은 full에만 둔다. 선행: T025.
- [ ] T035 [US2] apps/web/src/app/session.tsx와 apps/web/src/lib/api.ts에 범위변경의 다음조회 반영·이전캐시 제거를 완성하고 GET·scope변경에 AI를 호출하지 않도록 연결한다. 선행: T033, T034.
- [ ] T036 [US2] tests/e2e/scope.spec.ts에 환자→B세 scope변경·C의 일정만 화면·직접 API 호출 403·금지 키 부재·scope 3회 AI 0회·로그조회 수용검증을 추가한다. 선행: T035, T032.

## Phase 5: User Story 3 - 진료 정리·검토·공유 (Priority: P1)

**Purpose**: 가상 음성·메모를 세 블록으로 정리하고 검토 후 공유, full 계정의 불일치를 확인한다.

**Independent Test / Checkpoint**: US1/US2 생성 기능 없이 가상 입력·fixture provider로 정리→검토→공유·A의 불일치를 독립 검증.

- [ ] T037 [P] [US3] apps/api/tests/summary-safety.test.ts에 schedule/companion의 진단명·수치·사유 혼입·quote/sourceRef 유출·알 수 없는 field·근거 없음·fixture 동일 검증을 먼저 작성한다.
- [ ] T038 [P] [US3] apps/api/tests/sharing.test.ts와 apps/api/tests/alerts.test.ts에 ready/blocked/failed·버전충돌·확정 전 가족 비공개·중복 공유·일반 확인 항목과 민감 보류 구분·ALERTfull 전용을 먼저 검증한다.
- [ ] T039 [US3] apps/api/src/adapters/ai/transcribe.ts와 apps/api/src/handlers/audio.ts에 가상 multipart 업로드·형식·크기 검사·patient·visit 소속·recordingAllowed·기존 S3 임시 staging·완료 결과 회수·transcripts 저장·recordInputVersion 증가·fixture 전사(fixtures/expected/transcribe/v_im_03.json) fallback을 구현하고 POST notes도 이 작업에서 구현한다. 선행: T032.
- [ ] T040 [US3] apps/api/src/ai/prompts/structure.ts와 apps/api/src/ai/pipelines/structure.ts에 schedule.nextSchedule·companion.medChanges/easySummary·full 진단/수치/설명/사유/medDetails/답변/근거를 한 번에 생성하고 비중복·null/needsCheck=true를 검증한다. 저장 직전 transcripts 행을 full.transcript로 복사한다. fixture 기대값: fixtures/expected/structure/*.json, 검증 기대값: fixtures/expected/validation.json. 선행: T037.
- [ ] T041 [US3] apps/api/src/ai/safety/block-leak-check.ts와 apps/api/src/ai/safety/output-validator.ts에 낮은 블록·질문·오류의 정규화 문자열 혼입 검사·의료 판단 금지·불명확 값 검사·blocked 상태를 구현하고 재서술을 완전 차단한다고 주장하지 않는다. 선행: T040.
- [ ] T042 [US3] apps/api/src/modules/summaries/service.ts와 apps/api/src/handlers/summaries.ts에 메모 입력 버전·정리 job·세 블록동일 version 트랜잭션·검토본 생성·작성자·관리자의 자기 scope 검토를 구현한다. 선행: T041, T039.
- [ ] T043 [US3] apps/api/src/modules/summaries/share.ts와 apps/api/src/handlers/share.ts에 POST share의 draft/inputVersion·현행 권한·검증 ready·idempotencyKey 검사와 recordPublishedVersion·publish 로그·status=done 원자 저장을 구현하고 자동 공유하지 않는다. 선행: T042, T038, T031.
- [ ] T044 [US3] apps/api/src/modules/alerts/service.ts와 apps/api/src/handlers/alerts.ts에 시드 관찰·처방과 정리 결과 medDetails·처방의 필드별 코드 비교(schemas.md 5장)·두 full 근거·edit_note(새 revision 저장 후 재비교)/reupload(안내만)/confirm_hospital·"status=open/awaiting_confirmation/resolved"를 구현하고 병원 확인 예정은 resolved로 바꾸지 않는다. 기대값: fixtures/expected/alerts.json. 선행: T038.
- [ ] T045 [US3] apps/web/src/features/visit/VisitPage.tsx와 apps/web/src/features/visit/ReviewPage.tsx에 업로드·메모·job진행/실패/fixture표시·자기 허용 블록 검토·공유하기·blocked 안내를 구현한다. 선행: T043, T039.
- [ ] T046 [US3] apps/web/src/features/alerts/AlertsPage.tsx에 환자·A의 full 불일치·원문·처리 내역을 표시하고 companion에는 상세 화면·개수를 제공하지 않는다. 선행: T044.
- [ ] T047 [US3] tests/e2e/review-share.spec.ts에 B의 정리 → 공유 전 A의 신규 정리 비공개·C의 기존 일정 유지 → 공유 확정 → 허용 블록, A의 불일치·혼입 blocked 우회 실패·재정리 시 기존 공유본 보존·실패·중복 재시도를 검증한다. 선행: T045, T046.

## Phase 6: User Story 4 - 접근성·정적 안내 (Priority: P1)

**Purpose**: 전역 글씨·흰 배경 고대비와병원위치를 제공한다.

**Independent Test / Checkpoint**: 다른 생성 기능 없이 정적 화면과 설정으로 검증; 모든 구현 화면에서도 반복검증.

- [ ] T048 [P] [US4] apps/web/src/styles/tokens.css와 apps/web/src/app/display-settings.tsx에 normal/large/extra-large·highContrast 브라우저저장·흰배경/검은글자/진한청록/검은테두리·큰터치영역을 구현한다.
- [ ] T049 [US4] apps/web/src/features/settings/SettingsPage.tsx에 글씨·고대비·로그아웃과 공개 범위 관리 진입을 구현하고 설정을 전역 레이아웃에 적용한다. 선행: T048.
- [ ] T050 [P] [US4] apps/web/public/hospital/map.svg, apps/web/public/hospital/floor.svg와 apps/web/src/features/home/HospitalPage.tsx에 가상 위치·약도·주소·전화·안내 순서·참고 더미 경험을 구현한다. 병원 값은 fixtures/seed/hospital.json, 지도도 정적 SVG로 그리고 외부 지도 SDK는 쓰지 않는다. 길찾기는 없다.
- [ ] T051 [US4] tests/e2e/accessibility.spec.ts에 390px·가장 큰 글씨·고대비의 주요 내용·버튼 잘림·같은 브라우저 재접속 설정 유지·동적 길찾기 부재를 확인한다. 선행: T049, T050.

## Phase 7: User Story 5 - Optional Phase 2 (Priority: P2)

**Purpose**: 1단계 두 경로 완주 후 선택 기능만 보강한다. 이 단계 전체를 5시간 필수 목표로 두지 않는다.

**Independent Test / Checkpoint**: 각 기능은 독립 샘플·기존시드로검증한다. 선택하지 않은 작업은 미완료로 유지한다.

- [ ] T052 [P] [US5] apps/api/tests/phase2.test.ts에 private_notes환자만·AI제외·위임전환·stopactive=false·문서수정이력·방문익명화를 선택기능별로 먼저 검증한다.
- [ ] T053 [US5] apps/api/src/modules/private-notes/service.ts와 apps/api/src/handlers/private-notes.ts에 환자 전용 CRUD·includeInDoctorView와 모든 AI 입력 제외를 구현하고 apps/web/src/features/visit/PrivateNotesPage.tsx에연결한다. 선행: T052.
- [ ] T054 [US5] apps/api/src/handlers/doctor-view.ts와 apps/web/src/features/visit/DoctorViewPage.tsx에 환자가 선택한 메모·기존브리핑/질문재사용의 의사용 화면을 구현하고 새 AI 호출을 하지 않는다. 선행: T053.
- [ ] T055 [US5] apps/api/src/handlers/patient-settings.ts와 apps/web/src/features/settings/PatientSettingsPage.tsx에 환자만 delegated·recordingAllowed를 변경하고 A의 다음 요청 권한을 재조회한다. 선행: T052.
- [ ] T056 [US5] apps/web/src/features/visit/Recorder.tsx에 브라우저 직접 녹음·질문 체크 저장·환자허용false비활성·녹음 중 문구·경과 시간을구현하고실시간 자막은 추가하지 않는다. 선행: T055.
- [ ] T057 [US5] apps/api/src/modules/documents/service.ts, apps/api/src/handlers/documents.ts와 apps/web/src/features/visit/DocumentsPage.tsx에 JPG·PNG 업로드·판독·날짜·진료과 코드 연결·full근거·낮은 확신 null·editedFields를구현하고PDF는 기본 제외한다. 선행: T052.
- [ ] T058 [US5] apps/api/src/modules/members/service.ts와 apps/web/src/features/settings/SharingPage.tsx에 DELETE member의active=false·stop로그·다음 조회 거부를 추가한다. 선행: T052, T031.
- [ ] T059 [P] [US5] apps/web/src/features/timeline/EasySummaryPage.tsx에 저장된companion.easySummary/medChanges와schedule만표시하고full사유/원문은현행 권한에따라추가한다. 별도 AI·API 생성은 없다.
- [ ] T060 [US5] apps/api/src/modules/experiences/service.ts와 apps/web/src/features/home/ExperiencePage.tsx에 순서·대기 구간·팁을 입력하고 공개 자료에 이름·진료·사용자 ID를 저장하지 않는다. 선행: T052.
- [ ] T061 [US5] apps/api/src/ai/pipelines/flows.ts와 apps/web/src/features/timeline/FlowPage.tsx에 같은 과 기록의 결정·관찰·확인 예정만 연결하고 허용 블록만 응답하거나 시간 부족 시 시드 화면으로 표시한다. 선행: T052.

## Phase 8: User Story 6 - 화면만 동의·고지 (Priority: P3)

**Purpose**: 법률 검증이나 실동작이 아닌 와이어프레임 시연을 제공한다.

**Independent Test / Checkpoint**: 01-1·06에서고지항목·별도동의·미정기간·미성년자경로를확인하고실제연결이없음을표시.

- [ ] T062 [P] [US6] apps/web/src/features/auth/ConsentPreviewPage.tsx에 민감정보별도동의·수집이용동의·전문보기·미정기간·거부권·법정대리인경로와화면시연표시를추가한다. 실제 동의 API는 없다.
- [ ] T063 [P] [US6] apps/web/src/features/settings/InvitePreviewPage.tsx에3범위별항목·받는사람/목적/기간/거부권·공유동의·초대코드예시를추가하고실제 계정·가족 연결을 수행하지 않는다.
- [ ] T064 [P] [US6] apps/web/src/features/home/SchedulePreviewPage.tsx와 apps/web/src/features/auth/SignupPreviewPage.tsx에 일정등록·가입/비밀번호찾기화면만제시하고실제등록/인증API를추가하지않는다.

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 선택한 기능만 통합 검증·평가·리허설하고 구현 상태를 정확히 기록한다.

**Independent Test / Checkpoint**: US1~4의두경로2회완주·SC결과·평가분모·검사전후누출률을보고한다. 배포하지 않는다.

- [ ] T065 [P] fixtures/documents/index.json, fixtures/expected/labels.json과 scripts/evaluate.ts에 약20모의자료의추출정확도/불일치탐지율/누출률·혼입검사전후·재서술실패·선택문서수정률의실제 분모를기록한다. **축소판(Tier B)**: 약 20장 모의 문서는 아직 없으므로 fixtures/expected/validation.json의 4건과 alerts.json 1건만으로 검사 전후 누출·불일치 탐지 결과를 실제 분모(n=4, n=1)로 기록하고, 20장 평가는 미수행으로 명시한다.
- [ ] T066 apps/api/tests/recovery.test.ts와 tests/e2e/failure.spec.ts에서재시작running실패·fixture표시·중복작업/공유·scope변경후이전캐시·원문경로탈출·stale검토본공유거부를검증한다.
- [ ] T067 docs/demo.md와 specs/001-baton-mvp/quickstart.md의B이어받기/A상세확인·환자범위변경경로를2회연속완주하고SC-001~010의실제결과를기록한다.
- [ ] T068 README.md, docs/decisions.md와 specs/001-baton-mvp/tasks.md에실제 실행 명령·완료 작업·미선택 2단계·화면만/fixture·한계를반영하고자격 증명·SQLite·uploads의 Git 제외를 확인한다.

## Dependencies & Execution Order

### Phase Dependencies

Setup → Foundation → US1~4 → 최종 검증. US5/US6은 선택 단계이며 생략해도1단계 완료를 막지 않는다.
각 이야기 내부는 테스트 계획→모듈·서비스→routes→UI→수용검증 순서다.
테스트 작업은 먼저 작성해 예상 실패를 확인한 뒤 해당 구현을 검증한다.

### User Story Dependencies

US1·US2·US3·US4는 Foundation과 시드 공유본으로 각각 독립 검증 가능하다.
US2 timeline의실제연결은US1 query, US3파일경로는US2 sources, 공유로그는US2 members를 재사용한다.
따라서 실제 통합은US1→US2→US3 순서를 기본으로 하고 개별모듈은분리계약으로개발한다.
US4스타일은Foundation후일찍진행해처음화면부터적용한다.
US5개별선행을확인하고공유member파일수정(stop)은US2작업완료후에진행한다.
US6화면은Foundation후가능하나핵심시간을소모하지않도록후순위로둔다.

### Parallel Opportunities

공통schema/repository/JWT계약이정해진뒤프론트는모의응답, API는실제저장, AI는provider/검증을분담한다.
rootpackage/lockfile·공통계약·공통DBschema수정은한담당자가먼저완료한다.
같은 파일을수정하는작업은[P]로표시하지않았으며진행중작업의선행이끝나기전시작하지않는다.

## Parallel Example: User Stories

- US1: T021 (apps/api/tests/briefing.test.ts와 apps/api/tests/questions.test.ts).
- US2: T030 (apps/api/tests/members.test.ts와 apps/api/tests/source-access.test.ts).
- US3: T037 (apps/api/tests/summary-safety.test.ts), T038 (apps/api/tests/sharing.test.ts와 apps/api/tests/alerts.test.ts).
- US4: T048 (apps/web/src/styles/tokens.css와 apps/web/src/app/display-settings.tsx), T050 (apps/web/public/hospital/map.svg, apps/web/public/hospital/floor.svg와 apps/web/src/features/home/HospitalPage.tsx).
- US5: T052 (apps/api/tests/phase2.test.ts), T059 (apps/web/src/features/timeline/EasySummaryPage.tsx).
- US6: T062 (apps/web/src/features/auth/ConsentPreviewPage.tsx), T063 (apps/web/src/features/settings/InvitePreviewPage.tsx), T064 (apps/web/src/features/home/SchedulePreviewPage.tsx와 apps/web/src/features/auth/SignupPreviewPage.tsx).

## Implementation Strategy

### MVP First

1. Setup·Foundation·4계정 시드·권한검증을완료한다.
2. US1저장브리핑→US2환자범위변경을먼저시연한다.
3. US3의가상 음성→정리→검토 후 공유→환자/A의 불일치를연결한다.
4. US4접근성을처음부터적용하고두경로를2회완주한다.
5. US5 선택 2단계·US6 화면만(Tier C)은 핵심 완주 후 사람이 명시적으로 요청할 때만 진행한다. 배포는 없다.

### Incremental Delivery

각이야기를시드/fixture로먼저검증한뒤live AWS호출을붙인다.
fixture도동일스키마·혼입검사를거치고실제처리와구분한다.
미구현·미선택 2단계는체크하지않고결과에명시한다.

### Parallel Team Strategy

프론트: US1UI·US4. 로컬API/DB/인증: Foundation·US2.
AI/검증: US3. 시드/데모/평가:4계정·자료·최종 평가.
서로 다른 파일에서작업하되공통계약·schema·lockfile변경은순서대로통합한다.

## Notes

사용자가말한task.md는Spec Kit표준파일명tasks.md로생성했다. 별도중복파일은없다.
모든작업은미완료로시작한다. 문서품질검토통과는기능완료가아니다.
동행에는인용도없고원문은 full 전용이다. GET·scope변경에서AI호출은0회여야한다.
기술예외는이번사용자선택의가상로컬데모에한정한다.


## Requirement Traceability

| 요구사항 | 구현·검증 작업 |
|---|---|
| FR-001 | T026, T013 |
| FR-002 | T016, T021 |
| FR-003 | T022, T023 |
| FR-004 | T016, T053 |
| FR-005 | T008, T042 |
| FR-006 | T021, T035, T036 |
| FR-007 | T012, T015, T030 |
| FR-008 | T008, T041 |
| FR-009 | T030, T028, T034 |
| FR-010 | T008, T040 |
| FR-011 | T041, T065 |
| FR-012 | T040, T059 |
| FR-013 | T037, T041 |
| FR-014 | T043, T045 |
| FR-015 | T038, T043, T047 |
| FR-016 | T031, T043 |
| FR-017 | T008, T012, T036 |
| FR-018 | T011, T031 |
| FR-019 | T012, T033 |
| FR-020 | T011, T030, T066 |
| FR-021 | T007, T039 |
| FR-022 | T019, T045, T066 |
| FR-023 | T038, T044 |
| FR-024 | T044, T046 |
| FR-025 | T019, T043, T066 |
| FR-026 | T048, T051 |
| FR-027 | T048, T051 |
| FR-028 | T050, T051 |
| FR-029 | T053, T054 |
| FR-030 | T055, T056 |
| FR-031 | T057, T065 |
| FR-032 | T058, T052 |
| FR-033 | T062, T063 |
| FR-034 | T010, T018, T068 |
| FR-035 | T060, T052 |
| FR-036 | T061, T052 |
