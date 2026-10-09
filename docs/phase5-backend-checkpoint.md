# Phase 5 백엔드 체크포인트

## 최신 결과 — Phase 3·4 병합 뒤 T037~T044 마무리 (2026-10-09)

**백엔드 T037~T044 완료, 화면 통합 미완료, 외부 AI 실제 호출 미검증.** 아래 과거 독립 구현 기록은 당시의 상태이며 보존한다. 현재 실제 API·미완료 항목은 이 절과 [인수인계](phase5-api-handoff.md)를 따른다. Phase 5 전체 완료를 뜻하지 않는다.

- 시작은 `devlop=97dfc7a`, 미커밋 변경 없음. 원격에는 `devlop`이 있고 `develop`은 없다. 기존 이슈 #17·브랜치 `feat/17-phase5-backend`·draft PR #22(OPEN, 미병합)를 재사용했다. 기존 `7a7b452`를 보존하고 `origin/devlop=97dfc7a`를 `0d9eb52`로 병합했다. API 등록과 decisions 충돌은 기존 alerts/record, Phase 4 members/sources, OpenAI provider/설정을 모두 유지해 해결했다. 제출 전 fetch에서도 devlop은 동일하다.
- Phase 3 PR #16·OpenAI PR #27·Phase 4 PR #30의 병합 코드를 검토했다. T021~T025·T010, T030~T032는 buildApp 등록 경로·코드·직접 inject 회귀로 확인했다. 문서의 완료 체크나 `/probe` 성공만으로 선행을 인정하지 않았다.
- T031의 현재 권한/위임·scope/log 트랜잭션과 T032의 등록 파일/소속/realpath/비동기 후 권한 재검사를 재사용했다. 파일·권한·공유 테이블을 별도로 만들지 않았다. T032의 macOS `/var`→`/private/var` 절대 경로 별칭 결함은 기존 제품 API 테스트의 404로 재현했고, configured/canonical root 검사와 최종 realpath 경계를 유지하는 최소 수정으로 해결했다. 외부 경로·심볼릭 링크 탈출 거부 회귀도 통과했다.

| ID | 검증된 구현 |
|---|---|
| T037 | 기존 record 안전성·fixture 정확한 validation 기대값·스키마/근거/혼입/의료 판단·null 보정 검사를 유지. structure 제품 POST를 통해 기존 worker를 실행하고 모의 OpenAI 혼입 결과의 blocked·share 거부도 확인 |
| T038 | 과거 skip 공유 3건을 활성화. 제품 로그인→질문 통합/브리핑→업로드→전사→메모→정리 job→draft→share→역할별 조회 통과. 비공개·blocked·stale·실패·현재 권한·멱등·원자 롤백·불일치/일반 확인 필요를 구분 |
| T039 | UUID 비공개 파일·단일 multipart/file·허용 MIME·20MB·소속·recordingAllowed. 전사 job은 기존 파일 어댑터로 읽고 strict segment 검증 후 transcript/recordInputVersion/job 완료 원자 저장. trim 1~2000자 메모는 새 행+버전 증가. 기존 Amazon Transcribe ko-KR batch/staging 연결 및 fixture fallback을 SDK 모의로 검증 |
| T040·T041 | 기존 generateRecord/validatedLLM/validateRecord를 재사용. 세 블록·server-owned transcript·근거/혼입 검사·동일 input/version 저장·blocked/failed 처리 유지. 일반 불명확 값은 null+needsCheck이고 검증 실패를 ready로 저장하지 않음 |
| T042 | public record-input/structure와 기본 runner handler 등록. 생성 세 블록·검토본·alerts·job 성공은 기존 단일 트랜잭션. 현재 작성자(companion 이상) 또는 환자/위임 대표만 자기 허용 kind draft 조회 |
| T043 | strict POST share. 최신 draft/input/current input 일치·현재 관계/검토 권한·ready 검사. 공개 포인터/status=done/T031 publish 로그/성공 멱등 결과 immediate 트랜잭션. 같은 키/같은 초안 재공유는 로그 없이 200, 다른 본문은 409 idempotency_conflict. 권한 철회·오래된 입력·초안·blocked는 재전송으로 우회 불가 |
| T044 | 코드 비교·관찰 revision/재비교·record vs prescription·full 상세/상태/이력 유지. 새 record의 일반 불일치는 needsCheck로 공유 가능하고 공유 뒤 full 조회 가능. confirm_hospital은 awaiting_confirmation, reupload는 open, record edit_note는 unsupported_action |

### 실제 실행 결과

Node 22.22.0/npm 10.9.8, 고정 패키지 유지. fixture·메모리 SQLite·임시 전용 파일 DB와 자체 생성한 가상 바이트만 사용했다. 개발 DB·실제 `.env`·업로드는 수정하지 않았다. 테스트 setup은 fetch와 AWS SDK send를 차단하고 transport/SDK 모의가 필요한 테스트만 명시적으로 주입한다.

| 검사 | 결과 |
|---|---|
| 구현 전 새 제품 API red | 8 테스트 전부 예상 실패: 업로드/메모 등 미등록 404. 기존 Phase 3 생성은 이때에도 통과 |
| Transcribe adapter 구현 전 | 모듈 부재로 suite load 실패(실행된 테스트 0). 이를 6건 실패/통과로 계산하지 않음 |
| `npm run test` | **21 파일 / 244 통과 / 0 실패 / 0 skipped**. Phase 3 질문·브리핑·조회·pregenerate, Phase 4 members/sources, Bedrock/fixture/OpenAI, Phase 5 안전성·공유·불일치 포함 |
| `npm run typecheck` | API·web·contracts·도구 통과. 최종 `npm run build`에서도 전체 재검사 통과 |
| `npm run build` | 전체 타입 검사 + Vite 산출물 생성 통과 |
| `npm run test -- --run tests/pregenerate.test.ts` | 최종 CLI 보강 뒤 **3 통과**. `node --import tsx scripts/seed.ts --pregenerate --database <임시 DB>` 실제 실행·재오픈·제품 GET questions/briefing 및 허용 키 검증. fixture 직접 삽입으로 생성 성공을 대신하지 않음 |
| `npm run test:web` | 기존 개발용 응답 preview **14 통과**. sandbox의 포트 listen EPERM 뒤 승인 환경 재실행 |
| `npm run test:e2e` | 기존 실제 로컬 API/Vite health **1 통과**. 진료 화면의 실제 API 연결 수용 검증으로 계산하지 않음 |
| GET·scope | Phase 3 GET 10회, Phase 4 scope 3회×조회 10회, 새 공유본 scope 3회×visit/home/timeline 조회 10회에서 LLM/STT 추가 호출 **0**. 같은 JWT의 다음 조회에 권한 반영 |

처음 전체 회귀에서는 fixture STT 인스턴스 호환 테스트 3건과 macOS 원문 절대 경로 1건이 실패했다. fixture STT 선택 구조를 보존하고 경로 결함을 수정했다. 추가 테스트에서 seed의 과거 전사 3행까지 세던 기대값과 OpenAI 모의 envelope 누락을 바로잡았다. 최종 결과는 위와 같으며 실패를 숨기거나 skip으로 돌리지 않았다.

### 저장·모드·공개와 한계

- record 생성은 자동 publish하지 않는다. 전사/메모 입력 변경과 새 draft/blocked/failed 동안 기존 published 포인터·본문은 보존된다. 가족 일반 GET에는 새 draft 존재·입력 버전·scope/숨긴 개수·full 키가 없다. 허용 kind는 기존 SQL 정책으로만 SELECT한다.
- 전사 중 입력이 바뀌면 stale_input으로 실패하고 transcript/버전 추가 저장이 없다. 현재 녹음 허용·관계·행동 권한은 시작·파일 대기 후·저장 전에 재확인한다. queued/running/succeeded는 동일 job, failed만 attempt+1이다. 파일 업로드 자체는 record 입력 버전을 올리지 않고 전사 완료가 한 번 올린다.
- 성공 키 재전송도 현재 권한과 최신 검토본/입력을 먼저 확인한다. 새로운 입력 또는 draft가 생긴 뒤 과거 공유 요청은 stale_input이다. 과거 공유본은 그대로 남지만 이를 최신 검토본으로 다시 publish하지 않는다. 이 보수적 선택은 decisions에 기록했다.
- 실제 mode는 fixture이며 `mode=live` 사례는 OpenAI transport 또는 Transcribe SDK를 주입한 **모의 응답**이다. 실제 OpenAI·AWS 호출, 새 AWS 자원/IAM/배포는 **0회**다. 기존 Bedrock AccessDenied 기록을 유지한다.
- Transcribe adapter는 기존 staging 버킷만 설정으로 받아 `baton-staging/{patientId}/{jobId}/{uploadId}`에 전용 객체를 쓰고 결과를 같은 prefix의 result.json으로 회수한다. 성공/실패에서 입력·출력 객체와 전사 job 정리를 시도하고 정리 실패도 live 성공으로 처리하지 않는다. timeout 중 원격 작업이 아직 실행 중이거나 정리 권한이 없으면 잔여 객체/작업이 남을 수 있다. 실제 정리·버킷/모델 권한은 미검증이며 변경하지 않았다. 공식 [batch 시작](https://docs.aws.amazon.com/transcribe/latest/APIReference/API_StartTranscriptionJob.html)·[조회](https://docs.aws.amazon.com/transcribe/latest/APIReference/API_GetTranscriptionJob.html)·[출력](https://docs.aws.amazon.com/transcribe/latest/dg/how-input.html)을 확인했다.
- STT_MODE=live에서 bucket 누락/처리 실패는 stt_unavailable, fallback=true면 검증한 fixture와 mode=fixture다. fallback=false면 실패를 유지한다. 실제 음성·인식 정확도는 검사하지 않았다. 출력 구간 id는 ts_01…이며 전체 문단만 있는 응답은 하나의 구간/시간 null로 보존한다.
- 문자열·근거 ID/인용·명확한 값 앵커 검증이 재서술·부정/인과·의미적 정확성이나 의료 안전성을 완전히 보장하지 않는다. 임의 live 결과의 안전성 보장으로 보고하지 않는다.
- 공통 계약·DB schema·권한 표/JWT·패키지/lockfile·seed/fixture JSON·apps/web은 보존했다. 관련 구현은 기존 구조에 `records/service.ts`, `handlers/records.ts`, `workers/transcribe.ts`, `adapters/ai/transcribe.ts`로 추가했으며 같은 역할의 공통 repository/타입을 중복 작성하지 않았다.

### 남은 작업과 제출 단계

백엔드 T037~T044의 구현·fixture API 직접 검증은 완료했다. **T020·T026~T029·T033~T036·T045~T047 화면 연결/캐시 갱신/버튼·전환/실제 진료 흐름 E2E는 별도 담당의 후속 작업**이다. Tier B·C는 진행하지 않았다. 외부 AI 계정/모델·음성 실제 성공 검증도 미실시다.

[실제 API·요청/응답·오류·폴링·버전/멱등·파일 인증·캐시 조건](phase5-api-handoff.md)을 전달한다. 작업 브랜치만 push하고 기존 [PR #22](https://github.com/Solquick24/baton-project/pull/22)를 devlop 대상으로 갱신한다. 이슈 #17과 #13에는 기존 댓글을 보존한 새 결과 댓글을 남긴다. devlop/main 직접 push·자동 머지는 하지 않는다. GitHub 반영 결과/커밋 링크는 해당 PR·댓글에서 확인한다.

## 과거 독립 구현 기록 (보존)

2026-10-09. 작업 이슈 [#17](https://github.com/Solquick24/baton-project/issues/17), 전체 분담 [#13](https://github.com/Solquick24/baton-project/issues/13). 사용자가 이번 요청의 담당을 **백엔드**로 지정하고 Phase 순차 진행의 예외를 허용했다. AGENTS.md의 과거 FE 리드 설명보다 이번 요청을 우선했다. Phase 4를 대신 구현하지 않았다.

## 기준 브랜치와 선행 상태

- 시작은 `feat/14-phase3-backend`, `8048ed7`, 미커밋 변경 없음. 기존 브랜치를 보존하고 최신 `origin/devlop`의 `175fa6f`에서 `feat/17-phase5-backend`를 생성했다.
- Phase 3 PR [#16](https://github.com/Solquick24/baton-project/pull/16)은 `2026-10-09T04:42:08Z`에 병합됐다. 질문·브리핑·pregenerate·공통 안전 검증을 재사용했다.
- `2026-10-09T04:59:18Z` 원격 재확인: `origin/devlop=d3e0417`. PR #12의 결과 공유 문서만 추가 병합됐으며, 독립 구현을 `6c01fce`로 보존한 뒤 `c6afc02`에서 병합했다.
- 이슈 #13 본문·댓글, 전체 이슈·PR·원격 브랜치와 실제 코드를 확인했지만 **T031·T032 구현 이슈/PR/병합 코드가 확인되지 않았다.** 열린 #18/PR #20은 작업 지침 분리 문서이며 Phase 4 구현이 아니다. #13은 역할별 분담만 규정하며 GitHub 계정 배정은 별도다. 동료의 미게시 작업 범위·완료 시점은 추정하지 않는다.
- 제출 전 재확인에서 PR #20도 병합돼 `origin/devlop=b3fa963`이 됐다. 코드·문서 커밋을 보존한 뒤 `d8482be`로 반영하고 루트 및 새 `apps/api/AGENTS.md`·`apps/web/AGENTS.md`를 읽었다. 추가 변경은 문서뿐이며 T031/T032는 여전히 없었다. 마지막 병합 전 실행한 검사 이후 기능 코드는 바뀌지 않았다.
- 따라서 T039 → T042 → T043 연결은 진행하지 않는다. T031·T032를 중복 구현하거나 임시 파일/공유 성공 경로를 만들지 않았다. T038 전체도 미완료다.

## 구현·검증한 범위

| ID | 결과 |
|---|---|
| T037 | 안전성 테스트 먼저 작성. 정리 fixture 정확한 값, 낮은 문자열 혼입·의료 판단·unknown field·잘못된 근거·null 보정·서버 전사 소유권 등을 검증 |
| T040 | 기존 jobs에 주입 가능한 `generateRecord` worker. 실제 fixture provider → 저장 전 검증 → 서버 전사 복사 → 세 kind·검토본 포인터·job 완료 원자 저장. 공개 포인터·done·publish 로그는 변경하지 않음 |
| T041 | 기존 질문·브리핑 검증을 유지하고 record의 항목 관계·근거 identity/quote·제한값·의료 판단·명확한 값의 근거 앵커·null/needsCheck 검사 확장. 결과는 ready/blocked 또는 failed이며 스키마 통과만으로 저장하지 않음 |
| T044 | 동일 drugKey의 dose 문자열·timing 정렬 집합을 코드로 비교. seed 비교 함수를 재사용하고 ready 정리와 같은 진료 처방 비교·full 전용 조회·수정 이력·재비교 API 구현 |
| T038 일부 | 공유 전 비공개, 허용 kind SQL, blocked 검토, 중복 job·실패 재시도·stale·재정리 중 기존 공유본 보존, alerts 권한 검증 통과. POST share 수용 테스트 3개는 선행 부재로 미완료 |

T044에 필요한 T038의 불일치 테스트는 먼저 실패를 확인하고 통과시켰다. 공유 관련 선행이 남았으므로 T038 전체는 체크하지 않았다. **Phase 5 전체 완료나 정리→공유 사용자 흐름 완료가 아니다.**

## 안전성과 저장 방식

- record 입력은 기존 내부 repository로 같은 환자·같은 진료의 메모/최신 전사/처방/통합 질문만 읽는다. 다른 과·비공개 메모는 AI 입력에 포함하지 않는다. 질문·브리핑의 과거 공유 자료/시점 제한도 유지한다.
- fixture와 주입한 live 모드 응답은 동일한 저장 전 검증을 통과한다. strict schema, 유일한 항목 ID, 실제 통합 질문/복약 항목 관계, 근거 소속·원문 인용을 확인한다. 질문만으로 답변의 근거가 있다고 판단하지 않는다.
- 스케줄 날짜/시간, 진단명, 검사 값/단위, 복약량/시점은 실제 근거의 표현과 대조한다. 근거가 없거나 확인할 수 없는 nullable 값은 null+needsCheck로 보정한다. start.from/stop.to의 정상 null 예외를 지킨다. 알 수 없는 근거·서버 전사 위조·잘못된 항목 관계는 validation_failed다.
- 낮은 블록의 모든 문자열을 NFKC→소문자→공백 제거 후 기존 full 제한값과 비교한다. 의료 판단 목록도 기존 한 곳을 재사용한다. 민감 혼입은 blocked이고 낮은 블록을 응답하지 않는다. 일반적인 미확인 항목은 ready+needsCheck로 구분한다. issue에는 걸린 문자열 자체가 없다.
- 생성 대기 중 입력/근거/제한값이 바뀌면 stale_input, 현재 권한이 철회되면 실패한다. 저장 도중 한 블록 INSERT가 실패하면 검토본·블록·alerts 모두 롤백한다. failed는 기존 검토본/공유본을 덮지 않는다.
- 원문 전사·인용·근거·진단·수치·이유·불일치 상세는 full 전용이다. 외부 진료 조회의 허용 kind SQL과 draft 검토 권한을 재사용했다. 미공유 record alert는 현재 검토 권한이 있는 full 호출자만 보며, 일반 가족의 full 목록/홈 건수에도 미리 노출하지 않는다. 과거 공유 기록은 기존 공개 포인터 또는 publish 로그로 확인한다.
- record alert는 ready 완료 트랜잭션 안에서만 생성하고 복약 항목에 needsCheck와 full conflict 상세를 추가한다. 정상 fixture의 새 alert 수는 정확히 0이다. 비교는 어느 근거가 맞는지 판단하지 않는다.
- edit_note는 관찰 원본을 덮지 않고 새 revision/supersedesId와 alert 처리 이력을 저장한다. 재비교 결과 차이가 없으면 resolved, 남으면 open. confirm_hospital은 awaiting_confirmation, reupload는 안내만 남기고 open이다. 저장된 과거 블록은 다시 쓰지 않는다.

이 검증은 명세 4장의 **문자열 휴리스틱과 근거/값 앵커 검사**다. 근거 ID·인용이 실제라는 사실만으로 자유 문장의 의미적 부합·의료적 정확성까지 증명하지 않는다. 재서술, 부정/인과 해석, 약 이름의 동의어, 시점 추론 등을 완전히 검증하지 못한다. 가상 fixture와 주입한 실패 응답에서 확인한 결과이며 임의 live 출력의 안전성 보장이 아니다. 검증하지 못한 값을 확인된 사실로 만들어 넣지 않으며 이번 PR에는 공개 share 경로 자체가 없다.

## 실제 검사 결과

Node 22.22.0/npm 10.9.8, 기존 고정 버전 유지. 테스트는 fixture·메모리 SQLite이며 AWS SDK send를 차단한다. `mode='live'` 테스트도 주입한 모의 응답이며 실제 AWS 성공이 아니다.

| 검사 | 실제 결과 |
|---|---|
| 구현 전 T037/T038 최초 red | 119 통과 / 21 실패. record worker 부재·alerts/share 404 확인 |
| 독립 구현 후 공유 테스트 | POST share 3건 404 실패를 다시 확인. 선행 부재를 기록하고 명시적 skip, T038 완료 표시 안 함 |
| `npm run typecheck` | API·web·contracts·도구 타입 검사 통과 |
| `npm run test` | **16 파일, 150 통과 / 0 실패 / 3 skipped**. 기존 119개 포함, 질문·브리핑 안전성 및 실제 provider/jobs 기반 pregenerate 성공/실패 회귀 유지 |
| `npm run build` | 전체 타입 검사 및 Vite 실제 산출물 생성 통과 |
| `npm run test:web` | 기존 개발용 응답 화면 회귀 **14 통과 / 0 실패** |
| `npm run test:e2e` | 실제 로컬 API/Vite 프록시 health **1 통과 / 0 실패** |
| GET 10회 | record draft·alerts에서 추가 provider 호출 **0**. 기존 질문/브리핑/조회 회귀도 통과 |
| fixtures 정확한 값 | `validation.json` normal/leak 상태·issues, `structure/*.json`, 서버 전사 `transcribe/v_im_03.json`, 시드 `alerts.json`, 정상 정리 후 새 alerts=0 일치 |

프론트 검사는 첫 실행의 sandbox listen EPERM 후 승인된 환경에서 재실행했다. 화면 회귀/health 결과를 T045–T047 실제 정리·공유 통합 검증으로 계산하지 않는다. scope PUT은 T031 미구현이라 이번 범위에서 scope 변경 3회 API 검증을 실행할 수 없다.

테스트의 transcript 행은 실제 FixtureTranscription 출력으로 준비한 worker 입력 전제이며 T039 업로드/전사 API 성공을 뜻하지 않는다. 재정리 보존 테스트에서 설정한 기존 공유 포인터도 기존 공유 상태의 전제일 뿐 POST share 성공을 대체하지 않는다. 개발 DB를 seed하거나 덮어쓰지 않았다.

## 프론트·후속 백엔드 인수인계

공유 `@baton/contracts`의 기존 AlertsRes/ResolveReq/ResolveRes 및 Zod 스키마를 그대로 사용한다. `/api` 상대 경로·Bearer JWT·포장 없는 JSON 응답이다.

| 실제 사용 가능한 경로 | 요청·응답·권한 |
|---|---|
| `GET /api/patients/{pid}/alerts` | 200 `{alerts: Alert[], canResolve: boolean}`. full만. 현재 full인 환자/대표는 canResolve=true, 일반 보호자 full은 false. 미공유 record 상세는 검토 권한까지 검사 |
| `POST /api/patients/{pid}/alerts/{aid}/resolve` | 200 `{alert: Alert}`. full 환자/대표만, 위임 여부와 별개. 아래 strict body 중 하나 |
| 기존 `GET …/home?dept=내과` | full openAlertCount에 목록과 같은 미공유 제외 규칙 적용. companion/schedule에는 키 자체가 없음 |
| 기존 진료·질문·브리핑·jobs | 계약 변경 없음. 기존 공유본은 계속 조회 가능. record 검토 조회 기반은 있지만 이번 PR은 public structure 요청을 제공하지 않음 |

```json
{"action":"edit_note","fact":{"drugKey":"batodipine","drugName":"바토디핀정 5mg","dose":"0.5정","timing":["morning"]},"text":"아침에 반 알로 수정한 가상 관찰"}
```

다른 처리 본문은 `{"action":"confirm_hospital","note":"병원에 확인할 예정"}` 또는 `{"action":"reupload"}`다. 성공 후 alerts와 home을 다시 읽는다. resolve는 동기식이므로 jobs 폴링하지 않는다. 처리 후 상태·history를 응답 그대로 표시하고 확인 예정 상태를 해결됨으로 표시하지 않는다.

오류: 401 인증, 403 비구성원/일반 보호자 full의 수정, 404 낮은 범위/없는 aid/다른 환자 소속/허용되지 않은 미공유 alert, 400 잘못된 strict body·fact, 400 unsupported_action(record alert의 edit_note), 409 stale_input(관찰 원본이 이미 다른 revision으로 대체됨). 공통 ErrorResponse만 반환한다.

**미구현 경로:** GET record-input, POST audio/transcribe/notes/structure/share, GET sources, members/scope/share-log는 이 작업 기준으로 등록되지 않아 404다. 경로 명세가 있다는 이유로 호출 가능하다고 표시하지 않는다. blocked 우회 공유·오래된 검토본 공유·동일 초안 재공유·idempotency_conflict의 실제 API 검증은 T043 후 필요하다.

후속 담당은 실제 T032 파일 처리 기반 병합 → T039 → T042 순서로 연결한다. T040 worker는 `generateRecord(db, llm, job): Promise<JobCompletion>`이며 기존 `JobRunner`의 structure handler로 연결할 수 있다. production handler 등록은 아직 하지 않았다. 이후 T031 공유 로그 기반과 T042가 준비되면 T043을 구현하고 공유 수용 테스트의 skip을 해제한다. 생성 요청이 실제 연결된 후에만 202 jobId → 2초 GET jobs 폴링 → draft 재조회 흐름을 연결한다. GET·범위 변경에서는 AI를 호출하지 않는다.

## 남은 항목과 충돌 경계

- 완료 표시: T037·T040·T041·T044. 미완료: **T038 일부, T039, T042, T043**. Phase 5 전체 체크포인트와 T045–T047 미완료.
- T031·T032의 문서 밖 담당 범위는 미확정이다. 다음 작업 전 이슈/PR/실제 코드 상태를 다시 확인한다. 동료 구현을 기다리는 무한 대기는 하지 않는다.
- apps/web·공통 계약·DB schema·권한 표/JWT·root package.json/lockfile·fixture/seed JSON은 변경하지 않았다. 앱 경로 등록은 alerts 2줄만 추가했다. seed 스크립트의 기존 비교 코드를 공통 순수 함수로 대체한 작은 변경은 #15 후속 작업과 병합할 때 보존해야 한다.
- T020·T026–T029·T045–T047 및 Phase 4 구현·Tier C는 진행하지 않았다. 실제 AWS 호출·자원 생성·IAM 변경·배포 없음. 기존 Bedrock AccessDenied 기록 유지.
- 이슈 #17은 부분 완료라 유지하고 PR은 `Refs #17`, `Refs #13`의 **draft / base=devlop**으로 제출한다. 작업 브랜치 push·PR 생성까지이며 devlop/main 직접 push·자동 병합은 하지 않는다.
