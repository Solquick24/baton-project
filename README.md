# 바통(Baton) — 진료 동행 노트

가족이 번갈아 동행해도 진료 맥락이 끊기지 않도록 진료 전·중·후 기록을 이어주는 프로젝트다.

현재는 **기획·명세·설계·설정 뼈대** 단계다. 앱·API·AI 기능·테스트·AWS 자원은 아직 구현하지 않았다.

## 문서

- [대회 참가 규정과 제출 참고사항](docs/devday-guide.md)
- [사전 작업과 가져온 자료 공개](docs/prework-disclosure.md)
- [대회 저장소 마이그레이션 기록](docs/repository-migration.md)
- [프로젝트 헌장](.specify/memory/constitution.md)
- [제품 요구사항 문서(PRD)](docs/PRD.md)
- [Track 2 제출안 본문 기록](docs/references/track2-submission.md)
- [최종 기획안](docs/baton_planning_최종.md) · [변경 검토](docs/planning-review.md)
- [이전 기획안](docs/baton_planning_2026-10-09_04-15-10_KST.md)
- [MVP 명세](specs/001-baton-mvp/spec.md)
- [구현 계획](specs/001-baton-mvp/plan.md)
- [구현 작업 목록](specs/001-baton-mvp/tasks.md)
- [설계 조사](specs/001-baton-mvp/research.md)
- [데이터 모델](specs/001-baton-mvp/data-model.md)
- [API 계약](specs/001-baton-mvp/contracts/api.md)
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

## 뼈대 준비

Node.js 22.12+ / 22.x, npm 10.x를 사용한다. 현재는 외부 런타임 의존성이 없다.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm ls --workspaces --depth=0
```

이 명령은 로컬 workspace를 연결할 뿐 앱을 실행하지 않는다.
React·TypeScript·Vite·AWS SDK·테스트 도구와 실제 dev/build/test 명령은 기능 구현 때 추가한다.
최종 구성은 로컬 서버·SQLite·시드 로그인, AI만 AWS 사용이다. 배포는 하지 않는다.
정리 결과는 검토 후 공유하기로 확정하며 원문·인용은 full에만 제공한다.

## 다음 구현 단계

생성한 `tasks.md`의 Setup/Foundation부터 해커톤 당일 구현한다.
1단계 두 시연 경로를 완주한 뒤 선택2단계를 추가한다.
새 checkout에서는 다음 값을 지정해 Spec Kit가 main에서도 feature를 찾게 한다.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/001-baton-mvp
```

`.specify/feature.json`은 checkout별 로컬 포인터여서 공유하지 않는다.
AWS 자격 증명·실제 `.env`·실제 배포 설정은 Git에 포함하지 않는다.
브라우저의 `VITE_*` 변수에는 공개 가능한 식별자만 넣는다.
데모에는 가상 환자·음성·문서만 사용한다.
