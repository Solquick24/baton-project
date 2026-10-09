# Phase 3 백엔드 체크포인트 — T021~T025, T010 잔여

2026-10-09. 이슈 [#14](https://github.com/Solquick24/baton-project/issues/14), 전체 분담 [#13](https://github.com/Solquick24/baton-project/issues/13). 시작 브랜치 `codex/9-backend-foundation`은 미커밋 변경이 없었다. 기존 작업을 보존하고 최신 `origin/devlop`의 `2a54ab4`에서 `feat/14-phase3-backend`를 만들었다. 마지막 fetch에서도 같은 기준을 확인했다. Phase 1·백엔드 기반·기존 프론트 구현을 재사용했다.

완료 범위는 T021–T025와 T010의 `--pregenerate`다. 사용자가 **“Phase 3에 필요한 최소 안전 검증 선행 허용”**을 승인하여 T041 경로의 공통 검증 중 질문·브리핑에 필요한 부분만 선행했다. T041 전체·record 검증은 미완료다. T020·T026–T029·apps/web 수정·Phase 4 이후·Tier C는 진행하지 않았다. **Phase 3 전체 완료가 아니다.**

## 구현과 검증 근거

| 작업 | 검증한 결과 |
|---|---|
| T021 | 질문·브리핑 테스트를 구현 전에 작성. 최초 실행은 새 API 부재로 14 실패/82 통과(질문·브리핑 9개 + 조회 5개). 이후 안전 회귀를 추가하고 최종 119개 통과 |
| T022 | 질문별 행·작성자 저장, trim 1~200자·strict body, 원자적인 inputVersion 증가, 현재 권한 확인. 제한값/의료 판단 질문은 full 전용 저장. 낮은 조회는 visibility 조건을 SQL에 적용 |
| T023 | 기존 jobs·실제 fixture provider → strict/근거/혼입 검증 → 세 kind 저장·questionsVersion 갱신. 시드 원 질문 3개에서 통합 2개+근거 있는 AI 추가 1개, 원 질문 관계 검증 |
| T024 | 같은 환자·과의 과거 공유본·시점에 맞는 관찰·열린 alert·통합 질문 사용. briefing version·stale·권한별 조회, 변경 2개·질문 3개, full 이유/근거·금식 null/needsCheck=true. 정확한 expected와 validation issues 일치 |
| T025 | 환자 목록·홈·타임라인·개별 진료 GET. home 진료과 기본값/카운트, timeline 필수 진료과·공유본만, schedule은 meta 중심·질문/확인 개수 비노출. 기존 readVisit/assembler 재사용 |
| T010 | 기본 시드 뒤 실제 FixtureLLM/JobsService/JobRunner/T023/T024 실행. 질문·브리핑 모두 fixture/ready인 경우에만 성공. 별도 임시 파일 DB에서 저장 후 API 조회까지 검증, 개발 DB 해시 불변 |

## 안전·권한·실패 처리

- 외부 GET은 중앙 `ALLOWED_KINDS`의 허용 kind만 SQL SELECT한다. companion은 full·state·sourceRefs·basisRefs·이유·alert 상세·범위 이름·숨긴 개수를 받지 않는다. schedule 질문/브리핑 GET은 404, 생성은 403이다. 비구성원은 403, 인증 누락은 401이다. JWT는 기존 sub 기반이며 범위를 추가하지 않았다.
- 내부 생성 repository는 외부 조회와 분리한다. 같은 환자·진료과의 **이전 날짜 공유본**만 사용하고 미래 관찰·다른 과·비공개 메모는 제외한다. alert의 인용·fact·참조도 실제 동일 환자/과/시점의 관찰·공유 진료 처방 또는 공유본 항목과 대조한다. 유효하지 않은 alert는 입력에서 제외하며, fixture가 제외된 근거를 참조하면 validation_failed가 된다.
- fixture와 live는 같은 strict 스키마/최대 1회 형식 재시도를 사용한다. 저장 직전에 섹션·스키마·원 질문 관계·공개 질문 누락·근거 identity와 quote 존재·낮은 블록의 모든 문자열·같은 환자 full 제한값·의료 판단 문구를 추가 검사한다. 내부 provider를 주입해도 저장 전 검증을 건너뛰지 못한다.
- NFKC→소문자→공백만 제거하며 `7.2%`의 문장부호를 유지한다. 항목 ID도 검사한다. 비공개 질문을 공개 항목 근거로 사용하면 blocked다. full 항목의 불명확 값/근거 누락은 null+needsCheck 및 안전한 issue로 보정한다. non-nullable 공개 문장의 근거가 없으면 더 좁게 validation_failed로 처리한다.
- ready 또는 blocked 완료 결과로 최신 포인터를 갱신한다. blocked는 companion merged 키 부재/briefing 404, full은 full 블록만 반환한다. 이전 ready를 최신 결과로 대체 표시하지 않는다. failed/generating은 기존 완료 포인터를 유지한다.
- 생성 시작 시 입력과 저장 직전 입력·제한값을 비교하고 현재 권한/버전을 재확인한다. 세 블록·최신 포인터·job 성공을 한 트랜잭션에 저장한다. 입력 변경·권한 철회·중간 실패는 일부 결과 저장 없이 실패한다. GET은 AI를 호출하지 않는다.
- 질문·브리핑 ready는 허용 범위에 즉시 공개한다. 진료 정리(record)의 POST share를 호출하거나 recordPublishedVersion/status/share 로그를 변경하지 않는다.

이 검증은 명세의 문자열 휴리스틱과 근거 identity/quote 검증이다. **재서술된 제한값, 문장의 의미적 근거 부합·의료적 정확성을 완전하게 증명하지 못한다.** 스키마 통과만으로 안전하다고 판단하지 않는다. 이번 가상 fixture와 음성 없는 시연 범위를 검증했으며 임의의 live 출력 전반을 검증 완료했다고 주장하지 않는다. record 전체 검증·생성·공유는 T037–T043 이후 작업이다.

## 실제 실행 결과

Node 22.22.0/npm 10.9.8 및 기존 lockfile을 유지했다. fixtures·seed/expected·공유 스키마·패키지 버전·apps/web은 그대로 유지했고 같은 역할의 계약·repository를 중복 작성하지 않았다.

| 검사 | 결과 |
|---|---|
| `npm run typecheck` (`npm run build`에 포함) | API·contracts·web 및 도구 tsc 통과 |
| `npm test` | 12 파일, **119 통과 / 0 실패**, fixture·메모리 SQLite, AWS SDK send 차단 |
| `npm run build` | 타입 검사·Vite 실제 산출물 생성 통과 |
| `npm run test:web` | 기존 프론트 **14 통과 / 0 실패**, 개발용 응답 모드 |
| `npm run test:e2e` | 기존 실제 로컬 API/Vite 프록시 연결 **1 통과 / 0 실패**, health 검사 |
| 생성 후 GET 10회씩 | briefing·questions·visit·me/patients·home·timeline에서 provider 호출 증가 **0** |
| 안전·실패 회귀 | 다른 과/없는 인용·형식 오류·근거 누락·질문 누락·provider 실패, blocked/failed·retry·stale·권한 변경·최신 blocked 처리 통과 |
| 임시 DB CLI·조회 | 아래 실제 사전 생성/저장/로그인·조회 검사 통과 |

추가 안전 테스트가 먼저 ID 검사와 alert 참조 검증의 실패를 확인했고 보완 후 통과했다. 새 API 등록으로 기존 404 검사 경로가 더 이상 미구현 경로가 아니어서 setup의 검사 대상을 내부 미등록 경로로 바꿨다. 프론트 검사는 초기 sandbox의 로컬 listen EPERM 이후 승인된 환경에서 다시 실행하여 통과했다. seed CLI도 tsx IPC EPERM 이후 별도 임시 DB 대상으로 재실행하여 성공했다.

### 별도 임시 DB의 실제 사전 생성

개발 DB에 seed를 실행하지 않았다. `/private/tmp/baton-phase3-1dj2k_08/baton.sqlite`에 다음 명령을 실행했다(테스트용 JWT 설정, LLM/STT fixture).

```bash
npm run seed -- --pregenerate --database /private/tmp/baton-phase3-1dj2k_08/baton.sqlite
```

실제 출력: users=5, visits=4, records=3, alerts=1, questionsVersion=1, briefingVersion=1, mode=fixture. DB의 두 job은 merge_questions/briefing succeeded+ready+fixture다. 파일을 다시 열고 기존 Fastify 로그인 API로 A/B/C 토큰을 받은 뒤 API 직접 호출로 B 변경 2개·질문 3개와 exact companion, A exact full/null, C 질문·브리핑 404 및 일정 홈을 확인했다. GET 10회 추가 provider 호출은 0, v_im_03 recordPublishedVersion은 null이다. `apps/api/data/*.sqlite*`의 전후 SHA-256이 모두 같았다. 보고서는 `docs/references/phase3-pregenerate.json`이다. 이 경로는 검증 당시 임시 산출물이며 체크아웃마다 새 임시 경로를 사용한다.

## 프론트 담당 인수인계

공유 계약은 기존 `@baton/contracts`의 Request/Res 타입·Zod 스키마를 그대로 사용한다. `/api` 상대 경로와 Bearer 토큰, 포장 없는 JSON 응답을 유지한다. `P=/patients/{pid}`, `V=P/visits/{vid}`이며 아래 경로 앞에 `/api`를 붙인다.

| 실제 사용 가능한 API | 요청·응답 |
|---|---|
| `GET /me/patients` | `{self:{patientId:string\|null},linked:[{patientId,name}]}`. 현재 활성 관계만, scope 없음 |
| `GET P/home?dept=내과` | 기존 HomeRes. dept 생략 시 정렬된 첫 진료과. schedule nextVisit은 `{meta}`만, companion 이상 questionCount/briefingReady, full만 openAlertCount |
| `GET P/timeline?dept=내과` | `{items:VisitView[]}`. dept 필수, 공유 진료만 날짜 내림차순 |
| `GET V?view=published` | `{meta,record?}`. 미공유 진료는 meta만. draft는 기존 repository의 검토 권한 적용 |
| `GET V/questions` | `{questionsInputVersion,originals:[{id,text,author,createdAt}],merged?}`. merged는 version/stale/mode/blocks, full에만 state |
| `POST V/questions` | `{text}` trim 1~200자 → **201** `{id,questionsInputVersion}`. full-only 질문도 201이며 낮은 목록에 재노출되지 않음 |
| `POST V/questions/merge` | `{inputVersion: GET questions의 questionsInputVersion}` → **202** `{jobId}` |
| `POST V/briefing` | `{questionsVersion: GET questions의 merged.version}` → **202** `{jobId}`. 현재 ready 질문 세트 필요 |
| `GET V/briefing` | `{version,mode,stale,blocks,questions}`. 질문은 저장된 briefing 입력 질문 version에 해당하는 문장. full에만 state, blocked full은 questions=[] |
| `GET /jobs/{jobId}` | 기존 Job. queued/running/succeeded/failed, 실제 mode/resultVersion/resultState/errorCode. 블록/원문 없음 |

질문·브리핑 생성은 2초 간격 jobs 폴링 후 원래 GET을 다시 읽는다. `succeeded + blocked`를 공개 성공으로 표시하지 않는다. 같은 입력의 queued/running/succeeded는 같은 job을 재사용하며 실패만 새 attempt로 재시도한다. 다른 companion이 만든 jobId는 전달하지 않는다(404). fixture는 시드 입력에 대응한다. 새 공개 질문이 추가되면 기존 예시가 그 질문을 누락하므로 현재 fixture에서는 validation_failed이며 성공처럼 처리하지 않는다.

주요 오류: 400 잘못된 text/body/dept/view, 401 인증, 403 비구성원/생성 권한, 404 없는 진료/허용 밖/준비 안 된 briefing, 409 stale_input 요청 버전 불일치, 409 not_ready ready 질문 선행 없음. 비동기 오류는 Job.errorCode(`ai_unavailable`, `validation_failed`, `stale_input`, `internal`)로 확인한다. 원문·범위·혼입 문자열을 오류에 넣지 않는다.

실제 API 모드는 기존 `npm run dev` 또는 API+`npm run dev:web`으로 연결할 수 있다. 프론트 코드나 개발용 어댑터는 변경하지 않았다. T020·T026–T029에서 로그인→읽기→생성/실패 폴링→재조회와 계정/진료과/캐시 전환을 실제 서버로 통합 검증해야 한다. 이번 기존 preview 14개와 health E2E 1개를 그 수용 검증의 대체로 계산하지 않는다. full 근거 인용 JSON은 사용 가능하지만 파일 원문 다운로드는 T032 미구현 의존성이다. members/scope 변경·alerts 수정·record-input/음성/notes/structure/share도 후속 작업이며 이번 PR의 구현 API가 아니다.

## 모드와 남은 범위

- 실제 사용 모드: **fixture**. 이번 작업의 AWS 호출·자원 생성·IAM 변경·배포는 0회다. 기존 `phase1-ai-access.json`의 Bedrock AccessDenied 기록을 유지했고 live 성공으로 계산하지 않았다.
- T010/T021–T025의 검증된 구현만 tasks.md 완료 표시. T020/T026–T029, T041 전체와 나머지 Phase 4 이후/Tier C는 미완료 유지한다.
- devlop 직접 push·자동 병합 없이 작업 브랜치 push와 devlop 대상 PR로 리뷰한다. PR 병합·프론트 수용 검증 전 Phase 3 전체 완료로 보고하지 않는다.
