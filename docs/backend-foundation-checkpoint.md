# 백엔드·공통 기반 체크포인트 — T008~T019

2026-10-09. 사용자 요청 범위는 T008~T019이며 T020·apps/web·T021 이후·Tier C는 제외했다.
시작 브랜치는 `codex/phase1-setup`, 미커밋 변경은 없었다. 기존 브랜치와 로컬 main 커밋을 보존하고 `devlop`을 `3343ea1`로 fast-forward했다. PR #4의 Phase 1 구현이 이미 병합되어 그대로 재사용했다.
최종 원격 확인에서 PR #6의 문서·FE 계약 변경 `1343afe`를 발견했다. 구현을 `81b862a`로 먼저 보존한 뒤 최신 devlop을 병합하고 변경된 계약에 맞춰 재검증했다. tasks.md 충돌은 검증한 완료 상태와 원격 T008 추가 조건을 함께 보존했다. 원격 UI 문서만 반영했으며 apps/web 구현은 변경하지 않았다.

## 작업 상태

| 작업 | 상태·근거 |
|---|---|
| T008 | 완료: core·blocks·api strict 런타임 스키마와 타입, meta·근거·모드·로그인·오류·jobs·VisitView 및 FE 요청/응답 export. 기존 모든 블록 fixture 파싱, 알 수 없는 키·중복 ID·AI 추가 질문 근거 누락 거부. 최신 record-input·draft 버전·canResolve·blocked·멱등 계약 포함 |
| T009 | 완료: 명세의 17개 기본 테이블(share_requests 포함), CHECK·FK·복합 환자/진료 FK·세트/블록 UNIQUE·생성/전사별 jobs 중복 인덱스, 바인딩·트랜잭션. 기존 jobs 행을 보존하는 uploadId 스키마 갱신 검증 |
| T010 | **부분 구현·미완료**: 기본 시드 재생성·scrypt 해시·코드 기반 관찰/처방 불일치·seedDatabase export는 검증. --pregenerate는 T023·T024 의존성이 없어 DB를 열거나 변경하기 전에 거부 |
| T011 | 완료: 인증 구현 전에 테스트 작성·실패 확인, 이후 JWT 변조·만료·aud/iss·알고리즘·현재 관계·위임·토큰 scope 미신뢰 검증 |
| T012 | 완료: 권한/repository 구현 전에 테스트 작성·실패 확인, 이후 SQL kind 제한·금지 키 부재·범위 비노출·외부/내부 경로 분리 검증 |
| T013 | 완료: POST 로그인, scrypt 확인, HS256·iss=baton-local·aud=baton-web·8h, sub만 인증 문맥으로 사용. 필요한 T010 기본 계정/해시 의존성은 검증됨; pregenerate는 로그인 선행이 아님 |
| T014 | 완료: 매 요청 구성원 active/role/scope·환자 본인·지정 대표/위임 검사, 행동 권한과 읽기 kind 분리, 알 수 없는 행동 기본 거부 |
| T015 | 완료: 외부 readVisit repository·strict assembler, published/draft 포인터·검토 권한·draft inputVersion/stale 필수·stale/blocked shareable=false·SQL에서 허용 kind와 issue만 선택. blocked companion은 payload SELECT 없이 blocks={}, full 검토자도 full만 선택 |
| T016 | 완료: 내부 생성 입력 repository 분리, 같은 환자·진료과·목적·과거 공유본/시점 검사, 비공개 메모 제외. 실제 생성 endpoint는 미구현 |
| T017 | 완료: 401/403/404/400/409/502/500 공통 오류 계약·서버 requestId·원문/경로/토큰 없는 로그. 내부 오류는 internal_error, 파일 오류는 413/file_too_large·415/unsupported_media_type. 실제 업로드 handler는 범위 밖 |
| T018 | 완료: 공통 LLM/STT 인터페이스, Bedrock tool input·fixture manifest 선택, live/fixture 동일 strict 스키마 검사·최대 1회 스키마 재시도·fixture fallback 모드 표시. 실제 live 성공이나 의미 안전성을 뜻하지 않음 |
| T019 | 완료: 생성은 inputVersion·전사는 uploadId별 중복/attempt·worker claim/실패/완료·재시작 running→failed·실제 저장 결과 version 및 같은 upload 전사 확인·GET jobs 권한·현행 입력/권한 재검사. 생성 파이프라인은 후속 작업에서 주입 |

T020이 제외되고 T010이 미완료이므로 **Phase 2 전체 완료가 아니다**. T021 이후와 Tier C는 수행하거나 완료 표시하지 않았다.

## 실제 검사 결과

- Spec Kit prerequisite 통과, 명세 체크리스트 16/16(읽기 전용). `.specify/extensions.yml`이 없어 전/후 확장 hook 없음.
- T011·T012 구현 전 최초 API 실행: **24 실패 / 21 통과**(총 45). 로그인 경로 부재 및 인증/권한 모듈 부재로 실패한 것을 확인했다. 최종 검사에서는 같은 테스트도 통과했다.
- `npm run typecheck`: API/web/contracts/scripts/Playwright 통과.
- `npm run build`: 타입 검사 및 기존 Vite 프론트 빌드 통과.
- `npm run test`: **82 통과 / 0 실패**, 7개 파일. 모두 fixture 모드·메모리 SQLite. SDK send 차단 유지.
- `npm run test:e2e`: **1 통과 / 0 실패**, Chromium 390×844, 기존 시작 화면·직접 /login 진입·Vite→API health 프록시 호환. fixture 모드·메모리 SQLite, 프론트 코드 수정 없음.
- `npm run seed`: 최초 앱 DB와 분리한 임시 DB, 최신 계약 반영 뒤 메모리 DB에서 각각 exit 0, 사용자 5·진료 4·공유 record 3·Alert 1. Alert는 expected/alerts.json과 정확히 일치(가변 id·시각 제외). 원문 비밀번호 미저장·재시드·FK·중복·rollback도 메모리 테스트로 확인했다. CLI의 tsx IPC 소켓 제한은 승인된 재실행으로 해결했다.
- `npm run seed -- --pregenerate`: 예상한 exit 1과 T023/T024 안내. 지정한 임시 DB 파일이 생성되지 않은 것을 별도로 확인했다.
- 외부 조회 HTTP 테스트에서 schedule/companion의 SELECT 조건과 Object.keys 부재 확인. 생성 HTTP 시험 경로의 provider spy에서 v_os_01·ob_03·rx_os_01·가상록소정·비공개 sentinel 미포함, 미래 관찰 제외. GET 10회 중 provider 호출 증가 없음.
- 최신 FE 계약 반영 도중 타입 optional/undefined 불일치와 테스트 upload SQL placeholder 수 오류를 발견·수정했다. 중간 API 검사는 77 통과/3 실패였으며 최종 검사에서는 해소했다. blocked 질문의 브리핑 입력은 409/not_ready이며 provider 호출 0회도 확인했다.

`/probe/*`는 테스트 파일에서만 등록하는 검증 경로다. T025·T031·T032의 제품 API를 대신 구현하거나 완료로 표시한 것이 아니다.

## 모드·저장 경계·남은 의존성

이번 작업 중 AWS SDK 실제 호출은 0회이며 AWS 자원 생성·IAM 변경·배포를 하지 않았다. Bedrock의 이전 AccessDeniedException 기록은 그대로 유지했다. live 응답/오류/fallback 테스트는 주입한 모의 응답을 사용했으며 실제 AWS 성공 측정이 아니다.

기본 시드는 strict 스키마를 통과한 기존 fixtures/seed record만 한 트랜잭션으로 저장한다. LLM provider는 fixture도 똑같이 strict 검사한 결과만 돌려주며, 불량 fixture는 저장 callback 전에 거부한다. provider는 DB 저장·공유를 하지 않는다.

T018의 스키마 검증만으로 의미·근거·혼입 검증 완료를 주장하지 않는다. 기존 혼입 fixture는 **스키마에는 맞지만 안전한 결과가 아니다**. T041의 needsCheck 보정·제한값 혼입·의료 판단 문구 검사와 T037 기대값 검증이 남아 있고 새 생성 결과를 저장·공유하는 제품 경로는 아직 없다. 후속 파이프라인은 T041 검증을 거쳐 ready/blocked 상태와 실제 모드를 저장한 뒤 jobs 완료를 연결해야 한다.

`--pregenerate`는 T023 질문 통합과 T024 브리핑 생성·저장·포인터 갱신이 필요하다. fixture를 바로 DB에 넣고 생성 성공으로 처리하지 않았다. T010은 이 의존성 해결 후 별도로 검증한다. 실제 STT adapter/업로드/전사 저장은 T039 대상이다. STT_MODE=live에서 주입한 provider가 없으면 미구현 오류를 내며 live 성공으로 바꾸지 않는다.

worker는 알려진 handler가 없거나 결과 세트/전사가 없으면 failed/internal로 남긴다. resultVersion은 같은 환자·진료·섹션·입력 버전·작성자·mode/state의 실제 세트와 일치해야 한다. transcribe handler는 같은 uploadId의 전사 저장 및 recordInputVersion 1회 증가가 필요하며 성공 후 입력 버전이 변해도 같은 upload 요청은 성공 jobId를 재사용한다. jobs 자체는 자동 공유하거나 published 포인터를 바꾸지 않는다.

share_requests는 성공 공유 멱등 정보를 저장할 DB 기반만 제공한다. 공유 트랜잭션·중복 본문 비교·publish 동작은 T043의 미완료 의존성이다. 메모 제한·record-input·canResolve·blocked questions/briefing의 공통 스키마도 정의했지만 실제 기능 handler는 구현하지 않았다. 이전 jobs 스키마 갱신 시 행·상태를 보존하고 기존 전사 행의 uploadId는 null로 둔다. 원본 파일을 추정하지 않으며 uploadId 없는 전사 job은 실행할 수 없다.

## T020 프론트 담당 인수인계

실제로 등록된 API:

| API | 요청·응답 |
|---|---|
| GET /api/health | 기존 `{ status: 'ok' }` 유지 |
| POST /api/auth/login | `{ email, password }` → `{ accessToken, user: { id, name } }`. 추가 요청 키는 400. 잘못된 계정/비밀번호는 같은 401 안내 |
| GET /api/jobs/:jobId | `Authorization: Bearer <accessToken>` → jobSchema의 상태·attempt·mode·resultVersion·resultState·errorCode·시각. 요청자 본인 또는 현행 full 구성원만, 나머지 404. 비활성 구성원은 본인 job도 404 |

`@baton/contracts`에서 healthResponseSchema, loginRequestSchema/loginResponseSchema, errorResponseSchema, jobSchema, visitMetaSchema/visitViewSchema, roleSchema/scopeSchema/modeSchema와 섹션별 블록 스키마·TypeScript 타입을 export한다. api.ts에는 recordInputResponseSchema, noteRequestSchema/noteResponseSchema, shareRequestSchema/shareResponseSchema, questionsResponseSchema, briefingResponseSchema, alertsResponseSchema/resolveResponseSchema 및 home·timeline·members·share-log 등의 공통 계약을 추가했다. 기존 health export와 웹 빌드는 유지된다. 계약 export가 실제 route 등록을 뜻하지 않는다.

RecordView는 view로 구분한다. published에는 blocks/mode/version/view만 있고 draft에는 inputVersion/stale/state/shareable/issues도 필수다. 외부 RecordBlocks 타입은 각 kind가 선택적이며 StoredRecordBlocks는 내부 저장용 세 블록 타입이다. full=null 같은 대체 값을 넣지 않는다. ShareRequest는 검토한 draftVersion/inputVersion과 UUID idempotencyKey를 사용한다. transcribe Job의 resultVersion/resultState는 null이다.

1. API 기본 계정은 `npm run seed`로 준비한다. 현행 가상 이메일 patient/a/b/c@baton.demo와 seed-story의 로컬 데모 비밀번호를 사용한다.
2. JWT에는 role/scope/위임을 넣거나 권한 판단에 사용하지 않는다. UI도 본인 범위 이름을 추정하지 않고 응답 블록 키 유무를 사용한다.
3. 401이면 세션과 환자 캐시를 제거한다. 이후 환자 전환·로그아웃·scope 변경 후 이전 응답 캐시 제거는 T020 담당 범위다.
4. jobs는 생성 API가 연결된 이후 jobId로 2초 폴링하고 succeeded/failed에서 중지한다. 현재 제품 생성 POST 경로는 없다.
5. `/api/me/patients`, home/timeline/visits와 질문·브리핑은 T025/T022/T024, 범위 변경 API는 T031, 원본 파일은 T032, 정리는 T039~T043 대상이며 아직 404다. T020에서 연결된 환자 선택까지 실동작 검증하려면 T025 의존성을 기록해야 한다.
6. 모든 오류는 `{ error: { code, reason?, message, requestId } }`다. 임의 메시지/원문/토큰을 프론트에서 추가 노출하지 않는다.

백엔드 내부에서는 `readVisit(db,userId,patientId,visitId,view)`가 현행 권한을 다시 확인하고 strict VisitView를 반환한다. `loadGenerationInput`은 외부 응답용으로 사용하지 않는다. 후속 routes는 `authenticate`·`requireMembership`·행동 정책을 적용해야 한다.

검증 뒤 개발·E2E 서버는 종료했다. 커밋은 팀 형식 `Feat: …`으로 로컬 devlop에 기록하고 이 체크포인트에서 멈춘다.
