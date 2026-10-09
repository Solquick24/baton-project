# 바통(Baton) — 진료 동행 노트

가족이 번갈아 동행해도 진료 맥락이 끊기지 않도록 진료 전·중·후 기록을 이어주는 프로젝트다.

현재는 **Phase 1(T001–T007) 실행 기반 구현 완료** 단계다. 웹 시작 화면·로컬 API health·환경 설정·빌드·테스트 도구가 실행된다. 로그인·환자 DB·진료 기능·AI provider는 아직 구현하지 않았다. Phase 1에서는 AWS 자원을 생성하지 않았다. 앞선 AWS 환경 준비·검증 결과는 [AWS 준비 기록](docs/aws-setup.md)에 정리했다.

- [Phase 1 체크포인트와 실제 검증 결과](docs/phase1-checkpoint.md)

## 문서

- [대회 참가 규정과 제출 참고사항](docs/devday-guide.md)
- [사전 작업과 가져온 자료 공개](docs/prework-disclosure.md)
- [대회 저장소 마이그레이션 기록](docs/repository-migration.md)
- [제품 요구사항 문서(PRD)](docs/PRD.md)
- [Track 2 제출안 본문 기록](docs/references/track2-submission.md)
- [프로젝트 헌장](.specify/memory/constitution.md)
- [최종 기획안](docs/baton_planning_최종.md) · [변경 검토](docs/planning-review.md)
- [최신 Codex 준비 자료와 기존 레포 비교](docs/codex-ready-review.md)
- [이전 기획안](docs/archive/baton_planning_2026-10-09_04-15-10_KST.md) ( 자료 히스토리, 구현 근거 아님)
- [구현 에이전트 안내 AGENTS.md](AGENTS.md)
- [팀 커밋 컨벤션](docs/commit-convention.md)
- [브랜치 작업 방식: devlop → main](docs/branch-workflow.md)
- [로컬 구성의 AWS AI 준비·검증 결과](docs/aws-setup.md)
- [계약 스키마](specs/001-baton-mvp/contracts/schemas.md) · [화면 정의](specs/001-baton-mvp/screens.md) · [시드 스토리](specs/001-baton-mvp/seed-story.md)
- [팀 제공 UI 와이어프레임 PDF](docs/references/baton-ui-wireframe-selection.pdf) · [25쪽 화면 연결·반영 기준](docs/wireframe-integration.md)
- [샘플 데이터셋 v2.1 연결·검증·다음 단계](docs/dataset-integration.md)
- [MVP 명세](specs/001-baton-mvp/spec.md)
- [구현 계획](specs/001-baton-mvp/plan.md)
- [구현 작업 목록](specs/001-baton-mvp/tasks.md)
- [설계 조사](specs/001-baton-mvp/research.md)
- [데이터 모델](specs/001-baton-mvp/data-model.md)
- [API 계약](specs/001-baton-mvp/contracts/api.md) · [FE API 연동 기준](docs/fe-api-contract.md)
- [환경 준비·검증 가이드](specs/001-baton-mvp/quickstart.md)
- [명세 품질 검토](specs/001-baton-mvp/checklists/requirements.md)
- [아키텍처](docs/architecture.md) · [결정 기록](docs/decisions.md) · [데모 계획](docs/demo.md)

## 구조

```text
apps/web/             모바일 우선 React/Vite 프론트 폴더
apps/api/             로컬 Fastify·SQLite·JWT·AI·비동기 처리 폴더
packages/contracts/   공유 요청·응답·검증 스키마 폴더
infra/                이전 AWS 배포 예시 보존, 현재 구현 대상 제외
fixtures/             가상 시드·음성·문서·정답 자료 폴더
scripts/              환경 점검·시드·평가 스크립트 폴더
tests/e2e/            핵심 데모 검증 폴더
specs/001-baton-mvp/   명세와 설계 산출물
.specify/             Spec Kit 헌장·설정·템플릿·스크립트
.agents/skills/       팀에서 공유하는 Spec Kit 스킬
```

## 로컬 실행

Node.js 22.22.0(`.nvmrc`) / npm 10.9.8을 사용한다. 의존성은 lockfile에 고정했다.

```bash
npm ci --ignore-scripts --no-audit --no-fund
cp apps/api/.env.example apps/api/.env
# apps/api/.env의 JWT_SECRET을 32자 이상의 임의 비밀값으로 채운다.
npm run dev
```

웹은 http://127.0.0.1:5173, API health는 http://127.0.0.1:3001/api/health다.
브라우저의 /api 요청은 Vite가 로컬 API로 프록시한다. 로그인 화면은 아직 시작 화면만 제공한다.
기본 LLM/STT 모드는 fixture다. dev·테스트·빌드는 AWS를 호출하지 않는다.

```bash
npm run typecheck
npm run build
npm run test
npx playwright install chromium  # 최초 1회
npm run test:e2e
```

`npm run seed`는 Phase 2(T009·T010) 전에는 오류로 종료하고 DB를 변경하지 않는다.
`npm run check:ai`는 별도 수동 실행 명령이며 Bedrock 연결 확인 호출 1회와 Transcribe 목록·기존 S3 버킷 접근을 검사한다. 검사 실패는 종료 코드 1로 보고한다.
최종 구성은 로컬 서버·SQLite·시드 로그인, AI만 AWS 사용이다. 배포는 하지 않는다.
정리 결과는 검토 후 공유하기로 확정하며 원문·인용은 full에만 제공한다.

## 다음 구현 단계

Phase 1 체크포인트에서 멈춘 상태다. 다음 구현은 `tasks.md`의 Phase 2(T008–T020, Foundation)다.
Tier A(T001–T049)를 먼저 수행하고 Tier B와 마지막 결과 기록을 이어간다.
선택 2단계·화면만인 Tier C(T052–T064)는 사람이 명시적으로 요청할 때만 진행한다.
새 checkout에서는 다음 값을 지정해 Spec Kit가 main에서도 feature를 찾게 한다.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/001-baton-mvp
```

`.specify/feature.json`은 checkout별 로컬 포인터여서 공유하지 않는다.

### Codex로 구현 시작하기

Codex는 루트의 `AGENTS.md`를 먼저 읽는다. 작업 범위(Tier A만)·고정 버전·절대 규칙이 거기 있다.
`$speckit-implement`는 기본값이 "tasks.md 전부"라서, 범위를 같이 넘긴다. 예:

```
$speckit-implement AGENTS.md 4장의 Tier A만 수행한다. Phase 1(Setup)부터 순서대로 하고, 각 Phase 체크포인트를 통과하면 멈추고 결과를 보고한다. Tier C(T052–T064)는 하지 않는다.
```

4명이 나눠 작업할 때는 Phase 2(Foundation)의 T008·T009·T010을 한 사람이 먼저 `devlop`에서 끝내 검증한 뒤 `main`에 병합하고, plan.md의 분담(프론트·API/DB/인증·AI/검증·시드/데모)대로 각자 Codex에 해당 작업 ID만 지시한다.
AWS 자격 증명·실제 `.env`·실제 배포 설정은 Git에 포함하지 않는다.
브라우저의 `VITE_*` 변수에는 공개 가능한 식별자만 넣는다.
데모에는 가상 환자·음성·문서만 사용한다.
