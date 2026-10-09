# 최종 MVP 결정 기록

**기준일**: 2026-10-09. 최신 근거는 [최종 기획안](baton_planning_최종.md)이다.
과거 합의를 소급 수정하지 않고 이번 사용자 선택과 문서 작성의 기본안을 구분한다.

| 항목 | 결정 | 근거·상태 |
|---|---|---|
| 인프라 | 로컬 Fastify·SQLite·시드 JWT; AI만 AWS | 이번 사용자 답변 |
| 배포 | 수행하지 않음 | 최종 기획안 확정 |
| 공유 | 정리→검토→POST share로 확정 | 이번 사용자 답변; 이전 자동 공유 폐기 |
| 권한 | scope=schedule/companion/full, 허용 블록 합집합 | 최종 기획안8.2 제안을 MVP 설계 기준으로 채택 |
| 원문 | full만, companion 인용도 없음 | 최종 기획안8.2 |
| 일정 공통 정보 | 날짜·진료과·병원·동행자 | 최종 기획안8.2·부록A |
| 동행 미정 상세 | watch/prep/alerts/관찰 원본은 full | 미정 항목 기본 거부 |
| 약 이름 | companion 표시 유지 | 추론 가능 한계를 기록, 확대 판단 없음 |
| 시드 | 환자+A(full)+B(companion)+C(schedule) | 최종 제안 기본안; 위임false·B첫동행 |
| 쉬운 요약 | 정리 호출에서 생성·저장1단계, 전용 화면2단계 | final F22 |
| 공유 기록·중단 | 로그1단계, stop2단계 | final F24 제안 채택 |
| 동의·초대 | 화면만, 시드 상태·미검증 고지 | 실동작·법률검증으로 주장하지 않음 |
| AI | Bedrock·Transcribe, 프롬프트·서버 후처리 | 모델 구조출력 보장 금지; 실제 계정 호출 확인 필요 |
| STT staging | 기존 제공 S3 버킷만 임시 사용 | Transcribe 배치 부속 의존성; 새 인프라 배포 없음 |
| 고대비 | 흰 배경·검은 글자·진한 청록·검은 테두리 | final25-1 |
| 도구 버전 | AGENTS.md 6장의 버전으로 설치·호환성 확인·lockfile 고정 | 제공 자료의 임시 프로젝트 검증 보고; 현 레포에는 아직 의존성 미설치 |

헌장의 AWS 기본 방향은 이번 로컬 가상 데모에 한정한 사용자 승인 예외로 계획에 기록했다(헌장 v1.1.0에 참조 추가).
실제 서비스·배포 설계 시 기술 예외와 실정보 처리 요건을 다시 검토한다.
모델·지도·AWS 제공 자원은 실제 환경 확인 전 호출 성공을 주장하지 않는다.

**후속 사용자 확정 결정(2026-10-09):** 텍스트 생성 AI는 Bedrock 대신 OpenAI API를 기본 선택한다. 위 표와 plan.md의 'AI만 AWS'는 이전 결정의 기록이며, 질문 통합·브리핑·record 텍스트에 한해 이 명시적 사용자 결정으로 변경한다. Bedrock/fixture 선택지와 STT는 보존한다. [구현·공식 문서·검증·남은 live 확인](openai-provider-checkpoint.md). 이는 Codex가 임의로 확대 해석한 기술 예외가 아니다.

## 명세 보완 기본안 (2026-10-09, 구현 전 빈칸 채우기 — 팀 검토 전)

Codex가 추측하지 않고 바로 구현할 수 있도록 문서에 없던 결정을 채웠다. 팀이 다르게 정하면 표와 관련 문서를 함께 고친다.

| 항목 | 기본안 | 반영 위치 |
|---|---|---|
| 블록 세트 구분 | 한 진료의 블록을 섹션 questions·briefing·record로 나누고 섹션별 version 포인터를 둔다 | data-model, schemas 3장 |
| 진료 전 자료 공개 | 질문 통합·브리핑은 검증 ready면 공유 단계 없이 허용 범위로 보임. 공유하기는 진료 정리(record)에만 | schemas 3장, api.md |
| 비동기 | AI 생성·전사는 모두 202 + jobId. 재시도는 같은 요청 재전송(attempt+1), 성공 작업이 있으면 재사용 | schemas 6장 |
| 원 질문 혼입 | 질문 등록 시 제한값 검사, 걸리면 visibility=full | schemas 4장 |
| 검증기 규칙 | 핵심 값 null → needsCheck 강제, 근거 없는 값 → needsCheck, 제한값 부분 문자열 → blocked, 의료 판단 문구 목록 → blocked | schemas 4장 |
| 정규화 | NFKC·소문자·공백 제거(문장부호 유지), 3자 미만 제외 | schemas 4장 |
| 불일치 처리 | edit_note=구조화 입력으로 새 revision 저장 후 재비교, reupload=안내만, confirm_hospital=awaiting | schemas 5장 |
| 공유 기록 | 진료 정리 공유 확정은 action=publish(targetUserId=null). 환자 전체 기록 경로 추가 | schemas 8장 |
| 공유 권한 | 초안 작성자(현재 companion 이상) 또는 환자·위임 대표 | schemas 8장 |
| 본인 범위 | 일반 보호자 응답에 본인 범위 이름도 넣지 않음. 화면은 블록 유무로 판단 | schemas 8장 |
| 시연 기준일 | DEMO_TODAY=2026-03-12(기획안의 1·2·3월 이야기 유지) | seed-story, .env.example |
| 가상 인물·약 | 박하늘 가족 4명 + 테스트 전용 비구성원 1명, 가상 약 이름, 진단·수치 자리표시자 | fixtures/seed |
| 녹음 허용 | 시드 true(1단계 파일 업로드가 이 설정을 따르므로) | fixtures/seed/patient.json |
| 시드 불일치 | ob_01(저녁 0.5정) vs rx_im_02(아침 0.5정) — 복용 시간 차이 | fixtures/expected/alerts.json |
| AI 추가 질문 | 불일치를 근거로 '언제 먹어야 하는지 확인하기'를 동행에게 보임(근거는 full만) | merge fixture |
| fixture 선택 | manifest 규칙: 메모에 '혼입 시연'→혼입 샘플, '실패 시연'→첫 시도 실패 | fixtures/expected/manifest.json |
| 모드 분리 | LLM_MODE·STT_MODE 별도, live 실패 시 fixture 대체 후 표시(LIVE_FALLBACK_TO_FIXTURE) | AGENTS.md, .env.example |
| 의존성 버전 | 2026-10-09 설치·타입검사·테스트·빌드 확인한 조합으로 고정(TypeScript 7 문제 시 5.9.3) | AGENTS.md 6장 |
| 비밀번호 해시 | node:crypto scrypt, 추가 의존성 없음 | data-model |
| 지도 | 외부 SDK 없이 정적 SVG(지도 키·약관 미확인) | screens.md |
| 약 이름 어휘 | Transcribe 커스텀 어휘는 새 AWS 자원이라 만들지 않음. 오인식은 확인 필요로 남는지 확인 | fixtures/audio/README.md |
| 녹음 대본 | 음성 파일은 저장소에 없고 팀원이 대본(=fixture 전사)을 녹음 | fixtures/audio/README.md |
| 평가 | 20장 모의 문서가 없어 T065는 fixture 4건·불일치 1건 축소판으로 실제 분모 기록 | tasks.md |
| 작업 범위 | Tier A(T001–T049) 필수, Tier C(2단계·화면만)는 요청 시에만 | tasks.md, AGENTS.md |

## 구현 중 결정

구현 에이전트가 문서에 없는 결정을 내렸을 때 한 줄씩 추가한다(날짜 · 작업 ID · 결정 · 이유).

| 날짜 | 작업 | 결정 | 이유 |
|---|---|---|---|
| 2026-10-09 | FE 첫 이슈 #2(T001·T020·T026–T028·T048–T049 일부, 전체 작업 미완료) | Vite preview 모드에서만 서버 측 개발용 응답을 제공. 새 질문은 실제 검증기 연결 전 환자·A의 full 전용 저장으로 제한하고 B 등록은 거부. 기존 질문·브리핑은 pregenerate 예시로 조회하고, 입력 변경 후 일치하는 fixture가 없으면 실패. 실제 API 모드·빌드에는 어댑터·가상 비밀번호를 포함하지 않음 | 실제 API·DB·JWT·검증기가 없어 완료로 간주할 수 없음. 더 좁은 공개 원칙 적용. 구현·제한은 docs/frontend-plan.md와 apps/web/README.md에 기록 |
| 2026-10-09 | 샘플 데이터셋 연결(T010·T037·T038·T065 참고, 작업 미완료) | v2.1 ZIP은 참고 자료로 분리하고 현행 가상 4계정·3범위·시드/fixture를 유지. 실제 약·MIMIC·raw mock·private notes는 직접 가져오지 않음. 14 PNG와 추출 20건을 구분 | 원본의 실제 제품·2범위·6진료가 현행 계약과 다름. 더 좁게 공개하는 원칙 적용. 연결표·25건 무결성 검사 결과는 docs/dataset-integration.md에 기록 |
| 2026-10-09 | AWS 환경 재점검(T007 일부, 작업 미완료) | 최신 `0fe3573`의 기존 S3 재사용·LLM/STT fixture 기본값 적용. 앞선 사용자 승인으로 준비한 임시 버킷을 재사용하고 추가 AWS 자원은 생성하지 않음. Sonnet 5 Converse tool-use 접근 확인은 계정 제한으로 실패 | AGENTS.md·현행 .env.example의 범위 준수. 명세 파일은 원격 최신본을 유지. 실제 값은 Git 제외 .env·infra/local-ai.outputs.json, 상세는 docs/aws-setup.md에 기록 |
| 2026-10-09 | UI PDF 반영(T026–T029·T033–T034·T036·T045–T051 참고, 작업 미완료) | 사용자 선택에 따라 25쪽 PDF를 화면 정의·계획에 반영. 배치·색감은 PDF를 참고하고, 브리핑 질문을 변경 다음으로 이동·직접 녹음을 가상 파일 업로드로 대체·검토 후 공유 문구 유지. 기존 권한·시드·Tier는 유지 | PDF에 full 전용 내용·후순위 기능·다른 예시 인물이 섞여 있음. 원본·쪽 연결·조정은 docs/wireframe-integration.md, 설정 25·25-2는 PDF 밖 기존 정의를 사용 |
| 2026-10-09 | FE·BE 연동 계약 보완(#5, T008 참고·구현 미완료) | record-input으로 버전·업로드 행동 권한만 조회, draft inputVersion/stale 필수, alerts canResolve·full 수정 권한, blocked 최신본은 낮은 블록 비노출, 전사 uploadId 중복 키, 성공 share 멱등 저장 및 413/415/500 본문 확정 | 사용자 진행 요청에 따라 FE 연동의 빈칸 보완. 초안·원문·다른 가족 범위는 일반 조회에 추가하지 않음. 실서버 구현과 실제 BE 담당자 리뷰는 별도 |
| 2026-10-09 | T001 | Node 22.22.0/npm 10.9.8과 AGENTS.md의 패키지 버전을 그대로 고정. npm ci --ignore-scripts 후 macOS arm64에서 better-sqlite3 실제 SQL·트랜잭션 테스트 통과 | 지정 버전 호환성을 현재 컴퓨터에서 확인. 시스템 기본 Node 24 대신 작업 폴더 전용 Node 22 사용 |
| 2026-10-09 | T002–T005 | 웹은 시작 안내·라우터·실제 health 연결만, API는 /api/health만 제공. 공유 계약은 health부터 TS 소스로 export | Phase 1만 수행하라는 사용자 지시. T008 이후의 환자·권한 스키마와 사용자 기능을 선행 구현하지 않음 |
| 2026-10-09 | T005 | seed 명령은 연결하되 T009·T010 전에는 종료 코드 1로 명확히 거부하고 DB를 변경하지 않음. API/contracts build는 tsc --noEmit, 웹은 Vite 실제 산출물 | 시드 DB 투입은 Phase 2의 T010. Phase 1에서 가짜 성공이나 빈 DB 초기화로 완료를 주장하지 않음 |
| 2026-10-09 | T006 | Vitest는 fixture·메모리 DB를 강제하고 SDK send를 차단. Playwright는 3101/5174 별도 포트·전용 data/e2e 경로, 서버 재사용 금지. 현재 e2e는 health·라우팅만 검증 | 로컬 live 설정·기존 개발 서버가 비용이나 거짓 테스트 성공을 만들지 않도록 격리. e2e 시드 준비는 T010 이후 연결 |
| 2026-10-09 | T007 | baton 계정의 서울 anthropic.claude-sonnet-5 연결 확인 요청 2회 모두 AccessDeniedException. Transcribe ListTranscriptionJobs와 기존 baton-transcribe-staging-201240241312-apne2 HeadBucket 성공. 기본 LLM/STT fixture 유지 | 최종 접근 결과는 references/phase1-ai-access.json. IAM 변경·자원 생성·업로드·전사 작업 생성 없음. 실제 음성이 없어 STT 변환은 미검증. Bedrock tool use·출력 검증도 성공으로 계산하지 않음 |

Phase 1 체크포인트 결과와 범위는 [phase1-checkpoint.md](phase1-checkpoint.md)에 기록했다.

| 날짜 | 작업 | 결정 | 이유 |
|---|---|---|---|
| 2026-10-09 | T008–T019 범위 | 최신 devlop 3343ea1에서 기존 Phase 1 재사용. T020/apps/web·T021 이후·Tier C는 제외 | 사용자 명시 범위, Phase 2 전체 완료로 보고하지 않음 |
| 2026-10-09 | T010·T013 | 기본 시드/해시/불일치 생성만 구현. --pregenerate는 DB 열기 전 거부하며 T010 미완료 유지. 로그인은 검증된 기본 계정 시드를 사용 | T023·T024 생성 파이프라인은 범위 밖. fixture를 직접 주입한 가짜 생성 성공을 금지하고 로그인에 필요한 선행만 검증 |
| 2026-10-09 | T015·T016 | 공개 handler 대신 테스트 전용 /probe HTTP 경로에서 실제 인증·블록 repository·생성 input/provider spy를 검사. 내부 생성은 목적별 원본과 같은 과의 이전 공유 기록만 사용 | T025/T031/T032를 선행 구현하지 않으면서 API 권한·금지 kind 미조회·진료과/비공개 입력 격리를 확인 |
| 2026-10-09 | T017 | 초기 3343ea1의 6종 계약에서는 500을 upstream_error로 정규화했으나 최신 1343afe 반영 후 internal_error로 교체. requestId는 서버 생성, 로그는 method/status/requestId만 | 최신 schemas.md에 500 internal_error와 413/415 이유가 추가됨. 원문/경로/토큰/범위 상세를 노출하지 않고 현행 계약을 따름 |
| 2026-10-09 | T018 | fixture/live 동일 strict 스키마와 1회 스키마 재시도, failOnAttempts는 job attempt 기준. provider는 저장/공유하지 않으며 의미 안전성은 미완료 T041에 의존 | T041을 범위 밖에서 구현하거나 혼입 fixture를 스키마 통과만으로 ready 처리하지 않음. Bedrock 실제 접근 실패는 그대로 기록 |
| 2026-10-09 | T019 | handler와 실제 결과가 없는 job은 failed/internal. 완료 전에 현재 입력·권한과 실제 저장 version을 확인. 다른 companion의 중복 jobId 재사용은 404 | 미구현 파이프라인의 허위 완료 방지, jobs 조회 규칙과 현행 권한 준수. 후속 전사 worker는 입력 버전 1회 증가 필요 |
| 2026-10-09 | T006 재사용·호환 확인 | 기존 Playwright의 DB를 메모리로 설정하고 기존 웹 코드는 그대로 검사 | 사용자 요청의 테스트 fixture·메모리 SQLite 조건 충족, T020 제외. 상세는 backend-foundation-checkpoint.md |
| 2026-10-09 | T008·T009·T014–T019 최신 devlop 반영 | 구현을 81b862a로 보존한 뒤 1343afe 병합. api.ts에 FE 공통 계약, blocked draft는 낮은 블록 미조회, canResolve는 full 환자/지정 대표에 한정하고 위임과 분리, 전사는 uploadId별 중복, share_requests는 DB 기반만 추가 | 원격 최신 schemas.md 8·8.1 및 data-model 변경을 T008–T019 안에서 반영. 실제 record-input/메모/alerts/공유·생성 handler는 T021 이후라 구현하지 않음 |
| 2026-10-09 | T009·T019 | 이전 jobs 테이블은 트랜잭션으로 새 구조에 행·상태를 복사. 기존 전사 uploadId는 null로 보존하고 실행을 거부하며 추정하지 않음 | 기존 로컬 작업 데이터 보존과 최신 생성/전사 중복 인덱스 분리. 실제 전사 저장은 T039 의존성 |
| 2026-10-09 | PR #11 통합·T008 | devlop 6f92b51의 프론트와 백엔드 기반을 함께 보존. FE DTO 이름은 별칭으로 유지하고 VisitView·Job 등 중복 타입은 Zod 추론 타입으로 통일 | 자동 병합된 임시 published 전용 VisitView가 백엔드 draft 계약을 가리거나 Job 결과 상태를 넓히는 문제 방지. 실제 API 연결 완료 범위는 확대하지 않음 |
| 2026-10-09 | T021–T025·T010, 이슈 #14/분담 #13 | 깨끗한 기존 codex/9-backend-foundation을 보존하고 최신 origin/devlop 2a54ab4에서 feat/14-phase3-backend 생성. apps/web·공유 스키마·fixture·고정 패키지는 그대로 사용 | 사용자 지정 이슈별 브랜치·기존 구현 재사용·프론트 제외 범위 준수 |
| 2026-10-09 | T023·T024의 최소 안전 선행 | T041 미구현 의존성을 먼저 보고하고 사용자 “Phase 3에 필요한 최소 안전 검증 선행 허용” 답변 후 질문·브리핑 공통 검증만 구현. T041 전체·record는 미완료 | strict 스키마 통과만으로 ready 공개하지 않음. Phase 4 전체로 범위 확대하지 않음 |
| 2026-10-09 | T022·T023·T024 | 같은 환자 full 제한값·이번 full 출력·모든 공개 문자열(ID 포함)·의료 판단·근거 identity/quote·원 질문 관계 검사. full의 근거 없는 값은 null/needsCheck, non-nullable 공개 문장의 근거 누락은 validation_failed | 더 좁은 공개 원칙. 재서술·의미적 정확성을 완전히 보장하지 않는 휴리스틱 한계 명시 |
| 2026-10-09 | T016 재사용·T023·T024 | 열린 alert 참조를 실제 동일 환자/과/시점·공유 자료와 대조하고 맞지 않는 alert는 생성 입력에서 제외 | alert JSON의 ID/quote만 믿으면 다른 과·미공유 자료가 섞일 수 있음. 제외된 근거를 요구하는 fixture도 실패 처리 |
| 2026-10-09 | T023·T024·T019 | 입력·제한값 스냅샷과 현재 권한/버전을 저장 직전 재확인. 블록·최신 포인터·job 성공을 하나의 트랜잭션으로 저장 | 대기 중 입력/권한 변경 및 중간 실패의 부분 저장 방지 |
| 2026-10-09 | T023·T024 | 최신 ready 또는 blocked로 완료 포인터 갱신, failed/generating은 유지. blocked는 낮은 블록 미조회·full만 조회, ready 질문/브리핑은 즉시 허용 공개 | FE API 보류 계약 준수. record POST share와 구분하며 recordPublishedVersion/status/share 로그를 변경하지 않음 |
| 2026-10-09 | T024 | stale 브리핑의 질문 문장은 해당 브리핑이 생성된 questions version에서 조회 | 최신 통합 질문으로 과거 브리핑의 의미를 바꾸지 않고 stale로 알림 |
| 2026-10-09 | T010 | --database로 별도 경로 지정, 실제 fixture provider/기존 jobs/동일 파이프라인으로 pregenerate. 두 결과가 fixture/ready일 때만 성공. 실패 시 기본 시드·이미 성공한 결과·실패 job은 보존 | 직접 fixture 삽입으로 생성 성공을 꾸미지 않음. 임시 DB 생성·저장·API 조회와 개발 DB 해시 불변 확인 |
| 2026-10-09 | T021·FE 인수인계 | 기존 preview 14개·health E2E 1개 회귀와 실제 API 119개를 구분. 새 공개 질문을 누락하는 고정 fixture는 validation_failed | T020·T026–T029 통합 검증을 완료로 주장하지 않고 실제 API·요청/응답/오류·남은 T032 등을 체크포인트에 전달 |
| 2026-10-09 | Phase 5 예외·이슈 #17/분담 #13 | 이번 사용자 요청의 백엔드 역할·Phase 순차 진행 예외를 적용. 최신 devlop 175fa6f에서 새 브랜치를 만들고 독립 구현 커밋 뒤 d3e0417 문서 변경 병합. PR #16 병합 및 #13 본문/댓글 확인 | 과거 FE 리드 지침보다 현 요청 우선. Phase 4 담당 계정·미게시 구현 범위를 추정하지 않음 |
| 2026-10-09 | T038·T039·T042·T043 | 원격 재확인에도 T031/T032 구현 근거 없음. POST share 404인 실제 수용 테스트 3건은 명시적 skip으로 보존하고 T038 전체·의존 작업은 미완료 유지 | 중복 파일/로그 기반이나 가짜 성공을 만들지 않고 독립 작업만 draft PR. 공유 멱등·blocked 우회·stale 거부는 T043 후 실제 API 검증 필요 |
| 2026-10-09 | T040·T041 | 기존 record 입력/jobs/provider/스키마/검토 조회 재사용. 서버 소유 전사 복사, 입력·권한 재확인, 세 블록/검토본/alert/job 원자 저장. 근거 없는 nullable 사실은 null+needsCheck, 민감 혼입은 blocked | 자동 공유·공개 포인터/상태 변경 없음. worker 테스트의 준비 전사·기존 공개 상태는 T039/T043 HTTP 성공으로 계산하지 않음 |
| 2026-10-09 | T041 | 질문·브리핑의 기존 검증을 보존하고 record 항목 관계·근거 identity/quote·복약량/시점·일정/검사 값 앵커를 추가. 질문 자체만으로 답변의 근거를 인정하지 않음 | 명세의 문자열 휴리스틱을 구현하며 재서술·자유 문장의 의미/의료 정확성을 완전히 보장한다고 주장하지 않음. fixture/live 주입 응답 모두 같은 저장 전 검사 |
| 2026-10-09 | T044·홈 비공개 | 미공유 record alert는 ready 검토본의 full 검토 권한자만 읽고 일반 가족 full의 목록/홈 건수에서도 제외. 기존 공개본 또는 publish 로그가 있는 결과는 조회 가능 | 미공유 정리의 원문/복약 내용이 불일치 API나 개수로 먼저 공개되지 않도록 더 좁은 규칙 선택. 낮은 범위는 목록·개수·상세 없음 |
| 2026-10-09 | T044·seed | 기존 시드의 dose/timing 비교를 공통 순수 함수로 이동해 ready 정리 비교에도 사용. edit_note는 관찰 새 revision 저장 후 재비교, 과거 블록 불변. confirm_hospital=awaiting_confirmation, reupload=open | 두 근거 중 정답을 판단하지 않음. #15 후속 seed 변경과 병합 시 작은 공통 비교 연결 보존. 공유 계약·DB·권한·패키지·fixture JSON·apps/web 변경 없음 |
| 2026-10-09 | 제출 전 최신 지침 | PR #20 병합 뒤 origin/devlop b3fa963을 d8482be로 반영하고 새 앱별 AGENTS.md 확인 | 기존 변경을 커밋으로 보존. 추가 변경은 문서뿐이며 T031/T032 구현은 여전히 없음. 기능 코드 불변으로 통과한 검사를 반복 실행하지 않음 |
| 2026-10-09 | T030~T032 최초 검토 시 브랜치·게시 | origin/devlop d3e0417에서 feat/t030-t032-sharing-api 로컬 브랜치 생성. 최초 검토 시 신규 이슈는 초안만 준비하고 커밋·푸시·PR은 보류함 | 사용자의 사전 검토 지시가 저장소 자동 게시·커밋 절차보다 우선함 |
| 2026-10-09 | T030~T032 게시 승인·최신 지침 통합 | 사용자 검토 후 커밋·푸시 및 devlop 반영 승인. 이슈 #29와 최신 origin/devlop b3fa963 기반 feat/29-sharing-api로 진행. 원격 앱별 AGENTS.md 안내를 보존하고 백엔드 지침을 확인 | 검토한 변경만 게시하며 main 반영은 제외. 실제 반영 단계는 이슈·PR에 기록하고 이후 변경도 사용자 사전 검토를 받음 |
| 2026-10-09 | T031 | 현행 활성 관계·지정 대표·위임으로 관리 권한 판정. 환자 대상 변경은 400, 비활성 대상 변경은 404, 같은 값은 로그 없음. 변경·감사 로그·응답 검증은 immediate 트랜잭션. 비활성 가족의 과거 로그는 관리자가 조회 가능 | schemas.md의 환자 full 고정·공유 이력 보존. 범위 변경으로 중단된 가족을 재활성화하지 않는 더 좁은 공개 원칙 |
| 2026-10-09 | T032 | 등록된 환자·진료 파일만 full 인증 스트림으로 반환. 루트 안 경로·realpath·파일 크기 확인, 비동기 파일 열기 뒤 권한 재검사. 알려진 음성 MIME 외에는 octet-stream, no-store·nosniff·고정 attachment 이름 | 원문은 공개 static에 두지 않으며 경로·파일명·낮은 권한 오류에서 원문을 노출하지 않음. 업로드/전사 생성은 T039에 남김 |
| 2026-10-09 | 사용자 결정·OpenAI 이슈 #23 | '텍스트 생성 AI를 Bedrock 대신 OpenAI API로 사용'을 기존 AI만 AWS 방향의 명시적 변경 근거로 적용. 기본 LLM_PROVIDER=openai, LLM_MODE/STT_MODE는 fixture 유지 | 질문·브리핑·record 텍스트만 변경. Bedrock/fixture와 전사 provider·기존 안전/권한/검토 후 공유 규칙 보존 |
| 2026-10-09 | OpenAI provider·계약 | Node fetch Responses API/store:false/strict text.format 사용. 기존 Zod로 wire schema를 만들고 null/선택 필드 의미를 유지. validatedLLM 및 파이프라인 안전 검증 재사용 | 새로운 SDK/패키지·공유 계약·DB 변경 없음. 모델별 temperature/reasoning·대화 상태·외부 도구를 추가하지 않음. 형식 보장을 의미 안전성으로 간주하지 않음 |
| 2026-10-09 | Phase 5 보존·OpenAI 회귀 | feat/17-phase5-backend 7a7b452와 draft PR #22 보존. 최신 devlop b3fa963에서 별도 작업. Phase 5 worker/record 안전 검증은 별도 임시 조합에서만 회귀 검사 | 관련 없는 미병합 Phase 5 코드를 OpenAI PR에 섞지 않음. 실제 record 경로 연결은 PR #22와 후속 T039/T042/T043 의존성 |
| 2026-10-09 | 모델·키·실제 연결 | 공식 문서로 예시 gpt-4.1-mini-2025-04-14의 Responses/구조화 출력 지원 확인. 런타임 모델 암묵 기본값 없음. 키·모델 미설정이라 live 호출 미실시 | 키는 사용자 apps/api/.env 직접 입력, 비밀값 미출력. 실제 점검은 fallback=false의 최소 가상 질문/동일 안전 검증으로 별도 수행해야 성공을 보고할 수 있음 |
| 2026-10-09 | T030~T032 PR #30 최신 devlop 통합 | PR 생성 중 devlop에 OpenAI PR #27(5b4fd9c)이 병합됨. 문서 충돌은 두 작업의 결정·인수인계를 보존해 해결하고 app.ts의 provider 선택과 두 새 handler 등록을 함께 유지 | 다른 담당자의 provider·설정·테스트를 덮어쓰지 않으며 통합 후 fixture 전체 검사를 재실행 |
| 2026-10-09 | Phase 5 #17/#22 재개 | 사용자 백엔드 마무리·커밋/push/PR 갱신 요청을 적용. 기존 7a7b452를 보존하고 실제 devlop 97dfc7a를 0d9eb52로 병합, alerts/Phase 4/OpenAI 양쪽 API와 결정 기록 유지 | Phase 4 당시 사전 게시 보류는 이번 명시 승인에 적용하지 않음. devlop/main 직접 push·자동 머지 금지 유지 |
| 2026-10-09 | T031/T032 선행 검토 | 제품 경로·트랜잭션·테스트를 확인하고 기존 권한/파일/로그 기반 재사용. macOS root 별칭 절대 경로 404는 configured root+canonical realpath 경계로 최소 수정 | /probe·문서 체크만으로 제품 완료 판단하지 않음. 외부·링크 탈출 거부 보존 |
| 2026-10-09 | T039 | UUID/비공개 단일 파일·허용 MIME/20MB. 입력 버전은 메모 저장/전사 완료에서만 증가. strict segment 검증·현재 권한 재검사·전사/버전/job 원자 저장. 실패 파일 등록은 파일도 정리 | 기존 Amazon Transcribe와 STT_MODE 의미 유지, 텍스트 OpenAI 선택과 독립. 실제 AWS 없이 fixture·SDK 모의 검증 |
| 2026-10-09 | T039 staging | 같은 기존 bucket/prefix에 입력/결과 회수·정리, 한국어 batch·3분 상한. bucket 누락/실패는 stt_unavailable, 설정 허용 시 fixture fallback. 정리 실패를 live 성공으로 처리하지 않음 | 실제 권한/정리·음성 인식 정확도 미검증. timeout 중 원격 작업 또는 정리 권한 실패의 잔여 자료 가능성은 체크포인트에 기록 |
| 2026-10-09 | T042/T043 | records service/handler에 기존 worker·입력/JWT·kind 조회 연결. 최신 ready draft/input·현재 권한 검사 후 공개 포인터/status/publish 로그/성공 멱등을 immediate 트랜잭션으로 저장 | 새 공통 schema/DB/repository 없이 구현. 자동 공유 없음, 기존 공유본 보존 |
| 2026-10-09 | T043 멱등 재전송 | 성공 키/같은 초안 재공유도 현재 권한·최신 입력/초안 검사 뒤 허용. 입력 변경·새 draft 이후 과거 성공 키는 stale_input이며 과거 공개본은 유지 | 오래된 검토본을 다시 최신으로 publish하지 않는 더 좁은 규칙. 같은 키의 다른 본문은 idempotency_conflict, 실패 멱등 결과 저장 없음 |
| 2026-10-09 | 검증·FE 인수인계 | 백엔드 T037~T044 제품 API fixture 검증 완료. API 244/skip0, 타입/빌드, preview14, health1, 임시 DB pregenerate CLI+제품 조회 구분 기록 | 화면/캐시/실제 버튼 통합과 외부 AI 성공·의미적 정확성은 미검증. 프론트·Tier B/C 확대 없음 |
