# Phase 5 실제 백엔드 API 인수인계

2026-10-09, 이슈 #17 / PR #22. 모든 경로는 buildApp에 등록돼 Fastify inject로 검증했다. **백엔드 fixture 검증 완료 / 화면 통합 미완료 / 실제 외부 AI 미검증**이다. 권한·공통 JSON은 기존 [schemas](../specs/001-baton-mvp/contracts/schemas.md)를 유지한다.

`P=/api/patients/{pid}`, `V=P/visits/{vid}`. 로그인 이후 `Authorization: Bearer <accessToken>`을 보낸다. JSON 포장(data) 없음. scope는 JWT/일반 응답에서 추출하지 않는다.

| 제품 경로 | 요청 → 성공 응답 | 권한·주의 |
|---|---|---|
| `GET V/record-input` | 200 `{recordInputVersion,canUploadAudio}` | 현재 companion 이상, 낮은 범위 404. 원문·업로드 목록 없음 |
| `POST V/audio` | FormData `file` → 201 `{uploadId}` | companion 이상+recordingAllowed, 단일 파일·20MB 이하. audio/mpeg, audio/mp4, audio/x-m4a, audio/wav, audio/webm. multipart boundary를 수동 지정하지 않음. 파일명은 저장 경로에 쓰지 않음 |
| `POST V/transcribe` | `{uploadId}` → 202 `{jobId}` | 환자·진료 소속, 현재 업로드 권한. 다른 visit의 파일 거부 |
| `POST V/notes` | `{text}`(trim 1~2000자) → 201 `{noteId,recordInputVersion}` | companion 이상. 저장 응답에 메모 원문 없음. 새 행 보존 |
| `POST V/structure` | `{inputVersion}` → 202 `{jobId}` | companion 이상, 현재 record-input 버전과 일치 필요 |
| `GET /api/jobs/{jobId}` | 200 기존 Job | 요청자 또는 현재 full. 2초 폴링, succeeded/failed에서 중단. 결과 블록/원문 없음 |
| `GET V?view=draft` | 200 `{meta,record:{view,version,inputVersion,stale,state,shareable,issues,mode,blocks}}` | 현재 작성자(companion 이상) 또는 환자/위임 대표, 자기 허용 kind만. blocked companion은 blocks={} |
| `POST V/share` | `{draftVersion,inputVersion,idempotencyKey}` → 200 `{publishedVersion,sharedAt,alreadyPublished}` | 검토한 draft의 version/inputVersion과 UUID 키. 최신 ready·현재 권한 일치 필수. 공유 버튼에서 사용자 확정 후만 호출 |
| `GET V?view=published` | 200 `{meta,record?}` | 일반 가족 기본값. 공유본 없으면 record 키 없음. published에는 inputVersion/stale/state/shareable/issues 없음 |
| `GET P/timeline?dept=내과`, `GET P/home?dept=내과` | 기존 TimelineRes/HomeRes | 현재 scope의 기존 공유본만. 미공유 record는 timeline에 없음. 같은 과 필터 유지 |
| `GET P/sources/{uploadId}` | 200 파일 stream | 현재 full만, companion 업로더도 403. Bearer fetch→blob 사용. private/no-store·nosniff·고정 attachment 이름. 공개 static/직접 경로 사용 금지 |
| `GET P/alerts`, `POST P/alerts/{aid}/resolve` | `{alerts,canResolve}`, `{action,...}`→200 `{alert}` | full 조회, 현재 full 환자·대표만 처리. 미공유 record alert는 검토 권한까지 필요. 동기 응답, job 폴링 없음 |
| `GET P/members`, `PUT P/members/{uid}/scope`, `GET P/share-log`, `GET P/members/{uid}/share-log` | 기존 Phase 4 계약 | 현재 환자/위임 대표만. 일반 보호자 full도 scope/log 열람·변경 불가. publish 로그는 환자 전체 share-log에서 조회 |

질문·브리핑·환자 조회 API는 [Phase 3](phase3-backend-checkpoint.md), 범위·원문 API는 [Phase 4](phase4-backend-checkpoint.md)를 함께 따른다. 질문/브리핑 ready는 별도 share 없이 공개되며 record와 혼동하지 않는다.

## 호출 순서·버전·재시도

1. 로그인→환자/진료 선택→record-input. 업로드 201→transcribe 202→jobs 성공 후 record-input 재조회. 전사 성공은 resultVersion/resultState=null이다. 원문은 일반 화면에 출력하지 않는다.
2. 메모 201 후 반환된 버전 또는 재조회 버전으로 structure. queued/running/succeeded는 같은 inputVersion의 jobId, failed만 새 job/attempt+1. 전사는 uploadId가 중복 키다. 입력 수정 중 대기 작업은 stale_input으로 실패할 수 있으므로 최신 input을 읽고 같은 uploadId로 재시도한다.
3. structure succeeded/ready 또는 blocked 뒤 draft를 다시 읽는다. succeeded만으로 완료·공유 성공을 표시하지 않는다. draft의 mode를 표시하고 stale이면 재정리를 안내한다. blocked는 공유 불가다. 같은 입력의 blocked job 재전송은 기존 결과를 재사용한다.
4. draft.shareable=true, state=ready, stale=false에서 사용자가 검토·확정하면 UUID 키 하나로 share를 전송한다. 네트워크 오류로 결과를 모르면 같은 본문/키로 재시도한다. 검토한 draft.inputVersion을 현재 입력으로 임의 교체하지 않는다.
5. 같은 성공 키/같은 초안 재공유는 현행 권한·버전 검사를 다시 하고 alreadyPublished=true, 로그 추가 없음. 같은 키의 다른 visit/version/input은 idempotency_conflict다. 입력이나 최신 draft가 바뀌면 과거 성공 키도 stale_input이므로 자동 공유 재시도하지 않는다.
6. 새 정리/실패/blocked 동안 기존 published는 유지된다. 새 draft가 생겼다고 기존 공유 화면을 새 draft로 바꾸지 않는다. 일반 missing_source/null/미해결 불일치는 needsCheck를 유지하며 공유 가능하고, 민감 혼입 blocked와 구분한다.

## 오류·상태와 캐시

모두 `{error:{code,reason?,message,requestId}}`. 원문·키·서버 경로를 추가해 표시하지 않는다.

| 상태 | 처리 |
|---|---|
| 400 bad_request | trim/길이/strict body/UUID 오류. record_vs_prescription의 edit_note는 unsupported_action |
| 401 unauthorized | 세션·환자 캐시·진행 요청 제거 후 로그인 |
| 403 forbidden | 현재 권한 없음/관계 철회, recording_not_allowed 또는 not_author 가능. 이전 상세 제거 |
| 404 not_found | 없는/다른 소속 리소스·허용 밖 조회. 존재·숨긴 개수 추정 금지 |
| 409 stale_input | input/draft 재조회, 다시 검토·정리. share 자동 재전송 금지 |
| 409 blocked / not_ready | 공유 중단, 입력 수정 또는 선행 결과 준비 안내 |
| 409 idempotency_conflict | 같은 키로 다른 공유 요청 금지, 요청 의도 확인 |
| 413 file_too_large / 415 unsupported_media_type | 파일 재선택. 업로드 DB/버전 변경 없음 |
| 500/502 | 안전한 실패·재시도 안내. 비동기 실패는 Job.errorCode에서 구분 |

Job.errorCode는 ai_unavailable/stt_unavailable/validation_failed/stale_input/internal이다. 실제 mode=fixture는 대체/fixture 사용을 뜻한다. 모의 테스트의 mode=live를 실제 OpenAI/Transcribe 연결 성공으로 계산하지 않는다.

캐시 키에 userId/patientId/dept/visitId/view를 구분한다. 계정 전환·로그아웃·401/403/404·scope 변경 후 이전 상세/원문 blob과 진행 요청을 제거한다. 화면 진입·브라우저 복귀 때 현재 서버 응답을 다시 읽는다. notes/transcribe 성공 후 record-input·draft, structure 완료 후 draft·허용 alerts/home, share 성공 후 published/home/timeline/관리자 share-log를 갱신한다. resolve 성공은 alerts/home을 갱신하고, scope 변경 성공은 관련 환자의 모든 범위별 캐시를 비우고 members/log/home/timeline/visit를 재조회한다. 서버 GET·scope는 AI를 호출하지 않는다.

## 미구현 경로와 남은 통합

이번 Phase 5의 record-input/audio/transcribe/notes/structure/share와 선행 Phase 3·4 경로는 사용 가능하다. Tier B 병원 안내 API와 Tier C docs/private-notes/doctor-view/settings·공유 중단·직접 녹음·기타 2단계 경로는 구현하지 않았다. 프론트 T020·T026~T029·T033~T036·T045~T047의 실제 버튼·화면 전환·캐시/원문 fetch·진료 흐름 수용 검증은 후속 담당 범위다. preview 14건/health E2E 1건은 이를 대신하지 않는다. 실제 음성 변환·외부 AI 성공과 인식/의미 정확성도 미검증이다.
