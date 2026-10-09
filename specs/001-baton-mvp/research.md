# Research: 최종 기획안 반영

**Date**: 2026-10-09. 문서·공식 자료 조사이며 AWS 호출·설치·배포는 하지 않았다.

## 로컬 인프라

- **Decision**: TypeScript Fastify 5, SQLite better-sqlite3, @fastify/jwt, React/Vite.
- **Rationale**: 사용자가 로컬 서버·SQLite·시드 로그인과 AWS AI를 선택했다. 기존 모듈 구조를 유지하고 HTTP·DB·인증을 로컬로 바꾼다.
- **Alternatives considered**: AWS 서버리스는 이번 범위 제외. node:sqlite는 현재22.23.2에 있지만 experimental이므로 우선 선택하지 않는다. better-sqlite3 설치·네이티브 바인딩은 Setup에서 확인한다.
- **Sources**: [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [JWT plugin](https://github.com/fastify/fastify-jwt), [Node SQLite](https://nodejs.org/download/release/v22.23.2/docs/api/sqlite.html).

## 저장 블록과 권한

- **Decision**: meta와 block_sets(patientId,visitId,section,version)·visit_blocks(blockSetId,kind,payload)를 분리한다. section은 questions/briefing/record다. scope는 schedule/companion/full, kind도 같은 세 값이다. 정확한 구조는 data-model.md·contracts/schemas.md를 따른다.
- **Rationale**: 명시적 허용 kind 조회·화이트리스트 응답을 한 곳에 둔다. 원문·인용·근거는 full에만 있고 새 필드도 full 기본이다.
- **Alternatives considered**: 전체 레코드를 읽고 필드를 제거하면 누락 가능성이 크다. DynamoDB ProjectionExpression도 물리적 격리·DB 자체 사용자 권한으로 볼 수 없다.
- **Source**: 최종 기획안8.2·8.3; [DynamoDB projection](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ProjectionExpressions.html).

## 공유 시점과 시드

- **Decision**: 진료 후 record는 사용자 검토 후 POST share, 진료 전 questions·briefing은 검증 ready 시 허용 범위로 바로 제공한다(후자는 팀 검토 전 보완 기본안). 가족 시드 4계정과 테스트 비구성원 1계정, 관찰 메모 시드, B는 companion으로 이어받고 불일치 상세는 환자/A가 확인.
- **Rationale**: 사용자가 수동 확정을 선택했고 final의 원문 full 제한을 두 시연 경로에서 유지한다.
- **Alternatives considered**: 기존 자동 공유·B의 안전한 인용 제공은 이번 선택과 충돌해 제거한다.
- **Source**: 사용자 답변, 최종 기획안12.1·12.2·12.13.

## AWS AI·모델

- **Decision**: Bedrock Converse tool input 유도 + 서버 Zod·근거·혼입 검증, 실패 시 최대1회 재시도. 기본 Guardrails 교차 리전은 사용하지 않는다.
- **Rationale**: Sonnet5는 Converse와 서울 in-region 후보지만 모델 카드상 Structured outputs는 미지원이므로 스키마 강제를 보장으로 쓰지 않는다.
- **Alternatives considered**: Anthropic 직접 호출은 사용자가 AWS AI를 선택해 제외. 교차 리전 Guardrails는 정책 변경 없이 켜지 않는다.
- **Sources**: [AWS Sonnet5 모델 카드](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5.html), [서울 in-region 발표](https://aws.amazon.com/blogs/machine-learning/introducing-anthropic-models-on-amazon-bedrock-for-in-region-inference-in-seoul-and-singapore/).
- **Still to verify operationally**: 실제 계정 접근·쿼터·샘플 호출; 검증된 저장 결과 fallback을 마련한다.

## STT·로컬 작업

- **Decision**: Transcribe의 기존 버킷 staging → 로컬 전사 저장. 로컬 jobs 상태·폴링을 유지한다.
- **Rationale**: 앱 저장·인증은 로컬로 하고 AWS는 AI 처리용으로 제한한다. staging은 배치 STT의 부속 연결이며 새 버킷 배포는 하지 않는다.
- **Alternatives considered**: 클라우드 큐·Lambda는 제외. 전사본만 쓰는 시연은 fixture로 명확히 표시하고 실제 변환 성공으로 보고하지 않는다.
- **Source**: 최종 기획안10.4; 실제 Transcribe 버킷 접근은 환경 점검 작업이다.

## 미정 세부 항목의 보수적 기본안

- **Decision**: 동행 watch/prep/alerts/OBS 상세는 full 유지, 약 이름은 기존 허용 유지, 글씨·대비는 브라우저 저장.
- **Rationale**: 새 항목은 full 기본이며 미정 범위를 임의로 확대하지 않는다. 약 이름의 추론 한계는 데모에 기록한다.
- **Alternatives considered**: 동행의 모든 의료 문자열을 임의로 재요약하는 조회는 금지한다.
- **Dependencies**: 지도 제공자 실제 SDK는 가상 위치 표시 기본 후 확인. 실정보 동의·법률은 이번 가상 데모 범위 밖.
