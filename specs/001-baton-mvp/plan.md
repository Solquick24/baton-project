# Implementation Plan: 바통 진료 인수인계 MVP

**Branch**: `main` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: `specs/001-baton-mvp/spec.md`; [최종 기획안](../../docs/baton_planning_최종.md); [팀 제공 UI PDF](../../docs/references/baton-ui-wireframe-selection.pdf)·[반영 기록](../../docs/wireframe-integration.md)

## Summary

로컬 서버·SQLite·시드 로그인에 AI만 AWS를 사용하는 모바일 웹 MVP다.
사용자는 정리 결과 확인 후 공유하기로 확정한다. 배포·AWS 서버리스 자원 생성은 하지 않는다.
AI 생성은 schedule/companion/full의 비중복 블록을 한 번에 저장한다.
서버는 현행 구성원·scope로 허용 블록만 조회·조립하고 읽기·범위 변경에 AI를 호출하지 않는다.
이번 작업은 문서 개정·작업 목록 생성·와이어프레임 반영이며 앱·DB·테스트·AI 호출은 아직 미구현이다.

## UI 와이어프레임 적용 계획

팀 제공 PDF 25쪽을 화면 번호·경로와 연결했다. 배치·모양은 PDF, 기능·권한·필드는 spec.md·schemas.md·screens.md의 현행 계약을 따른다. PDF에 없는 설정·범위 관리도 MVP 필수 기능으로 유지한다. 세부 연결표와 원본 해시는 docs/wireframe-integration.md에 있다.

| 순서 | 기존 작업 | 반영할 내용 | 확인 기준 |
|---|---|---|---|
| 공통 기반 | T002, T048 | 한 열 모바일 레이아웃·뒤로가기·3개 탭·카드/칩/버튼/상태 토큰. T048 토큰을 이용할 공통 구조를 T002에서 준비 | 모든 화면 가상 배지·48px 터치·내용 길이에 따른 높이 |
| 로그인·홈 | T026 | PDF 1·3·4·5쪽. 청록 다음 진료 카드·범위에 따른 확인/질문 카드·빈 상태 | A는 확인 1건, B는 질문, C는 일정만. PDF 데이터 대신 현행 시드 |
| 질문·브리핑 | T027, T028 | PDF 9·10쪽. AI 통합 패널·변경 다음 질문·full 펼치기·하단 기록 버튼 | B의 보통 글씨 390×844 첫 화면에서 변경·질문 3개, 근거 버튼 없음 |
| 범위·타임라인 | T033, T034 | PDF 21·23·24쪽. 점·세로 선·최신 공유 카드, PDF 밖 범위 관리 유지 | 단일 진료과·공유본·허용 블록만. 23-1 쉬운 요약은 카드 안 펼치기 |
| 기록·검토·불일치 | T045, T046 | PDF 15·18·19쪽. 업로드 상태로 대체·노란 확인 카드·full 근거 비교·명시적 공유 | ready/blocked/failed/stale 구분, 공유 성공 전 가족 공개·성공 배너 없음 |
| 접근성·병원 | T048, T049, T050 | PDF 색감·카드에 고대비/글씨 설정 적용, PDF 11·12쪽의 정적 안내 | 최대 글씨에서 잘림 없음, 시드의 5단계·여러 층 정적 약도 |
| 통합 검증 | T029, T036, T047, T051 | PDF 배치 검증을 기존 권한·공유·접근성 시나리오에 포함 | 내용·버튼·키보드·하단 safe area 겹침 없음, API 권한 검사 유지 |

공통 토큰의 적용 완료는 기존 순서의 T048에서 검증한다. 그 전 화면 작업은 screens.md의 공통 배치를 사용하며 T048에서 전역 설정을 연결한다. 작업 ID·선행·Tier·완료 상태를 변경하지 않는다.

PDF 전체를 구현 범위로 확대하지 않는다. 직접 녹음·문서 판독·비공개 메모·흐름·별도 쉬운 요약은 기존 Tier C이며, 해외 번역·실시간 자막·PDF 문서 입력·복수 문서 처리·진료과 수정·태그 편집은 이번 핵심 계약에 추가하지 않는다. 선택 화면 01-1·06·07도 실제 동의·가족 연결·일정 저장으로 표시하지 않는다.

브라우저 구현 이후 390×844 보통 글씨로 핵심 배치를 확인하고 아주 큰 글씨·고대비로 같은 화면을 순회한다. 원본 긴 이미지 높이를 고정하지 않고 하단 고정 요소가 마지막 내용과 입력을 가리지 않는지 확인한다. 문서 반영 단계에서는 앱 실행·시각 일치·AI 호출 성공을 주장하지 않는다.

## Technical Context

**Language/Version**: TypeScript, Node 22.x (확인 환경 22.23.2), npm 10.x.

**Primary Dependencies**: React·Vite, Fastify 5, @fastify/jwt, better-sqlite3,
계약 검증 Zod, AWS SDK v3의 Bedrock Runtime·Transcribe·S3 클라이언트.
의존성은 AGENTS.md 6장의 고정 버전을 기준으로 구현 시작 시 설치·호환성을 확인하고 lockfile에 고정한다.

**Storage**: 로컬 SQLite와 비공개 로컬 업로드 폴더.
진료 메타데이터와 visit_blocks를 분리한다. DB 파일·업로드 폴더를 웹 정적 경로에 두지 않는다.
Transcribe 배치의 임시 S3 입력·결과 경로만 기존 제공 버킷을 사용하며 앱의 영구 저장은 로컬이다.

**Testing**: Vitest로 계약·권한·repository·AI 저장 검증,
Fastify inject로 HTTP 직접 호출, Playwright로 시드 E2E.
가짜 provider·spy로 GET와 범위 변경의 AI 호출 0회를 확인한다.

**Target Platform**: 로컬 브라우저 Vite + localhost Fastify API.
AWS는 Bedrock·Transcribe 호출에만 사용하고 서울 리전 in-region을 기본으로 한다.

**Project Type**: npm workspaces(web/api/contracts)의 로컬 웹앱; 별도 AI 서비스 없음.

**Performance Goals**: B의 30초 브리핑·두 시연 경로 2회 완주.
AI 생성·전사는 항상 202 + jobId로 시작하고 로컬 jobs 테이블·2초 폴링으로 처리한다. 종료 상태에서 폴링을 중단한다.

**Constraints**: 당일 약5시간·4명; 가상 자료만; no deployment;
민감 정보 혼입이면 공유 보류; 원문·인용은 full; GET·scope 변경 AI 호출 금지.

**Scale/Scope**: 환자+A(full, lead)+B(companion)+C(schedule) 4계정,
내과 이전 두 기록·예정 진료와 정형외과 비교 기록. 관찰은 시드 고정.

## Constitution Check

*GATE: 설계 전·후에 핵심 원칙을 유지하고 아래 사용자 승인 기술 예외를 기록했다.*

| 원칙·제약 | 대응 | 결과 |
|---|---|---|
| I. 인수인계·동일 과 | patientId·dept로 생성 입력 제한 | PASS |
| II. 근거·의료 판단 금지 | 내부 모든 항목 근거, 참조는 full에만 저장·응답 | PASS |
| III. 환자 통제·서버 검사 | 현재 관계→허용 kind 조회→화이트리스트 조립; 파일·작업에도 적용 | PASS |
| IV. 접근성·녹음 | 흰 배경 고대비·3단계 글씨, 직접 녹음의 허용·상태 검사 | PASS |
| V. 비동기·검증 데모 | 로컬 jobs 유지, live/fixture 모드 표시·공유 전 검증 | PASS |
| Cognito·Lambda·DynamoDB·S3 기본 방향 | 사용자 선택의 로컬 서버·SQLite·시드 인증 | 승인된 기술 예외 |

헌장은 v1.1.0(2026-10-09 개정: 근거 문서·해소된 TODO 반영)이다. 원래 기획안은 `docs/archive/`의 역사 자료이고 이번 계획의 최신 근거는 최종본이다.
예외는 이번 가상 데이터 로컬 해커톤 데모에 한정하고 실제 정보 처리·배포 검토 전에 재평가한다.
원문 근거 저장 요구는 full.sourceRefs로 유지하며 낮은 scope에서 근거를 숨기는 것을 근거 미저장으로 해석하지 않는다.

## Project Structure

### Documentation (this feature)

```text
specs/001-baton-mvp/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/api.md
├── contracts/schemas.md      # 2026-10-09 보완: 정확한 JSON 형태·검증기·작업 규칙
├── screens.md                # 2026-10-09 보완: 화면 번호·경로·범위별 표시·testid
├── seed-story.md             # 2026-10-09 보완: 시드 이야기·범위별 기대값·시연 순서
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

에이전트 진입 안내는 저장소 루트의 `AGENTS.md`다.

### Source Code (repository root)

```text
apps/web/src/{app,features,components,lib,styles,mocks}/
apps/api/src/
├── app.ts                    # Fastify 조립 (향후)
├── server.ts                 # 로컬 HTTP 시작 (향후)
├── handlers/                 # HTTP routes (기존 자리 재사용)
├── modules/                  # members·visits·questions·briefing·summaries·alerts·jobs
├── auth/                     # JWT 검증·환자 관계·역할·scope·행동 정책
├── adapters/                 # SQLite·로컬 files·Bedrock·Transcribe·fixture
├── ai/{prompts,pipelines,safety}/
├── workers/                  # 로컬 작업 runner
└── shared/                   # 설정·오류·로그
apps/api/tests/
packages/contracts/src/
fixtures/{seed,audio,documents,expected}/
scripts/
tests/e2e/
infra/                        # 이전 AWS 예시 보존; 현재 구현 대상 아님
```

**Structure Decision**: 기존 빈 폴더를 활용해 HTTP 진입점만 로컬 서버용으로 계획한다.
AWS adapters는 AI SDK에만 한정한다. DB·인증·파일 저장은 로컬 adapters로 교체한다.
아직 app.ts·server.ts·schema.sql 등 코드 파일은 만들지 않았다.

## Generation, Storage, Reading

1. 생성 경로는 서버 내부에서 같은 patientId·dept의 적법한 입력만 가져온다. 비공개 메모는 제외한다.
2. Bedrock tool input으로 블록 구조를 유도하되 계약·근거·금지 출력·문자열 혼입을 서버에서 검증한다.
3. 생성된 공통 메타와 세 kind 블록을 같은 version으로 트랜잭션 저장한다. 검증 실패 결과는 공유 후보가 아니다.
4. 조회는 JWT의 userId로 현재 membership을 조회한 뒤 scope→kind 허용표로 SQL을 실행한다.
5. questions·briefing은 검증 ready 결과를 허용 범위에 바로 제공한다. record의 가족 조회는 recordPublishedVersion, 작성자·관리자 검토는 recordDraftVersion의 자기 허용 블록을 선택한다. 진료 전 blocked 결과의 full 전용 열람은 schemas.md 3장을 따른다.
6. POST share는 record의 입력 버전·검증 상태·공유 권한을 다시 검사하고 recordPublishedVersion·sharelog를 원자적으로 저장한다.
7. scope 변경은 membership·sharelog를 트랜잭션 변경한다. 프론트는 이전 환자 응답 캐시를 비우고 재조회한다.

일정만은 meta+schedule, 동행은 meta+schedule+companion, 전체 내용은 셋 모두다.
거부 블록은 통째로 가져와 삭제하지 않는다. full 자료를 동행용 AI 호출로 재요약하지 않는다.
원문 파일은 인증된 full 다운로드 경로에서만 반환한다.

## AI and Transcription

- LLMProvider/TranscriptionProvider를 adapters 뒤에 두고 fixture 결과도 동일 검증을 통과시킨다.
- Bedrock 후보 모델은 `anthropic.claude-sonnet-5`, 서울 in-region을 사용한다. 계정 접근·실제 호출은 별도 확인한다.
- tool use를 스키마 준수 보장으로 표현하지 않는다. 모델 카드의 Structured outputs 미지원에 따라
  tool input 존재·계약·근거 검증 후 최대 1회 재시도하고 계속 실패하면 failed/공유 보류한다.
- companion뿐 아니라 schedule·질문·오류·보조 응답에도 금지 full 값이 섞이는지 확인한다.
- 한국어 표현 변형·약 이름에서의 진단 추론은 문자열 검사만으로 막을 수 없으므로 모의 평가와 알려진 한계를 기록한다.
- Transcribe는 기존 제공 S3 버킷으로 가상 음성을 임시 staging하고 완료 결과를 로컬에 저장한다.
  버킷·권한이 없거나 호출이 실패하면 준비 전사본으로 전환해 fixture임을 표시한다. 새 AWS 인프라를 배포하지 않는다.

## Implementation Sequence

| 구간 | 우선순위·작업 | 검증 |
|---|---|---|
| Setup | 의존성·실제 실행 명령·설정·SQLite 준비 | web/api/contracts 타입 검사·빌드 |
| Foundation | 4계정·관계·JWT·블록 repository·jobs·공통 정책 | 금지 kind 미조회·위임 해제·비구성원 거부 |
| US1 | 질문·저장 브리핑·B 인수인계 | 변경·질문, 읽기 AI0회 |
| US2 | 범위 관리·공유 기록·동행/일정 화면 | 환자 변경→B/C 다음 조회, 일반 보호자403 |
| US3 | 음성·메모·정리·누출 검사·검토·공유·full불일치 | 보류 우회 불가, 환자/A로 원문 확인 |
| US4 | 접근성·정적 병원 | 가장 큰 글씨·흰 배경 고대비 |
| US5/US6 | 선택2단계·고지 화면(Tier C) | 핵심 완주 후 사람이 명시적으로 요청한 경우만 |
| Final | 두 경로 리허설·모의 평가 | 검사 전후 누출률·실제 분모 기록 |

4명 분담: 프론트(US1·US4), 로컬 API/DB/인증(Foundation·US2), AI/검증(US3), 시드/데모/평가.
2단계는 5시간 내 필수 완료 대상이 아니다. 최소 시연은 US1+US2와 US3의 파일 변환·정리·공유·비교다.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| AWS 기반 기본 방향을 로컬 서버·SQLite·JWT로 대체 | 사용자가 최종안 질문에서 직접 선택; 배포 없는 가상 데모에 한정 | Cognito·Lambda·DynamoDB 구성은 로컬 시연 준비 비용이 커 선택하지 않음 |

이 예외의 종료 시점은 가상 해커톤 데모 범위를 넘어 실제 서비스·배포를 설계할 때다.
보안·권한·근거·비공개 메모 원칙은 예외 대상이 아니다.
