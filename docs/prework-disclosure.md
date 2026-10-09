# 바통 사전 작업과 가져온 자료 공개

바통은 기존 `baton-prework` 저장소의 기획·명세·설계 문서와 설정 뼈대를 새 대회 저장소 `baton-project`로 가져온다. 가져오기 기준에는 동작하는 앱·API·AI 기능이 없으며, 기능 구현과 검증은 이후 커밋으로 구분한다. 이 공개는 참가 가이드 3쪽의 사전 작업 구분 및 출처 유지 규정에 따른다.

## 가져오기 기준

- 기존 저장소: https://github.com/Solquick24/baton-prework
- 대회 저장소: https://github.com/Solquick24/baton-project
- 작성일: 2026-10-09 KST
- 가져오기 직전 HEAD: `9977eed9f61aeb5338f41559df8b2c1086841254`
- 행사 전 준비의 확인 가능한 마지막 커밋: `47429cf57fa16005c8abf98ac9482f48c8e8ed02`, 2026-10-09 05:36:35 KST

같은 날짜의 이른 시간 작업도 행사 시작 전 준비로 공개한다. 기존 레포에서 행사 당일 작성한 추가 설계 문서는 별도로 구분한다. 아래 시각은 로컬 Git 기록이며, 제출 마감 충족 여부는 GitHub의 main 반영 상태로 판단한다.

## 행사 전 준비

| 범위 | 파일 또는 경로 | 준비된 내용 |
|---|---|---|
| 제품 기획 | `docs/baton_planning_*.md`, `docs/planning-review.md` | 문제·사용자·진료 전중후 흐름·우선순위·범위 변경 검토 |
| 개발 원칙 | `.specify/memory/constitution.md` | 공개 범위·근거·검토 후 공유·가상 자료·완료 보고 기준 |
| 명세와 설계 | `specs/001-baton-mvp/` | 기능 명세, 연구, 계획, 데이터 모델, API 계약, quickstart, 요구사항 검토, 68개 미완료 구현 작업 |
| 아키텍처와 데모 계획 | `docs/architecture.md`, `docs/decisions.md`, `docs/demo.md` | 기술 방향·결정·시연 계획 |
| 프로젝트 설정 | 루트 및 workspace의 `package.json`, `package-lock.json`, `tsconfig*.json`, `.nvmrc`, `.gitignore` | npm workspace·TypeScript 설정·Node 버전·제외 규칙 |
| 폴더와 예시 | `apps/`, `packages/`, `fixtures/`, `scripts/`, `tests/`, `infra/` | README, 빈 `.gitkeep` 자리, `.env.example`, 이전 SAM 설정 예시 |
| Spec Kit 도구 | `.specify/`의 템플릿·스크립트·통합 설정, `.agents/skills/speckit-*` | 명세·계획·작업 생성 및 검토용 개발 도구 |

이전 AWS 배포 예시는 보존 자료이며 현재 배포 구현이 아니다. 현재 계획은 로컬 Fastify·SQLite·시드 로그인과 AWS AI 연동이다.

## 기존 레포에서 당일 추가한 문서

| 자료 | 가져오기 시점의 상태 |
|---|---|
| `docs/AI.md`, `docs/AI-workflow.md` | `9977eed` 커밋, 2026-10-09 10:15:27 KST. AI 처리 흐름과 향후 Agent 도입 기준을 설명한 설계 문서이며 기능 구현은 없음 |
| `docs/PRD.md` | 기존 작업 트리에 있던 제품 요구사항 문서. 가져오기 전에는 미커밋 상태 |
| `docs/references/track2-submission.md` | 기존 작업 트리에 있던 제출안 DOCX 본문 기록. 원본의 이전 범위와 현행 계획을 구분하는 참고 자료 |
| `README.md`의 PRD·제출안 링크 | 기존 작업 트리에 있던 문서 탐색 수정 |

이 공개 문서, 참가 규정 요약, 마이그레이션 절차는 저장소 이전 준비 과정에서 추가한다. 이들 역시 기능 구현 결과로 계산하지 않는다.

## 구현되지 않은 부분

가져오기 기준에 React 화면·라우팅, Fastify 서버·HTTP 핸들러, 공유 런타임 스키마, SQLite DB·시드 계정·인증·권한 처리는 구현되어 있지 않다. Bedrock·Transcribe 호출, AI 프롬프트·출력 검증·작업 실행, 음성·문서 업로드와 요약·브리핑·질문 통합도 구현되어 있지 않다.

`fixtures/`에는 README와 빈 자리만 있으며, 완성된 가상 음성·문서·시드·정답 데이터셋을 가져오지 않는다. 실행 가능한 E2E·평가 스크립트나 검증 결과, 배포된 앱·AWS 자원도 포함하지 않는다. `tasks.md`의 68개 구현 작업은 모두 미완료다. 사전 제출안에 적힌 준비 자료 목록은 계획 설명이며, 이 저장소에 실제로 존재하는 완성 자료 목록과 동일하지 않다.

## 출처와 활용 범위

| 출처 | 활용 범위 |
|---|---|
| 팀의 기존 바통 기획과 제출안 | 제품 기획·범위·데모 시나리오. 제출안 본문 기록의 원본 파일명과 SHA-256은 해당 문서 참조 |
| [GitHub Spec Kit](https://github.com/github/spec-kit) | `.specify/`와 `.agents/skills/speckit-*`의 명세 중심 개발 도구. `.specify/init-options.json`과 `integration.json`에 기록된 버전은 1.1.2이며 Codex 통합 설정을 사용 |
| `specs/001-baton-mvp/research.md`의 기술 문서 | 기술 선택과 API 설계 참고. 참고 링크와 결정 근거는 기존 문서에 유지 |
| [참가자 최종 안내](devday-guide.md) | 개발 규정·사전 작업 공개·마감·제출·발표 기준 |
| Codex | 기존 기획·명세·설계 및 이번 마이그레이션 문서 작업 보조. 세부 과정은 제출할 팀원별 Codex 로그로 보존 |

현재 npm 의존성은 내부 workspace 연결만 존재한다. 실제 구현 중 도입하는 외부 패키지·템플릿·데이터셋·모델은 이름·버전 또는 모델 ID·출처·활용 범위를 추가로 기록한다.

## 당일 구현과 제출 시 구분

가져온 커밋의 원래 해시와 순서를 보존하고, 새 기능·수정·검증은 이후 커밋으로 남긴다. 최종 제출 때 구현 기능과 검증 결과는 이 공개 문서 및 기준 커밋과 비교해 설명한다. 미완료·선택 제외·fixture 대체 결과도 표시한다.

발표 자료에 사용할 현재 공개문:

> 사전에는 바통의 기획·MVP 명세·데이터 모델·API 계약·개발 작업 목록과 폴더·설정 뼈대를 준비했습니다. 기존 레포에서 당일 추가한 PRD·제출안 기록·AI 설계 문서도 함께 가져왔습니다. 가져오기 시점에는 동작하는 앱·API·AI 기능이나 완성된 시드·음성·문서 데이터, 테스트·평가 결과가 없었습니다. 이후 구현·개선 내용과 검증 결과는 별도 커밋 및 Codex 기록으로 구분합니다.
