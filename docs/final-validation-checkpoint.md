# Tier A 마무리·Tier B 축소 평가·최종 검증 체크포인트

2026-10-09, 이슈 [#39](https://github.com/Solquick24/baton-project/issues/39). T048~T051, T065 **축소판만**, T066~T068. Tier C(T052~T064) 제외. 이 문서의 최신 결과가 이전 체크포인트의 당시 미완료·환경 상태보다 우선한다.

## 작업 보존·환경

시작 `feat/32-api-integration` 79f0f50, 미커밋 변경 없음. 최신 `origin/devlop` 8318aab(PR #36 병합본)에서 `feat/39-final-validation`을 분리했다. 원격 개발 브랜치는 devlop이며 develop을 만들지 않았다. 시작 당시 다른 CLI의 PR #38은 열린 상태로 확인했다. 이후 추가 진료 흐름 지시 시점에는 병합됐으므로 아래 기록처럼 devlop4079dec를 반영하여 재사용했다. 범위 E2E의 고정 origin 제거는 별도 포트 검사에 필요한 동일한 한 줄 수정이다.

requirements 체크리스트 16/16 통과, 읽기 전용 유지. extensions.yml은 없다. 명세·계약·시드·하위 지침·dataset-integration과 최근 통합/Phase 5/OpenAI 결정 기록을 확인했다. 기존 병원 DTO/SQLite 시드를 재사용하며 공통 계약·DB 스키마·fixture·패키지 버전을 바꾸지 않는다.

사용자 서버 3001/5173을 종료하지 않는다. 자동 API는 메모리 또는 새 임시 DB, 실제 API E2E는 3314/5314·메모리 DB·매 실행별 임시 업로드 경로, preview는 5313이다. 서버 .env를 로드하지 않는 E2E 진입점에서 fixture 모드를 강제하고 외부 fetch를 차단한다. 평가/리허설도 fixture이며 실제 OpenAI/AWS 자동 호출은 없다.

## 외부 AI 확인의 출처

사용자가 직접 check-openai.ts에서 다음 **단일 호출** 성공 출력을 확인했다고 보고했다: `provider=openai`, `model=gpt-4.1-mini-2025-04-14`, `mode=live`, `state=ready`, `persisted=false`. 이는 사용자의 실제 호출·응답 검증 보고이며 이번 에이전트가 재실행하거나 전체 질문/브리핑/record의 live 저장·공유까지 검증한 결과가 아니다. 이전 #32의 키/모델 미설정 기록은 당시 상태다. 키 값은 읽거나 출력하지 않는다.

다른 CLI PR #38의 live 주장도 이 브랜치의 에이전트 측정 결과에 합산하지 않는다. 텍스트 fixture/모의 검증과 사용자 단일 OpenAI 호출 보고, STT fixture 검증과 실제 AWS 전사 미검증을 구분한다. 가상 바이트→준비 전사 시연은 실제 음성 인식 정확도 측정이 아니다.

## 검증 과정과 해결한 실패

- 변경 전 API: `npm run test` 22파일, 245 통과/0실패/0skip.
- 병원 API red: 미등록 404로 2실패. 등록 뒤 같은 검사 2통과.
- 초기 타입 검사 통과.
- 접근성 첫 실행: sandbox listen EPERM으로 테스트 시작 전 실패. 별도 포트 서버 실행 승인 뒤 검사.
- 첫 접근성 2실패/2미실행은 고정 하단 메뉴를 고려하지 않은 scrollIntoViewIfNeeded 위치 검사였다. 실제로 컨트롤을 중앙까지 스크롤해 조작 가능 여부를 검사하고 scroll 여백을 보강했다.
- 다음 접근성 3통과/1실패는 불일치 수정 메모 textarea의 104px 영역에 137px 내용이 생긴 경우다. 내용에 맞춰 입력창 높이가 자라도록 보완했다. 후속 최종 결과는 아래 기록한다.

사용자 지시에 따라 각 단계가 통과하면 다음 단계로 계속 진행하고, 마지막에 커밋/이슈 기록 후 중지한다. 이번 요청의 push/PR 생성/원격 병합은 수행하지 않는다. 작업 브랜치에 최신 devlop을 반영한 로컬 fast-forward와 구분한다.

## 추가 지시: 진료 동행 노트 안정화 (최종 완료 보류 후 진행)

사용자가 메모 저장 깜빡임·무조작 갱신·정리 실패/화면 연결을 우선 수정하도록 요청했다. 당시 T067·T068 체크를 취소하고 변경 전 diff/새 파일을 `/private/tmp/baton-39-before-record-fix`와 Git stash로 보존했다. 원격 재확인에서 PR #38이 devlop 4079dec에 병합됐음을 확인하여 안전하게 fast-forward 후 기존 변경을 복원했다. decisions.md 충돌은 양쪽 기록을 모두 보존했다. PR #38의 질문·브리핑 근거 안내/테스트를 재사용하며 다른 CLI 변경을 덮어쓰지 않았다. 이 브랜치에서 push/PR/병합을 게시한 것은 아니다.

수정 전 제품 API 브라우저 재현 3건이 실패했다. 6.6초 코드 변경 없이 대기하는 구간은 자동 GET 반복·job 폴링·문서 navigation이 없었고, 탭 복귀 후 미저장 메모가 빈 문자열로 바뀌는 증상을 확인했다. Vite HMR은 코드 변경 때 별개이고, focus/visibilitychange/pageshow는 권한 재조회, jobs는 명시적 작업 중에만 2초 폴링이다. 조회 오류에 자동 반복 재시도는 없다.

원인은 `/me/patients` 재조회 때 Workspace가 Routes 전체를 제거하는 구조와 record-input 재조회 때 입력 폼을 State로 교체하는 구조였다. 폼 상태와 작업 컨트롤러가 초기화되고 질문 체크 DOM도 제거됐다. 메모 성공 뒤 내용을 지우고 화면 내 횟수를 전체 메모 수처럼 표시하던 문구도 수정했다.

이제 Routes는 세션/경로가 같은 동안 유지하고 조회 응답 자체는 기존처럼 revision마다 제거한다. 입력 폼은 처음 로드 후 메타데이터 재조회로 제거하지 않고, 질문 체크를 로컬 상태로 유지한다. 메모는 저장 중/성공/실패 표시, 내용 유지, 미저장 변경 시 정리 전 저장 안내를 제공한다. 서버 메모 API는 추가 저장이며 DB 전체 메모 수를 화면에서 추정하지 않는다. 계정/환자/진료 변경은 기존 key로 초기화하며 권한 철회 403/404에서는 폼을 숨기고 로컬 입력/파일/체크도 제거한다.

정리 클릭 시 record-input의 현재 권한/버전을 다시 읽고 POST structure→job 폴링→성공 job.resultVersion과 현재 draft.version/inputVersion/stale 확인→검토로 이동한다. 동일 입력 성공 작업 재사용도 같은 검사를 거친다. 공유는 명시적 확인·기존 버전/멱등/권한 검사 뒤에만 수행하고 성공 후 `공유한 기록 확인하기`로 타임라인에 연결한다. blocked/stale·권한 철회 거부는 유지한다.

개발용 DB는 readonly로 jobs의 kind/status/errorCode/mode/attempt/inputVersion만 집계했다. structure validation_failed 3건, mode=live succeeded 1건이 있었다. 과거 실패의 raw 응답/단계는 저장되지 않아 형식·근거·연결 중 어느 단계였는지 소급 확정할 수 없다. mode=live DB 메타데이터도 이번 실제 OpenAI 재실행/품질 검증으로 세지 않는다. DB 초기화·업로드 삭제·.env 키 읽기·사용자 서버 종료는 하지 않았다.

OpenAI record 입력에는 기존 검증기의 sourceCatalog를 재사용하여 같은 환자·진료의 실제 source 객체/quoteOptions를 제공한다. 프롬프트에 출력 id 유일성, sourceRef.itemId와 원본 ID 구분, medChangeId/질문 questionId 연결, alertId=null, 통합 질문이 없으면 answers=[]를 명시했다. 저장 전 검증 조건은 완화하지 않았다. 새 API 모의 진단 테스트 5건 red를 확인한 뒤 구현했고 관련 OpenAI/record 검사 43건 green을 확인했다.

서버의 `ai_job_failed` 로그는 event/kind/code/stage의 고정 값만 남긴다. stage는 response_format/output_schema, response_incomplete/response_refusal/provider_transport, source_identity/source_quote/item_reference/input_context/medication_identity 등을 구분한다. 원문·키·응답·근거 ID·환자/진료 ID·오류 객체를 기록하지 않고 일반 보호자 API/JWT에도 진단 상세를 추가하지 않는다. 과거 job 스키마는 변경하지 않는다. 사용자 화면은 입력 변경·AI 연결 실패·AI 응답 검증 실패를 구분한다. 프롬프트 변경으로 실제 OpenAI의 실패 빈도가 줄었는지는 재호출하지 않아 미검증이다.

후속 브라우저 3건은 입력 유지·저장 직후 정리·실패 후 같은 성공 job 재사용·검토/명시적 공유/타임라인까지 통과했다. 추가 조회 실패 자동 반복 부재·실제 scope 철회 후 입력 제거 검사를 더했다. 최종 전체 검사·리허설은 아래 최종 결과로 갱신한다.

공식 근거: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini). Responses strict 형식/거부/불완전 처리를 보존하며 스키마 형식과 의미적 안전성 검증을 구분한다.

## 최종 체크포인트 — 진료 흐름 안정화 후 재검증

완료: **T048·T049·T050·T051·T066·T067·T068**, **T065 승인 축소판만 완료**. T065 원래 전체 평가의 체크박스는 미완료로 유지한다. T067/T068은 추가 진료 흐름 지시 때 보류했다가, 아래 실제 API/브라우저 재검증 후 다시 완료 표시했다. 전체 명세/모든 SC의 달성을 뜻하지 않는다.

| 최종 명령 | 통과 | 실패 | 건너뜀 | 결과·모드 |
|---|---:|---:|---:|---|
| `npm run typecheck` | — | 0 | 0 | API/web/contracts/tools 정상 종료 |
| `npm run test` | 260 | 0 | 0 | API25파일; fixture 및 주입한 OpenAI/AWS mock, 실제 외부 호출 차단 |
| `npm run build` | — | 0 | 0 | 전체 타입 검사 포함, Vite133모듈 빌드 정상 종료 |
| `npm run test:e2e` | 37 | 0 | 0 | 실제 Fastify/SQLite/Vite/Chromium; 2.9분, LLM/STT fixture |
| `npm run test:web` | 14 | 0 | 0 | preview 회귀18.7초; 실제 API E2E와 별도 |
| `node --import tsx scripts/evaluate.ts --report docs/references/final-fixture-evaluation.json` | gold4/4·alert1/1 | 별도 재서술1 | 20장 평가 미실시 | fixture 검증기 평가; 별도 도전 실패를 성공 집계에 섞지 않음 |

모든 명령은 저장소 루트, Node22.22.0/npm10.9.8에서 `LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false`를 앞에 지정해 실행했다. 이 기기에서는 `PATH=/Users/hansang-gyun/Desktop/baton/.tools/node22/node_modules/.bin:$PATH`도 지정했다. build의 통과 수 `—`는 테스트 사례 수가 없는 명령이라는 뜻이다. API 테스트 중 `mode=live`로 저장되는 모의 OpenAI transport 사례는 실제 외부 호출 성공으로 세지 않는다.

성공 작업 재사용 검사는 최종 전체 실행 뒤 job ID 동일/LLM1·STT1 카운터 단언을 추가로 강화하고 `npm run test:e2e -- tests/e2e/record-flow.spec.ts -g 'memo failure retains input'`으로 1통과/0실패(7.8초)를 확인했다. 같은 사례의 추가 확인이며 총37건에 더해 집계하지 않는다.

선행/관련 검사도 재사용했다: 병원 API2건, recovery/source/jobs/sharing43건, 불일치 확인 상태의 다음 브리핑 전파5건, OpenAI/record 관련43건, 진료 흐름+공유+세션+새 previsit 회귀22건. 이 수는 최종 전체260/37에 포함되거나 같은 검사의 중간 실행이므로 합산하지 않는다.

### T048~T051 관찰

글씨18/22/26px·흰 배경/검은 글씨/검은3px테두리 고대비를 설정하고 전역 적용을 확인했다. 로그아웃/계정 전환, 같은 브라우저 컨텍스트의 페이지 닫기/재열기에도 설정이 유지된다. 잘못된 저장 값·저장 실패에서도 기본값/조작이 동작한다. OS 브라우저 프로필 재시작이나 모든 보조기기 검사는 하지 않았다.

390×844 Chromium, 최대 글씨·고대비에서 B 설정/홈/질문/브리핑/입력/검토/공유 확인/타임라인, 환자 범위/전체 질문·브리핑/불일치/메모 수정/위치/약도/전체 검토·타임라인, 로그인/C홈/C타임라인의 **20화면 상태**를 검사했다. 가로 넘침·컨트롤 글자 잘림·스크롤 후 하단 메뉴 가림/hit test 실패는 최종 실행0건이다. 보통 글씨에서는 B 변경/질문의 첫 화면 배치 회귀도 통과했다. 전체 화면의 내용을 동시에 보여준다는 뜻은 아니며 큰 글씨는 스크롤을 사용한다. 설정·병원·입력 스크린샷을 직접 확인했다.

`GET /api/hospitals/h_01`은 기존 DTO·시드와 정확히 일치하며 인증401/없는병원404/조회AI0 검사를 통과했다. 지도/원내약도 정적 SVG, 주소·가상 전화, 안내5단계·참고 경험3개를 표시한다. 외부 지도 SDK/동적 길찾기/경험 작성은 없다.

### T065 축소 평가·실패 사례

[실측 JSON](references/final-fixture-evaluation.json)의 validation4건에서 기대 state/issues **4/4**, 정확 문자열 금지값 혼입 탐지 **1/1**, 사례 단위 누출 **검사 전1/4(25%)→검사 후0/4(0%)**였다. 검사 후는 blocked 낮은 블록을 비공개한 결과이며 내용을 정화해서 공개한 결과가 아니다. 실제 비교 코드로 만든 alert는 정답 파일과 **1/1 정확 일치**다. 표본이 작으므로 탐지율 일반화·실제 OpenAI/의료 정확성 평가는 아니다.

별도 도전은 gold4 밖의 가상 진단 재서술1건이다. companion 쉬운 요약을 `케이 원이라는 가상의 질환에 관한 설명이 있었어요.`로 바꾸면 기대blocked에 실제ready로 **탐지0/1 실패**한다. 정확 문자열/근거 앵커 규칙이 재서술을 완전히 막지 못함을 실제로 관찰했다. 이 후보는 평가 중 메모리에서만 검증했고 제품 DB에 저장/공유하지 않았다. 원본 fixture/검증 조건을 바꿔 결과를 감추지 않았다.

원래 약20장 문서 추출·음성 정답 평가는 **미수행**. 문서 수정률은 Tier C 미선택으로 분모 없음/N/A다. 시드 블록의 사실 항목 객체29곳에서 내부 sourceRef 또는 null+needsCheck가 **29/29**였지만, 사실의 의미적 참/거짓이나 근거의 의료적 정확성을 증명하지 않는다.

### T066 복구·중복·보안

임시 파일 SQLite를 실제로 닫고 다시 열어 buildApp 시작 시 running→failed/internal, 제품 GET jobs의 실패 표시, 동일 입력 attempt2 재시도/중복 방지, 성공 후 재시작의 미재생, 기존 공유본 보존을 확인했다. 브라우저 실패 UI는 전용 테스트 진입점의 결정적 중단 경계이며 OS 프로세스 강제 종료 실험으로 부르지 않는다.

실제 제품 API/브라우저에서 공유 전 비공개·허용 kind 키만 응답·blocked 우회 거부·오래된 검토본409·권한 철회403·중복 생성/재시도·같은 UUID 재전송의 publish로그1건·원문 경로/링크 탈출 차단·공개 범위 변경 뒤 과거 응답/원문 blob 제거를 확인했다. GET/scope에서는 provider 호출 증가0이다. fixture 배지를 저장된 대체 결과로 명시했다.

진료 동행 노트4건에서는 코드 변경 없는6.6초 동안 HMR update/full-reload·main frame navigation·자동 job poll 없이 입력이 유지됐다. 탭 복귀의 권한 재조회 뒤 메모/체크가 유지됐다. 저장 후 동일 textarea DOM과 내용/체크·성공 안내를 유지하며 스크롤 변화는80px 미만이었다(0px 고정 주장 아님). 메타데이터 응답을600ms 지연한 상태와 입력을 새로 고친 경우도 검사했다. 저장 실패 후 내용 유지, 즉시 정리의 최신 inputVersion, 이미 succeeded인 job을 재사용한 올바른 검토본, 명시적 공유 후 타임라인까지 통과했다. GET 오류는2.3초 추가 대기 중 자동 재시도0, 직접 재시도 성공, 실제 scope 철회 시 폼 제거·복구 뒤 과거 입력 없음도 통과했다.

### T067 두 경로 2회 연속 완주

추가 진료 흐름 수정 후 최종37건 실행에 포함해 다시 완주했다. [demo.md](demo.md)에 매회 초기 상태·계정·순서를 기록했고 [이어받기 JSON](references/final-handoff-rehearsal.json), [범위 변경 JSON](references/final-scope-rehearsal.json)을 보존했다.

- B→C→A 이어받기: **2/2**; 총12,810ms/12,575ms. 질문3→통합2+AI추가1, 변경2·질문3, 정리 전사/메모/검토/공유, C 허용 조회, A 근거/null·불일치 확인 예정 유지. 각 LLM3/STT1, GET10회 동안 추가 호출0.
- 환자→B 범위 변경: **2/2**; 총1,616ms/1,561ms. schedule→full→companion의 다음 응답/화면·과거 내용 제거·B PUT403·로그3건. 각 LLM0/STT0.

회차 사이 새 격리 시드로 초기화했다. 이 자동 시연은 사람의 읽기·판단 시간이나 실제 음성 인식/실제 OpenAI 성공률을 측정한 것이 아니다.

| SC | 실제 측정·관찰 | 판정/한계 |
|---|---|---|
| SC-001 | B 변경2/질문3 확인2/2, DOM 확인 구간23ms/19ms | 자동 확인 통과; 사람의 30초 이해도 **미검증** |
| SC-002 | 시드 사실 항목 객체29/29 내부 근거 또는 null+needsCheck, A 근거/null UI 확인 | 앵커 존재/범위 검증; 의미적 참·의료 정확성 미검증 |
| SC-003 | 역할별 API/E2E의 금지 키·원문 보호 회귀 통과, gold정확값 누출0/4 | 별도 재서술 탐지 실패1건. 의미적 금지정보 전체0건 보장 **미검증** |
| SC-004 | 각 리허설 GET10(총20)·scope3(총6)에서 추가 LLM/STT0 | 해당 시드/경로 통과 |
| SC-005 | 리허설 공유 전 노출0/2, blocked 우회·stale·철회 거부·중복 공유 회귀 통과 | 검증 사례 범위 통과; 자동 공유 없음 |
| SC-006 | A 두 근거/확인 예정 reload 유지2/2, 새 브리핑 입력·needsCheck 전파 API 통과 | 이후 모든 record 버전의 전파는 별도 미검증 |
| SC-007 | 최대 글씨/고대비20화면 상태의 경계/조작 검사0실패 | 구현 주요 화면 Chromium 범위; 전체 기기/보조기기 미검증 |
| SC-008 | 이어받기2/2·범위 변경2/2 연속 완주 | fixture 실제 API/브라우저 통과 |
| SC-009 | validation4·alert1 축소 평가/별도 실패 기록 | 원래20장 문서·음성 평가 **미수행** |
| SC-010 | fixture 명시 배지·실제/모의/사용자 보고 출처 구분 | 문서 수정 기능 미선택, 수정률분모 없음/N/A |

### 해소한 중간 실패와 최종 한계

시작 baseline API245/0실패였으며 기존 실패를 숨기지 않았다. 병원 red2건·접근성 scroll/hit/textarea 실패는 구현/검사 보완 후 통과했다. 진료 흐름 red3건과 진단 red5건은 예상 실패 확인이다. 구현 중 잘못 참조한 NoteResponse/Job.inputVersion 타입 오류와 초기 로그인 redirect 회귀3건을 공유 스키마/현행 Job 계약·첫 로드 대기로 수정했다. 전체37건의 중간 실행36통과/1실패는 질문 validation_failed의 테스트 기대 문구를 연결 실패로 잘못 바꾼 것이어서 검증 실패 문구로 바로잡았다. 최종 전체37/0실패와 API260/0실패·preview14/0실패로 확인했다. 평가의 별도 재서술 실패1건은 **해소하지 않았고 한계로 유지**한다.

원래 T065 전체 평가, Tier C(T052~T064), 실제 STT/AWS, 에이전트의 실제 OpenAI record 재실행/전체 파이프라인 live 품질, 사람의 이해도·모든 기기의 접근성은 미완료/미검증이다. 사용자 단일 live 응답 보고와 DB의 과거 live 메타데이터, 다른 CLI PR38의 검증 기록을 이번 측정 수치에 합산하지 않는다. 사용자 서버/개발 DB/업로드는 테스트 대상으로 재사용하거나 종료/초기화하지 않았다.

## T068 기록·Git·종료

README·demo·quickstart·decisions·tasks·앱 지침·FE 계약·테스트/스크립트 안내를 갱신했다. 고정 패키지/lockfile·공통 계약·DB 스키마·원본 fixture·reviewer 체크리스트는 변경하지 않았다. 수정 Markdown의 로컬 링크 누락0, diff 공백 검사 통과. `.env`, `.aws`, SQLite/sidecar, uploads, test-results는 Git 제외를 확인했고 실제 민감 파일 tracked0건이다. 사용자 지정 경로도 보호하도록 `*.sqlite`, `*.sqlite-*`, `uploads/`를 제외에 추가했다. 웹 빌드에 OPENAI_API_KEY/api.openai.com/fixtures/seed/가상 로그인 비밀번호 리터럴이 없다.

`.specify/extensions.yml`은 종료 시에도 없어 after_implement hook이 없다. 팀 커밋 컨벤션으로 `feat/39-final-validation`에 로컬 커밋하고 이슈 #39·#13에 결과/남은 한계를 기록한다. 사용자 이번 승인에 따라 push·PR 생성·원격 병합 없이 최종 체크포인트에서 멈춘다. 이슈는 원격 반영 전 열린 상태로 유지한다.
