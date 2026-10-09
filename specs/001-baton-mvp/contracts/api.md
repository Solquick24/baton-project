# API Contract: 로컬 서버·등급별 블록·검토 후 공유

아직 경로·스키마·handler는 구현하지 않았다. Fastify 로컬 API와 공유 Zod 계약을 계획한다.
**요청·응답 본문의 정확한 형태는 [schemas.md](schemas.md)가 기준이다.** 이 문서는 경로·권한 요약이다.

## Authentication and response rules

- 모든 경로는 `/api` 아래. Vite 개발 서버가 `/api`를 `http://localhost:3001`로 프록시한다.
- POST /api/auth/login은 시드 계정의 이메일·비밀번호를 확인하고 서명 JWT를 반환한다.
- 서버는 서명·만료·허용 알고리즘(HS256)·issuer(`baton-local`)/audience(`baton-web`)를 검증한다. JWT의 `sub`만 신뢰하고 role·scope·위임은 매 요청 DB에서 읽는다.
- 환자 API 앞에는 `/patients/{patientId}`, 예외는 `/auth`, `/me/patients`, `/jobs`, `/hospitals`.
- 오류 형식 `{ error: { code, reason?, message, requestId } }`. 401 인증, 403 권한(비구성원 포함), 404 없음 또는 허용 범위 밖, 400 입력, 409 버전 충돌·공유 보류, 502 외부 처리 오류, 500 내부 오류. 음성 제한은 413/415이며 같은 ErrorResponse를 사용한다.
- 오류·작업 응답에 원문·금지 블록·내부 경로·비밀 설정을 넣지 않는다.
- 모든 외부 응답은 공통 assembler를 거친다. 알 수 없는 블록·필드는 기본 거부.
- schedule 응답: meta + schedule. companion: meta + schedule + companion. full: 셋 모두.
- meta는 id/date/time/dept/hospital/companion/status만; 민감 내용·다른 가족 scope·거부 블록 개수·초안 존재는 없다.
- sourceRefs/basisRefs/quote/원본 파일/진단/수치/이유/답변/설명/전사/메모 원문/ALERT 상세는 full 전용.

## Routes (1단계)

| Method | Path | 입력 → 결과 | 행동 권한 |
|---|---|---|---|
| POST | /auth/login | email/password → accessToken, user | 시드 계정 |
| GET | /me/patients | self·linked 환자 목록 | 인증 |
| GET | /patients/{pid}/home?dept= | meta + 허용 블록 + 허용 개수 | 구성원(현행 scope) |
| GET | /patients/{pid}/timeline?dept= | 공유본의 meta + 허용 블록 | 구성원 |
| GET | /patients/{pid}/visits/{vid}?view= | published(기본) 또는 draft 검토본 | 구성원 / draft는 작성자·범위 관리자 |
| POST | /patients/{pid}/visits/{vid}/questions | text → id(혼입 시 visibility=full) | companion 이상 |
| GET | /patients/{pid}/visits/{vid}/questions | 원 질문 + 통합 결과(허용 블록) | companion 이상, schedule은 404 |
| POST | /patients/{pid}/visits/{vid}/questions/merge | inputVersion → 202 jobId | companion 이상 |
| POST | /patients/{pid}/visits/{vid}/briefing | questionsVersion → 202 jobId | companion 이상 |
| GET | /patients/{pid}/visits/{vid}/briefing | 허용 briefing 블록 + 통합 질문 | companion 이상, schedule은 404 |
| GET | /patients/{pid}/visits/{vid}/record-input | recordInputVersion, canUploadAudio | companion 이상, 그 외 404 |
| POST | /patients/{pid}/visits/{vid}/audio | multipart 가상 파일 → uploadId | companion 이상 + recordingAllowed |
| POST | /patients/{pid}/visits/{vid}/transcribe | uploadId → 202 jobId | companion 이상 |
| POST | /patients/{pid}/visits/{vid}/notes | text → noteId, recordInputVersion | companion 이상 |
| POST | /patients/{pid}/visits/{vid}/structure | inputVersion → 202 jobId | companion 이상 |
| POST | /patients/{pid}/visits/{vid}/share | draftVersion, inputVersion, idempotencyKey → publishedVersion | 초안 작성자(현재 companion 이상) 또는 환자·위임 대표, state=ready |
| GET | /jobs/{jobId} | status/mode/resultVersion/resultState/errorCode | 요청자 본인 또는 그 환자의 full 구성원 |
| GET | /patients/{pid}/sources/{uploadId} | 원본 파일 스트림 | full; 환자·진료 소속 검사 |
| GET | /patients/{pid}/alerts | alerts, canResolve | full, 그 외 404 |
| POST | /patients/{pid}/alerts/{aid}/resolve | edit_note/reupload/confirm_hospital → 200 { alert } | 현재 full인 환자·대표 보호자 |
| GET | /patients/{pid}/members | 가족·scope | 환자·위임 대표 |
| PUT | /patients/{pid}/members/{uid}/scope | schedule/companion/full | 환자·위임 대표 |
| GET | /patients/{pid}/members/{uid}/share-log | 그 가족 대상 공유 시작·범위 변경 기록 | 환자·위임 대표 |
| GET | /patients/{pid}/share-log | 환자 전체 기록(공유 확정 포함) | 환자·위임 대표 |
| GET | /hospitals/{hid} | 가상 위치·약도·안내 순서·더미 경험 | 인증 |

POST /audio-url 대신 직접 업로드를 사용한다. cloud presigned URL은 API 계약에 없다.
AI 생성과 전사는 항상 202 + jobId로 시작한다. 재시도는 같은 요청을 다시 보내며 규칙은 schemas.md 6장.
작업 조회에는 원문이나 블록을 넣지 않는다. 생성 결과는 resultVersion으로 참조하고, 전사는 resultVersion/resultState=null이다. 전사 성공 후 record-input을 다시 조회한다.
share는 blocked·입력 버전 불일치·ready 아님에서 409로 거부하고 ready 검토본만 공개한다. 같은 초안 재공유는 200 + alreadyPublished.
source 다운로드는 작성자여도 companion이면 403이다.

## Generation and reading

생성 요청은 정해진 모든 블록을 만들고 서버에서 검증·저장한다. 반환은 호출자의 허용 블록만.
GET·scope 변경은 저장된 블록 선택만 하고 LLM/STT를 호출하지 않는다.
새 field는 full에 두고 화이트리스트 스키마에 정의 전까지 낮은 범위로 반환하지 않는다.
low 항목은 id/needsCheck, full의 sourceRefs[itemId]로 원본을 연결한다.
근거가 없으면 값 null·needsCheck=true. 프론트는 full 블록이 있을 때만 원문 버튼을 그린다.

## Review and published views

일반 가족 조회는 recordPublishedVersion, 검토는 작성자·범위 관리자의 recordDraftVersion을 사용한다.
질문 통합·브리핑은 공유 단계 없이 state=ready면 허용 범위로 바로 보인다(schemas.md 3장).
검토자가 companion이어도 full은 반환하지 않는다. 공유 전 companion 문장을 확인할 수 있다.
보안 검증은 사용자의 공유 확인과 독립적이며 저장 검증·현행 권한 검증을 버튼으로 우회할 수 없다.
단순 미해결 불일치는 확인 표시를 유지하며 공유할 수 있고 민감 혼입은 재생성·재검증 전 공유 불가다.

## Optional phase 2

DELETE /members/{uid} 공유 중단, POST /docs 직접 업로드, /docs/{did}/extract·PATCH 수정,
/private-notes 환자 전용, /doctor-view 환자 전용, PUT /settings 위임·녹음 설정,
/hospitals/{hid}/experiences 익명 입력, /flows 같은 과 흐름을 추가한다.
별도 easy-summary API는 없고 저장된 companion.easySummary를 화면 24에서 재사용한다.
동의·초대·가입·일정 등록은 화면만이므로 실제 동작 API를 추가하지 않는다.

## FE 연동 보완 계약

2026-10-09 이슈 #5의 보완은 schemas.md 8·8.1장에 반영했다. 실제 API·Zod 구현과 BE 담당자 리뷰는 별도다.

- record-input은 현재 입력 버전과 업로드 가능 여부만 반환한다. 일반 가족용 home·timeline에는 입력·초안 정보를 넣지 않는다.
- draft의 inputVersion·stale·state·shareable은 필수이며 published에는 키 자체가 없다. share는 검토한 초안 버전을 전송한다.
- blocked questions는 companion에게 merged를 생략하고, blocked briefing은 companion에게 404다. full에는 full 블록과 상태만 반환한다.
- alerts 응답의 canResolve와 resolve 권한은 현재 full인 환자·대표 보호자다. edit_note는 observation_vs_prescription에만 허용한다.
- 생성 작업은 입력 버전, 전사는 uploadId로 중복을 판단한다. 같은 성공 작업을 재사용해도 202다.
- home은 dept 생략 시 정렬된 depts의 첫 진료과를 사용하고 timeline은 dept 필수다. 미공유 record는 timeline에 없고 visit 상세에는 meta만 있다.
- 메모는 trim 후 1~2000자. 공유 멱등 키의 충돌·보존 규칙, 413/415/500 본문은 schemas.md를 따른다.

FE 호출 순서·파일 구조·오류 처리: [FE API 연동 기준](../../../docs/fe-api-contract.md).
