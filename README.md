# 바통(Baton) — 진료 동행 노트

가족이 번갈아 동행해도 진료 맥락이 끊기지 않도록 진료 전·중·후 기록을 이어주는 프로젝트다.

현재는 **Phase 1, 백엔드·공통 기반(T008–T019), Phase 3 백엔드(T021–T025), 프론트 첫 화면 흐름**이 구현된 상태다. 실제 API에서 환자 목록·홈·타임라인·진료 조회·질문 등록/통합·브리핑 생성/조회를 제공하며, T010의 `--pregenerate`는 실제 fixture provider와 같은 생성·검증·저장 파이프라인을 사용한다. 프론트 화면 시연은 기존 개발용 응답을 사용한다. T020·T026–T029 실제 API 통합 검증과 후속 진료 정리·공유는 미완료이므로 Phase 2·3 전체 완료가 아니다. 이번 구현은 fixture로 검증했으며 AWS 자원 생성·IAM 변경·배포를 하지 않았다. 앞선 Bedrock 접근 실패는 [AWS 준비 기록](docs/aws-setup.md)에 정리했다.

- [Phase 1 체크포인트와 실제 검증 결과](docs/phase1-checkpoint.md)
- [백엔드 기반 체크포인트와 T020 인수인계](docs/backend-foundation-checkpoint.md)
- [Phase 3 백엔드 체크포인트와 실제 API 인수인계](docs/phase3-backend-checkpoint.md)

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
- [팀 작업 방식: 이슈 → 작업 브랜치 → PR → devlop → main](docs/branch-workflow.md)
- [FE 리드의 프론트 구현 계획과 검사 결과](docs/frontend-plan.md)
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
apps/web/             모바일 우선 React/Vite 프론트 자리
apps/api/             로컬 Fastify·SQLite·JWT·AI·비동기 처리 자리
packages/contracts/   공유 요청·응답·검증 스키마 자리
infra/                이전 AWS 배포 예시 보존, 현재 구현 대상 제외
fixtures/             가상 시드·음성·문서·정답 자료 자리
scripts/              환경 점검·시드·평가 스크립트 자리
tests/e2e/            핵심 데모 검증 자리
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
브라우저의 /api 요청은 Vite가 로컬 API로 프록시한다. 실제 로그인·환자/진료 조회·질문/브리핑 API는 기본 시드 투입 후 사용할 수 있다. 기존 프론트의 실제 API 통합은 별도 검증이 남아 있으며 화면 시연에는 아래 개발용 모드를 사용할 수 있다.
기본 LLM/STT 모드는 fixture다. 기본 시연·테스트·빌드는 외부 AI를 호출하지 않는다. 사용자 결정으로 텍스트의 live 기본 provider는 OpenAI Responses(`LLM_PROVIDER=openai`)이며 Bedrock도 선택 가능하다. [설정·검증·남은 live 확인](docs/openai-provider-checkpoint.md)을 참고한다. 전사 provider는 변경하지 않는다.

```bash
npm run typecheck
npm run build
npm run test
npx playwright install chromium  # 최초 1회
npm run test:e2e
```

`npm run seed`는 설정된 로컬 DB의 기본 가상 시드를 트랜잭션으로 다시 만든다. 로그인 API를 쓰려면 먼저 실행한다.
`--pregenerate`는 실제 fixture 질문 통합·브리핑 파이프라인으로 저장 전 검증과 저장을 수행한다. 기본 DB를 보존할 검증에는 `--database /별도/임시경로/baton.sqlite`를 지정한다. OpenAI를 선택해도 사전 생성은 fixture다.
`npm run check:ai`는 별도 수동 실행 명령이며 Bedrock 연결 확인 호출 1회와 Transcribe 목록·기존 S3 버킷 접근을 검사한다. 검사 실패는 종료 코드 1로 보고한다.
최종 구성은 로컬 서버·SQLite·시드 로그인, 텍스트 OpenAI/Bedrock 선택과 기존 전사 provider다. 이전 'AI만 AWS' 방향의 변경 근거는 이번 사용자 결정이며 docs/decisions.md에 기록했다. 배포는 하지 않는다.
정리 결과는 검토 후 공유하기로 확정하며 원문·인용은 full에만 제공한다.

### 프론트 화면 시연

```bash
npm run dev:preview
```

http://127.0.0.1:5173에서 가상 계정을 선택해 로그인한다. 개발용 응답은 Vite 서버 preview 모드에서만 제공하며 AWS를 호출하지 않는다. 서버 재시작 시 가상 로그인·변경 내용은 초기화된다.

```bash
npm run typecheck:web
npm run build:web
npx playwright install chromium
npm run test:web
```

실제 API 프록시만 실행하려면 `npm run dev:web`를 사용한다. 웹 빌드와 실제 API 모드에는 개발용 응답·빠른 계정 로그인을 제공하지 않는다. 세부 범위와 제한은 [web 안내](apps/web/README.md)를 따른다.

## 다음 구현 단계

백엔드 기반 체크포인트에서 멈춘 상태다. 프론트 T020은 별도 담당이며 T010의 pregenerate는 T023·T024 구현 뒤 연결해야 한다. Phase 2 전체 완료는 아니다.
Tier A(T001–T049)를 먼저 수행하고 Tier B와 마지막 결과 기록을 이어간다.
선택 2단계·화면만인 Tier C(T052–T064)는 사람이 명시적으로 요청할 때만 진행한다.
새 checkout에서는 다음 값을 지정해 Spec Kit가 main에서도 feature를 찾게 한다.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/001-baton-mvp
```

`.specify/feature.json`은 checkout별 로컬 포인터여서 공유하지 않는다.

### Codex로 구현 시작하기

프론트는 `apps/web`, 백엔드는 `apps/api`에서 Codex를 열어 작업한다. 공통 계약·루트 설정·여러 앱의 통합 작업은 저장소 루트에서 시작한다.

| 시작 위치 | 적용할 지침 |
|---|---|
| `apps/web` | [공통 AGENTS.md](AGENTS.md) + [프론트 AGENTS.md](apps/web/AGENTS.md) |
| `apps/api` | [공통 AGENTS.md](AGENTS.md) + [백엔드 AGENTS.md](apps/api/AGENTS.md) |
| 저장소 루트 | [공통 AGENTS.md](AGENTS.md) + 변경하는 앱의 지침 |

CLI를 사용한다면 저장소 루트에서 `codex --cd apps/web` 또는 `codex --cd apps/api`로 시작할 수 있다. IDE에서는 해당 앱 폴더를 작업 폴더로 열어 시작한다.
하위 폴더에서 시작해도 공통 지침을 함께 따른다. 작업 범위·고정 버전·절대 규칙·이슈/브랜치 절차는 루트에, 담당 범위·UI/API 기준·검증 명령은 앱별 파일에 있다.
앱 폴더에서 공통 명령은 `npm --prefix ../.. run typecheck`처럼 실행한다. 앱별 `npm run dev`는 해당 앱만 실행하며 루트 `npm run dev`는 API·웹을 함께 실행한다. 시작 폴더와 관계없이 공통 파일 변경은 한 작업자씩 통합한다.

`$speckit-implement`는 기본값이 "tasks.md 전부"라서, 범위를 같이 넘긴다. 예:

```
$speckit-implement AGENTS.md 4장의 Tier A만 수행한다. Phase 1(Setup)부터 순서대로 하고, 각 Phase 체크포인트를 통과하면 멈추고 결과를 보고한다. Tier C(T052–T064)는 하지 않는다.
```

4명이 나눠 작업할 때는 Phase 2(Foundation)의 T008·T009·T010을 한 사람이 이슈별 브랜치에서 끝내 검증한 뒤 PR로 `devlop`에 통합한다. 각자 plan.md의 분담에 따라 해당 작업을 진행하고 `main` 반영은 통합 검증 후 별도 PR로 한다.
AWS 자격 증명·실제 `.env`·실제 배포 설정은 Git에 포함하지 않는다.
브라우저의 `VITE_*` 변수에는 공개 가능한 식별자만 넣는다.
데모에는 가상 환자·음성·문서만 사용한다.
