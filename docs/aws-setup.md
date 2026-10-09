# 로컬 구성의 AWS AI 준비

**실시일**: 2026-10-09(KST). 최초 AWS 준비 당시 대상 커밋은 `7f9e3b2`였다. 후속 요청으로 최신 명세 `0fe3573`까지 pull하고 아래 재점검을 수행했다.

사용자는 로컬 구성을 유지하면서 데이터가 선행되어야 하는 리소스를 제외하고 AWS AI에 필요한 자원을 준비하도록 요청했다.
서버·DB·인증은 Fastify·SQLite·시드 JWT의 로컬 구성을 유지한다.

## 준비와 검증

| 대상 | 결과 | 검증 범위 |
|---|---|---|
| Transcribe 전용 S3 버킷 | 서울 `ap-northeast-2`에 생성 | 리전·공개 차단·암호화·소유권·수명 주기·정책·태그를 API로 다시 조회 |
| S3 공개 접근 | Block Public Access 설정 4개 모두 활성화 | ACL 비활성화, BucketOwnerEnforced |
| S3 저장 데이터 | SSE-S3 / AES256 | 앱의 영구 저장소는 로컬 유지 |
| S3 전송·삭제 | 비서비스 주체의 HTTP 거부, 1일 만료, 미완료 multipart도 1일 후 중단 | 실제 수명 주기 삭제는 비동기이며 정확히 24시간 내 삭제를 보장하지 않음 |
| Bedrock Sonnet 5 | 최초 사용 양식 제출·모델 접근 agreement 생성 완료 | 서울 `anthropic.claude-sonnet-5`의 agreement / entitlement / region은 AVAILABLE, authorization은 AUTHORIZED |
| Bedrock 실제 추론 | **사용 불가** | 최소 Converse 호출에서 AccessDeniedException. 이 계정에서 사용할 수 없으며 추가 접근은 AWS Sales에 문의하라는 응답 |
| Transcribe API | 조회 성공 | ListVocabularies·ListTranscriptionJobs 성공. 음성 전사는 미실시 |

AWS MCP OAuth 인증으로 준비·검증을 수행했다. 로컬 앱의 AWS SDK 인증은 별도로 필요하며 아직 검증하지 않았다.
기존 IAM 사용자의 권한을 사용했고 새 액세스 키나 IAM 사용자는 만들지 않았다.

## 로컬 설정과 실제 값

Git에서 제외한 `apps/api/.env`에 `AWS_REGION`·`BEDROCK_MODEL_ID`·`TRANSCRIBE_STAGING_BUCKET`을 기록했다.
계정·버킷 이름·검증 결과는 같은 방식으로 제외한 `infra/local-ai.outputs.json`에 기록했다.
공유할 변수명 예시는 `apps/api/.env.example`을 사용한다.
버킷은 임시 처리 전용이다. 앱은 결과 회수 후 임시 입력·결과를 삭제하고, 수명 주기는 누락된 임시 자료를 정리하는 보조 장치로 사용한다.

## 데이터 준비 후 작업

- Transcribe `ko-KR` 커스텀 어휘: 최초에는 데이터 준비 후 대상으로 분류했으나 최신 명세에서 생성 대상 제외로 확정.
- Transcribe 전사 작업: 가상 음성 입력이 필요해 미생성.
- AI 결과·시드 데이터: 로컬 구현에서 처리한다. 실제 모델 사용 제한이 해소되지 않으면 검증된 fixture임을 표시한다.

Guardrails는 현재 설계에서 채택하지 않고 프롬프트·서버 후처리를 사용한다.
데이터 없이 생성할 로컬 구성의 AWS 저장소는 준비됐지만, Sonnet 5의 실제 추론에는 AWS 측 추가 접근이 필요한 상태다.

## 공식 자료

- [Bedrock 모델 접근과 계정별 추가 접근](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- [GetFoundationModelAvailability](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_GetFoundationModelAvailability.html)
- [Transcribe 입력과 출력](https://docs.aws.amazon.com/transcribe/latest/dg/how-input.html)

## 최신 명세 재점검 — `0fe3573`

원격 커밋 2개를 fast-forward로 반영했다. 최신 AGENTS.md는 AWS 자원 신규 생성·IAM 변경 없이 기존 staging 버킷과 Bedrock·Transcribe를 사용하도록 지시한다.
앞선 사용자 승인으로 생성된 임시 버킷을 기존 staging 자원으로 재사용하며 이번 재점검에서 생성한 AWS 자원은 0개다.
커스텀 어휘는 최신 명세에서 생성 대상에서 제외됐다.

- S3: 서울 리전 확인, Block Public Access 4개 모두 활성화, GetBucketPolicyStatus의 IsPublic=false 확인.
- Transcribe: ListTranscriptionJobs 조회 성공. 실제 음성이 없어 전사 작업은 미실시.
- Bedrock: 모델 ID는 계속 `anthropic.claude-sonnet-5`. 접근 상태 조회는 AVAILABLE/AUTHORIZED지만 temperature=0·save_blocks 도구를 포함한 최소 Converse 확인도 계정 제한으로 실패했다. tool-use 지원 성공은 주장하지 않는다.
- 로컬 `.env`: 최신 `.env.example`의 변수 목록으로 맞추고 LLM_MODE=fixture·STT_MODE=fixture·LIVE_FALLBACK_TO_FIXTURE=true를 적용했다. 기존 AWS 자원 값은 유지하고 비어 있던 JWT_SECRET은 로컬에서 무작위 생성했다.
- 최신 spec·plan·tasks·계약과 공유 `.env.example`은 원격 내용 그대로 유지했다. 이전 AWS 준비 때 수정한 명세 문구는 재적용하지 않았다.

이는 AWS 환경 재점검과 로컬 설정 반영 결과다. 앱·provider·검증기 구현 및 두 경로 시연은 미수행이며 T007을 포함한 구현 작업 완료 체크도 하지 않았다.
