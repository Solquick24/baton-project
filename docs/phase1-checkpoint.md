# Phase 1 실행 기반 체크포인트

2026-10-09, 사용자 요청 범위 **T001–T007만** 수행했다. Foundation(T008 이후)은 시작하지 않았다.
기존 가상 시드·fixture·명세 계약은 그대로 유지했다.

## 구현한 것

| 작업 | 결과 |
|---|---|
| T001 | Node 22.22.0/npm 10.9.8, 지정 의존성 설치·정확한 버전/lockfile 고정, macOS arm64 SQLite 바인딩·실제 SQL 검증 |
| T002 | React 진입점, 390px 시작 화면, 가상 데이터 배지, BrowserRouter, Vite /api 프록시 |
| T003 | Fastify 조립, localhost 시작, JWT/multipart 플러그인 설정, health, SIGINT/SIGTERM 안전 종료 |
| T004 | process.loadEnvFile, JWT_SECRET 필수 검증, 포트·날짜·모드·boolean 검증, apps/api 기준 경로 해석 |
| T005 | dev/seed/check:ai/typecheck/build/test/test:e2e 명령, TS 소스 계약 export, 세 workspace + 도구 타입 검사 |
| T006 | Vitest API inject/환경/SQLite/실수로 AWS 호출 방지 테스트, 격리된 Playwright 서버·모바일 브라우저 연결 검증 |
| T007 | 별도 AWS 점검 스크립트와 실제 성공/거부 결과 기록. 실패를 정상 상태로 바꾸지 않고 종료 코드 1 반환 |

현재 API는 `/api/health`만 제공한다. `/`·`/login`은 준비 안내 화면이다.
로그인 handler, DB schema, 시드 투입, 권한, AI provider와 실제 진료 기능은 아직 없다.
`seed` 실행 명령은 연결돼 있지만 T009·T010 전에는 실패(종료 코드 1)하며 DB를 생성하거나 변경하지 않는다.
Playwright도 아직 시드를 투입하지 않는다. T010 이후 전용 DB seed를 webServer 준비에 연결해야 한다.

## 실제 실행한 검증

| 명령·검사 | 최종 결과 |
|---|---|
| npm install --ignore-scripts / npm ci --offline --ignore-scripts | 성공. lockfile로 182개 패키지 재설치 |
| npm ls --workspaces --depth=0 | 지정 버전과 세 workspace 연결 확인 |
| npm run typecheck | API/web/contracts 및 scripts·Playwright 타입 검사 통과 |
| npm run build | 타입 검사 + Vite 빌드 성공 |
| npm run test | **17 통과 / 0 실패**. fixture 모드, 메모리 SQLite. AWS send 차단 검증 포함 |
| npm run test:e2e | **1 통과 / 0 실패**. Chromium, 390×844. Vite→실제 로컬 API, /login 직접 진입, 알 수 없는 경로 복귀 |
| npm run dev | API :3001 + web :5173 동시 시작, API 직접/웹 프록시 health 200 및 프론트 HTML 응답 확인 |
| API 직접 프로세스 SIGTERM | 시작 확인 후 정상 종료(exit 0). 개발 서버와 테스트 서버는 검증 뒤 종료 |
| npm run seed | 예상한 미구현 안내·exit 1, DB 변경 없음 |
| Git 제외 검사 | 실제 .env, SQLite·업로드 경로, node_modules, Vite dist, 테스트 산출물 제외 확인 |

서버/Chromium 실행은 샌드박스의 소켓 제한 때문에 승인된 실행으로 검사했다.
개발 모드·빌드·Vitest·Playwright는 실제 AWS 호출 없이 동작한다. 아래 T007만 별도로 live 접근을 검사했다.

## AWS 접근 결과

최종 기계 판독 결과: [phase1-ai-access.json](references/phase1-ai-access.json).

| 검사 | 결과·해석 |
|---|---|
| Bedrock 서울 anthropic.claude-sonnet-5 Converse + 작은 연결 확인 tool 요청 | **AccessDeniedException**. 계정의 모델 호출이 거부됐으며 tool use 성공·스키마 준수·AI 기능 완료를 주장하지 않는다 |
| Transcribe ListTranscriptionJobs | 성공. 목록 조회 권한만 확인; 실제 음성 변환 성공과 다름 |
| 기존 staging 버킷 HeadBucket | 성공. baton-transcribe-staging-201240241312-apne2. 조회 접근 확인이며 PutObject·전사 서비스 읽기 권한은 아직 미검증 |
| fixture manifest·가상 전사 JSON 읽기 | 성공. 파일 존재/JSON 파싱 확인이며 T008·T018의 런타임 스키마/저장 검증을 대체하지 않음 |

가상 연결 확인 문구로 Bedrock 요청을 두 번 시도했고 모두 거부됐다(버킷 제공 전/후 검사).
진료 데이터는 전송하지 않았고, S3 업로드·Transcribe 작업 시작·IAM 변경·AWS 자원 생성·배포는 하지 않았다.
실제 음성 파일이 없어 STT 변환 샘플은 미실시다.
기본 `LLM_MODE=fixture`, `STT_MODE=fixture`를 유지한다. **fixture provider와 실패 시 대체 처리 자체는 T018 이후 구현**한다.

## 로컬 실행 안내

이 컴퓨터의 Node 22/npm 10은 시스템 전역 설정을 바꾸지 않고 저장소 옆 `.tools/node22`에 준비했다.
다음은 이 checkout에서 바로 쓸 수 있는 명령이다(새 컴퓨터에서는 .nvmrc 버전과 npm 10을 설치).

```bash
export PATH="/Users/hansang-gyun/Desktop/baton/.tools/node22/node_modules/.bin:$PATH"
cd /Users/hansang-gyun/Desktop/baton/baton-project
npm run dev
```

실제 `apps/api/.env`에는 임의 JWT_SECRET과 로컬 AWS 프로필/버킷을 설정했고 Git에서 제외했다.
비밀값·임시 AWS 인증 토큰은 문서나 출력에 기록하지 않았다.
다른 checkout에서는 `.env.example`을 복사하고 JWT_SECRET을 직접 설정해야 한다.

## 체크포인트 종료

Phase 1의 로컬 실행 기준은 통과했다. T007의 live Bedrock 준비 상태는 실패로 남겨 뒀다.
다음 작업 T008–T020과 이후 T021–T068(Tier C 포함)은 모두 미완료다.
이어받기·범위 변경 시연, 사용자 권한/누출 검증, 실제 AI/STT 품질 평가는 수행하지 않았다.
명세 품질 체크리스트는 16/16 통과였고, .specify/extensions.yml이 없어 전/후 확장 hook은 없다.
