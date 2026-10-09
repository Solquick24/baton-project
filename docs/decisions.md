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
| 2026-10-09 | 샘플 데이터셋 연결(T010·T037·T038·T065 참고, 작업 미완료) | v2.1 ZIP은 참고 자료로 분리하고 현행 가상 4계정·3범위·시드/fixture를 유지. 실제 약·MIMIC·raw mock·private notes는 직접 가져오지 않음. 14 PNG와 추출 20건을 구분 | 원본의 실제 제품·2범위·6진료가 현행 계약과 다름. 더 좁게 공개하는 원칙 적용. 연결표·25건 무결성 검사 결과는 docs/dataset-integration.md에 기록 |
| 2026-10-09 | AWS 환경 재점검(T007 일부, 작업 미완료) | 최신 `0fe3573`의 기존 S3 재사용·LLM/STT fixture 기본값 적용. 앞선 사용자 승인으로 준비한 임시 버킷을 재사용하고 추가 AWS 자원은 생성하지 않음. Sonnet 5 Converse tool-use 접근 확인은 계정 제한으로 실패 | AGENTS.md·현행 .env.example의 범위 준수. 명세 파일은 원격 최신본을 유지. 실제 값은 Git 제외 .env·infra/local-ai.outputs.json, 상세는 docs/aws-setup.md에 기록 |
| 2026-10-09 | T001 | Node 22.22.0/npm 10.9.8과 AGENTS.md의 패키지 버전을 그대로 고정. npm ci --ignore-scripts 후 macOS arm64에서 better-sqlite3 실제 SQL·트랜잭션 테스트 통과 | 지정 버전 호환성을 현재 컴퓨터에서 확인. 시스템 기본 Node 24 대신 작업 폴더 전용 Node 22 사용 |
| 2026-10-09 | T002–T005 | 웹은 시작 안내·라우터·실제 health 연결만, API는 /api/health만 제공. 공유 계약은 health부터 TS 소스로 export | Phase 1만 수행하라는 사용자 지시. T008 이후의 환자·권한 스키마와 사용자 기능을 선행 구현하지 않음 |
| 2026-10-09 | T005 | seed 명령은 연결하되 T009·T010 전에는 종료 코드 1로 명확히 거부하고 DB를 변경하지 않음. API/contracts build는 tsc --noEmit, 웹은 Vite 실제 산출물 | 시드 DB 투입은 Phase 2의 T010. Phase 1에서 가짜 성공이나 빈 DB 초기화로 완료를 주장하지 않음 |
| 2026-10-09 | T006 | Vitest는 fixture·메모리 DB를 강제하고 SDK send를 차단. Playwright는 3101/5174 별도 포트·전용 data/e2e 경로, 서버 재사용 금지. 현재 e2e는 health·라우팅만 검증 | 로컬 live 설정·기존 개발 서버가 비용이나 거짓 테스트 성공을 만들지 않도록 격리. e2e 시드 준비는 T010 이후 연결 |
| 2026-10-09 | T007 | baton 계정의 서울 anthropic.claude-sonnet-5 연결 확인 요청 2회 모두 AccessDeniedException. Transcribe ListTranscriptionJobs와 기존 baton-transcribe-staging-201240241312-apne2 HeadBucket 성공. 기본 LLM/STT fixture 유지 | 최종 접근 결과는 references/phase1-ai-access.json. IAM 변경·자원 생성·업로드·전사 작업 생성 없음. 실제 음성이 없어 STT 변환은 미검증. Bedrock tool use·출력 검증도 성공으로 계산하지 않음 |

Phase 1 체크포인트 결과와 범위는 [phase1-checkpoint.md](phase1-checkpoint.md)에 기록했다.
