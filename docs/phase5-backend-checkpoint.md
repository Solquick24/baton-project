# Phase 5 독립 백엔드 체크포인트

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
