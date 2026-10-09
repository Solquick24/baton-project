# 바통 FE API 연동 기준

실제 구현 상태(2026-10-09): T021–T025의 질문·브리핑·환자/진료 조회에 더해 full 불일치 목록·처리 API를 fixture 모드에서 검증했다. 기존 경로는 [Phase 3 체크포인트](phase3-backend-checkpoint.md), 새 alerts 경로와 미구현 정리/공유 경로·선행 의존성은 [Phase 5 독립 백엔드 체크포인트](phase5-backend-checkpoint.md)를 따른다. 아래 계획 당시 준비 수준과 구분한다. T020·T026–T029·T045–T047 실제 화면 통합 및 Phase 5 전체는 미완료다.

FE 리드와 BE 담당자가 화면 구현 전에 사용할 요청·응답과 예외 처리 기준이다. 사용자 진행 요청에 따라 입력 버전 조회·행동 권한·보류 결과·HTTP 예외를 API 계약에 반영했다(이슈 #5). Phase 1의 health handler·공유 health 스키마는 있으나 진료 API handler와 공유 진료 계약은 아직 없으며 실제 BE 담당자의 리뷰는 별도로 필요하다.

기존 기준은 [API 경로와 권한](../specs/001-baton-mvp/contracts/api.md), [정확한 본문 스키마](../specs/001-baton-mvp/contracts/schemas.md), [화면 정의](../specs/001-baton-mvp/screens.md)다. 아래 호출 규칙과 보완 계약은 그 내용을 FE 관점으로 연결한다. 파일 구조는 FE 구현 제안이며 외부 응답의 기준은 schemas.md다. 이번 범위는 Tier A와 병원 안내 Tier B다.

## 현재 명세의 준비 수준

| 항목 | 현재 상태 | FE에 미치는 영향 |
|---|---|---|
| API 경로·인증·행동 권한 | 1단계 25개 경로 정의 | 화면별 호출을 나눌 수 있음 |
| 블록·주요 요청·응답 타입 | schemas.md에 TypeScript 형태로 정의 | 타입과 mock의 기준으로 사용 가능 |
| 작업 상태·재시도·공유 | 작업 폴링, 버전 충돌, 명시적 공유 정의 | 처리 중·실패·공유 전후 UI 설계 가능 |
| 입력 버전 읽기 | record-input과 draft.inputVersion·stale 반영 | 전사 후 조회, 검토본과 현재 입력의 충돌 확인 |
| 화면 행동 권한 | canManageScopes·shareable·canUploadAudio·canResolve 정의 | 서버 응답으로 관리·공유·업로드·불일치 처리 버튼 제어 |
| HTTP 성공·오류 계약 | 200·201·202와 413·415·500 본문 반영 | 공통 클라이언트와 mock 구현 기준 |
| 실행 가능한 진료 계약 | health만 구현, 진료 Zod·OpenAPI·handler 없음 | 문서 기준으로 분리 작업 가능, 실서버 연동 검증은 아직 불가 |

schemas.md 자체도 팀 검토 전 기본안이다. 경로가 있다는 이유로 구현 완료 또는 팀 합의 완료로 취급하지 않는다.

## 현행 계약의 공통 호출 규칙

FE는 상대 경로 `/api`로 호출한다. 로컬 개발에서 Vite가 API 서버 `:3001`로 프록시한다. 로그인 외 요청에 로그인 응답의 토큰을 `Authorization: Bearer <accessToken>`으로 보낸다. JWT에서 범위·위임을 추출하거나 FE에서 권한의 최종 판단을 하지 않는다.

성공 본문은 각 API의 정의를 그대로 사용한다. `{ data: ... }` 포장을 추가하지 않는다. JSON 요청은 `Content-Type: application/json`, 음성은 `FormData`의 `file` 필드로 보내며 multipart 헤더의 boundary는 브라우저가 설정하게 한다. 원본 파일 응답은 JSON 대신 파일 스트림이다.

오류 본문은 다음 형태다. FE 분기는 `message` 문자열이 아니라 HTTP 상태와 `code`·`reason`으로 한다.

```ts
type ErrorResponse = {
  error: {
    code: 'unauthorized' | 'forbidden' | 'not_found'
      | 'bad_request' | 'conflict' | 'upstream_error' | 'internal_error';
    reason?: 'stale_input' | 'blocked' | 'not_ready'
      | 'not_author' | 'recording_not_allowed' | 'idempotency_conflict'
      | 'file_too_large' | 'unsupported_media_type' | 'unsupported_action';
    message: string;
    requestId: string;
  };
};
```

| HTTP | 현행 의미 | FE 처리 방안 |
|---|---|---|
| 400 | 잘못된 입력 | 입력을 유지하고 짧은 안내 표시 |
| 401 | 인증 실패·만료 | 로그인 요청이면 폼 오류, 그 외 토큰·환자 캐시 제거 후 로그인 이동 |
| 403 | 행동 권한 없음·비구성원 | 해당 행동 중단, 이전 상세 데이터 제거 |
| 404 | 없음 또는 허용 범위 밖 | 존재 여부나 숨긴 항목 수를 추정하지 않고 빈 상태 처리 |
| 409 stale_input | 입력 버전 불일치 | 최신 입력 조회 후 재정리 안내. 공유를 자동 재시도하지 않음 |
| 409 blocked | 공개할 수 없는 출력 | 공유 중단, 재정리 안내 |
| 409 not_ready | 선행 결과 또는 검토본 준비 안 됨 | 필요한 선행 단계 안내 |
| 413·415 | 파일 크기·MIME 제한 | 파일 재선택 안내 |
| 500·502 | 내부·외부 처리 오류 | 실패 표시와 재시도 제공 |

`Job.errorCode`는 비동기 작업 실패용 별도 값이다. HTTP 오류 코드와 합치지 않는다.

## 화면별 API 연결

아래 경로는 `/api` 이후다. `P=/patients/{pid}`, `V=P/visits/{vid}`로 줄여 썼다. 화면 번호는 PDF 쪽 번호가 아니라 screens.md의 번호다.

| 화면 | 첫 조회 | 사용자 행동 | 완료 후 조회 |
|---|---|---|---|
| 01 로그인 | 없음 | POST /auth/login | GET /me/patients → 선택 환자 home |
| 02·04 홈 | GET P/home?dept=내과 | 환자·진료과 선택 | 새 pid·dept의 home |
| 03 내 기록 빈 화면 | GET /me/patients의 self | 준비 중 버튼 | 저장 API 없음 |
| 08 가족 질문 | GET V/questions | POST V/questions, POST V/questions/merge | jobs 성공 후 GET V/questions |
| 09 브리핑 | GET V/briefing | POST V/briefing | jobs 성공 후 GET V/briefing |
| 15 진료 기록 | GET V/record-input, GET V/briefing으로 질문 표시 | POST V/audio → transcribe, POST V/notes → structure | 작업 조회 후 draft 검토 |
| 18 검토·공유 | GET V?view=draft | POST V/share | GET V?view=published, home·timeline 새로 조회 |
| 19 정보 바로잡기 | GET P/alerts에서 aid 선택 | POST P/alerts/{aid}/resolve | GET P/alerts, home |
| 21·23·23-1 타임라인 | GET P/timeline?dept=내과 | 진료과 선택·기록 상세 | GET V?view=published |
| 25 설정 | 관리 가능 시 GET P/members | 접근성 변경은 localStorage, 로그아웃은 FE 상태 제거 | 로그아웃 시 캐시 제거 |
| 25-2 공개 범위 | GET P/members, GET P/members/{uid}/share-log | PUT P/members/{uid}/scope | members·해당 share-log 새로 조회 |
| 10·11 병원 안내 | GET /hospitals/{hid} | 정적 지도·약도 탭 | 추가 API 없음 |

설정의 범위 관리 진입은 `HomeRes.me.canManageScopes`를 참고하고, 실제 members 요청 권한은 서버가 확인한다. 병원 안내는 Tier B 작업이며 2단계 문서 업로드·직접 녹음·비공개 메모 API는 이번 FE 연동에 넣지 않는다.

## 비동기 작업과 화면 상태

질문 통합·브리핑·전사·정리는 모두 `202 { jobId }`로 시작한다. FE는 2초 간격으로 `GET /api/jobs/{jobId}`를 호출하고 `succeeded` 또는 `failed`에서 멈춘다. 화면 이탈·로그아웃 시 폴링을 해제한다. 작업 조회 응답에는 블록 본문·전사 원문이 없다.

| Job 결과 | 의미 | 다음 행동 |
|---|---|---|
| queued·running | 처리 중 | 진행 안내, 같은 버튼의 중복 클릭 방지 |
| failed | 실패 | errorCode에 맞는 안내, 같은 요청 재전송으로 재시도 |
| succeeded + ready | 검증 통과 | 원래 결과 GET 경로로 다시 조회 |
| succeeded + blocked | 처리는 끝났지만 공개 보류 | 허용된 검토만 표시, 공유 성공으로 표시하지 않음 |
| transcribe succeeded | 전사 저장 완료 | 변환 완료 표시. resultVersion은 null이며 원문을 표시하지 않음 |

서버는 같은 입력의 queued·running·succeeded 작업을 재사용한다. 성공한 blocked 작업도 재사용 규칙에 들어가므로, 입력을 고치지 않은 채 같은 요청을 보내면 새로운 결과가 생긴다고 가정하지 않는다.

record 공유는 `draft.state=ready`와 `draft.shareable=true`를 확인한 뒤 사용자가 확정할 때만 요청한다. `Job.status=succeeded`만으로 공유하지 않는다. 일반적인 `needsCheck=true`는 공유 보류와 다르며, blocked를 공유 버튼으로 우회할 수 없다.

## 요청에 사용하는 버전

| 값 | 현행으로 읽을 수 있는 위치 | 보내는 요청 |
|---|---|---|
| questionsInputVersion | GET questions, POST questions 응답 | POST merge의 inputVersion |
| questionsVersion | GET questions의 merged.version | POST briefing의 questionsVersion |
| recordInputVersion | GET record-input, POST notes | POST structure의 inputVersion |
| draft.inputVersion | GET visit?view=draft의 record.inputVersion | POST share의 inputVersion |
| draftVersion | GET visit?view=draft의 record.version | POST share의 draftVersion |
| publishedVersion | POST share, published record.version | 공유본 표시·갱신 |

버전은 서버 값을 그대로 사용한다. 전사 완료 후 record-input을 다시 읽고 `+1`로 추정하지 않는다. 공유에는 검토한 draft.inputVersion을 보내며 현재 입력 버전으로 바꿔 보내지 않는다.

## FE 구조 제안

공유 요청·응답·오류·작업 스키마는 기존 계획대로 `packages/contracts/src/`에 둔다. FE 안에 같은 DTO를 다시 정의하지 않는다. 범위→블록 허용표는 API의 `block-policy.ts`에만 두고 FE는 받은 블록의 키로 표시를 정한다.

```text
packages/contracts/src/
  common.ts           공통 값과 오류
  blocks.ts           섹션별 블록과 근거 타입
  jobs.ts             작업 상태와 응답
  api.ts              요청과 외부 응답 스키마
  index.ts            공개 export
apps/web/src/
  api/client.ts       인증 헤더, JSON·파일 응답, 오류 변환
  api/auth.ts         로그인과 환자 목록
  api/visits.ts       홈·질문·브리핑·기록·공유
  api/jobs.ts         작업 조회
  api/sharing.ts      구성원·범위·로그
  api/alerts.ts       불일치 조회·처리
  api/hospitals.ts    정적 병원 안내
  hooks/useJob.ts     폴링 시작·종료·재시도
```

이는 파일 배치 제안이며 별도 상태 관리 라이브러리 도입을 전제하지 않는다. JSON 응답은 공유 Zod 스키마로 검증하고 파일 다운로드는 별도 함수로 처리한다. AbortSignal을 받아 진료과 변경·화면 이탈 시 오래된 요청이 화면을 덮지 않게 한다.

캐시를 두면 `userId + patientId + dept + visitId + view` 중 해당 조회에 필요한 값을 키에 포함한다. draft와 published를 같은 캐시로 쓰지 않는다. 계정 전환·로그아웃 때 이전 데이터와 진행 요청을 제거한다. 범위는 다른 세션에서 바뀔 수 있으므로 환자 화면 진입·브라우저 복귀 시 저장된 블록을 다시 조회하고 이전 상세를 먼저 비운다. 권한 검사와 GET에는 AI 호출이 없어야 한다.

## 반영한 FE 연동 보완 계약

### 현재 입력 버전과 업로드 가능 여부

`GET /api/patients/{pid}/visits/{vid}/record-input`은 현재 companion 이상에게 200을 반환하고 그 외는 404다.

```ts
type RecordInputRes = {
  recordInputVersion: number;
  canUploadAudio: boolean;
};
```

원문·업로드 목록·초안 포인터는 없다. 기록 진입, notes 저장, transcribe 성공, stale_input 이후 다시 조회한다. draft의 record에는 inputVersion·stale·state·shareable이 필수이고 published에는 해당 키가 없다. blocked draft는 companion 검토자에게 blocks={}와 안전한 상태만 전달한다.

### 불일치 조회와 수정

full 전용 GET alerts는 `{ alerts: Alert[], canResolve: boolean }`을 반환한다. canResolve는 현재 full인 환자 또는 대표 보호자일 때 true다. 일반 보호자는 full이어도 수정할 수 없다. resolve 성공은 `200 { alert: Alert }`이며 실제 후속 상태를 표시한다.

edit_note는 observation_vs_prescription에서만 제공한다. record_vs_prescription에는 기록 입력 수정 후 재정리를 안내한다. reupload는 안내만 기록하고 open을 유지하며 confirm_hospital은 awaiting_confirmation이다.

### 보류된 진료 전 결과

최신 완료 포인터는 ready 또는 blocked 결과를 가리킨다. generating·failed는 이전 완료 포인터를 유지한다. blocked를 이전 ready 결과로 바꿔 최신처럼 표시하지 않는다.

- companion의 questions 조회는 originals와 questionsInputVersion만 받고 merged 키는 없다.
- companion의 blocked briefing 조회는 404다. 다른 가족에게 보류 원인을 표시하지 않는다.
- full 조회는 state=blocked와 full 블록만 받고, blocked briefing의 questions는 []다.
- full의 questions.merged·briefing 응답에는 state가 필수다. ready인 companion 응답에는 state를 넣지 않는다.

### HTTP와 중복 요청

| 항목 | 계약 |
|---|---|
| 성공 상태 | login·GET·PUT scope·share·resolve 200, 질문·audio·notes 201, 생성·전사 202 |
| 메모 | trim 후 1~2000자. 잘못된 입력은 400이며 버전 증가 없음 |
| 진료과 | home 생략 시 정렬된 depts 첫 항목, timeline은 dept 필수. 잘못된 dept는 400 |
| 전사 중복 | uploadId를 포함한 중복 키 사용. 서로 다른 파일을 같은 작업으로 재사용하지 않음 |
| 공유 중복 | 같은 초안 재공유 200 alreadyPublished=true. 같은 키의 다른 본문은 409 idempotency_conflict |
| 멱등 결과 보존 | 성공 요청만 DB 수명 동안 보존, 공유 트랜잭션에 함께 저장 |
| 파일 오류 | 크기 초과 413 bad_request/file_too_large, MIME 오류 415 bad_request/unsupported_media_type |
| 내부 오류 | 500 internal_error, 공통 ErrorResponse 사용 |
| 미공유 진료 | 개별 visit은 meta만 반환 가능, timeline은 공유된 record가 있는 진료만 |

## FE와 BE의 연동 순서

1. BE 담당자는 schemas.md 8·8.1장과 이슈 #5를 리뷰하고 입력 버전·보류 결과·행동 권한을 확인한다. 수정 사항은 결정 기록과 계약에 함께 반영한다.
2. 계약 담당자 한 명이 T008의 공유 Zod 스키마를 작성한다. FE mock과 BE 응답은 같은 스키마를 사용한다. 기존 spec·fixture의 권한 기대값을 유지한다.
3. 로그인 → 홈 → 질문 → 브리핑의 읽기 경로를 연결한다. 이어서 전사 → 메모 → 정리 → 검토 → 공유를 연결한다.
4. 범위 변경 후 B/C의 다음 조회, draft 비공개, stale·blocked·failed를 API 직접 호출과 화면으로 검증한다.
5. 타입이 확정되면 같은 계약에서 OpenAPI를 만들어 요청·응답 예시를 붙인다. TypeScript·Zod·OpenAPI에 서로 다른 필드를 수동으로 유지하지 않는다.

mock은 AI 원본 fixture를 그대로 응답하지 않는다. 원본 fixture에는 세 블록과 근거가 들어 있어 낮은 범위 응답으로 사용할 수 없다. [시드 기대값](../specs/001-baton-mvp/seed-story.md)의 B·C 응답처럼 허용된 키만 가진 외부 응답을 만든다. schedule은 full=null이 아니라 full 키 자체가 없어야 한다.

연동 검증은 B 브리핑의 변경 2개·질문 3개, C의 질문·브리핑 404, 일반 보호자 members 403, 공유 전 draft 비공개, blocked 공유 409, GET 10회·범위 변경 3회 중 AI 호출 증가 0회를 기준으로 한다. 계약 문서 보완은 T008 또는 실제 구현·테스트 작업의 완료를 의미하지 않는다.
