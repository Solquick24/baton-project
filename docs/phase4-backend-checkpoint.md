# Phase 4 백엔드 체크포인트 — T030~T032

2026-10-09. Phase 3 백엔드 PR #16의 `d3e0417`에서 구현·검토했고, 사용자에게 커밋·푸시 및 `devlop` 반영 승인을 받았다. [작업 이슈 #29](https://github.com/Solquick24/baton-project/issues/29)를 만들고 최신 `origin/devlop`의 `b3fa963`에서 `feat/29-sharing-api`를 생성해 검토한 변경을 통합했다. 원격의 앱별 AGENTS.md 안내를 보존하고 백엔드 지침을 확인했다. 작업 브랜치를 push한 뒤 `devlop` 대상 PR로 반영한다.

T030~T032의 백엔드 구현·API 직접 검증은 완료했다. T033~T036의 화면·캐시 연결·수용 E2E는 미완료이며 **Phase 4 전체 완료는 아니다**. T020·T026~T029 프론트 통합은 기존 미완료 상태를 유지한다. Tier C나 Phase 5 구현은 추가하지 않았다.

## 구현과 검증

| 작업 | 결과 |
|---|---|
| T030 | `members.test.ts`, `source-access.test.ts`를 구현 전에 작성했다. 최초 29건 중 22 실패·7 통과로 API 부재를 확인했다. 기존 404와 같은 결과를 기대하는 부정 사례 7건의 통과만으로 기능 성공을 판단하지 않았다. 구현 후 신규 29건 모두 통과했고, 파일 열기 중 권한 철회·안전한 MIME/루트 내부 절대 경로 회귀 2건을 추가해 최종 31건 모두 통과했다. |
| T031 | 구성원 목록, 범위 변경, 가족별·환자 전체 공유 로그. 매 요청 현행 관계·활성 상태·지정 대표·위임을 확인한다. 범위 변경·로그 삽입·응답 검증은 하나의 immediate 트랜잭션이다. 같은 범위로 변경하면 200이며 로그를 추가하지 않는다. 로그 삽입 실패 시 범위도 롤백한다. |
| T032 | 등록된 업로드의 환자·진료 소속과 현행 full 권한을 검사해 파일을 스트리밍한다. companion 업로더도 원문 읽기는 403이다. 문자열 경로 및 realpath를 검사해 `..`, 역슬래시 탈출, 외부 절대 경로, 디렉터리, 외부로 향하는 링크/Windows junction을 거부한다. 파일 열기의 비동기 대기 뒤 권한을 다시 확인한다. |

공통 `@baton/contracts` 응답·요청 스키마와 기존 인증·권한·허용 kind 정책을 사용한다. 공유 계약·DB 스키마·기존 repository·패키지·lockfile·seed/fixture·apps/web은 수정하지 않았다. 공통 조립 파일 `apps/api/src/app.ts`는 두 handler import와 등록, 총 네 줄만 추가했다. Phase 3의 handler 등록과 생성 파이프라인을 보존했다.

## 실제 실행 결과

검증 환경은 Windows, Node 22.22.0/npm 10.9.8이다. Node 공식 배포본 SHA-256을 확인하고 작업 폴더의 도구를 사용했다. 시스템의 Node 24/npm 11은 변경하지 않았다. 의존성은 `npm ci --ignore-scripts --no-audit --no-fund`로 lockfile 그대로 설치했다(설치 실행기는 Node 배포본에 동봉된 npm 10.9.4, 이후 검사 실행기는 지정 npm 10.9.8).

| 검사 | 결과 |
|---|---|
| 구현 전 신규 API 테스트 | 2파일, **22 실패 / 7 통과**. 실패 원인은 미등록 경로의 404 응답 |
| 구현 후 신규 API 테스트 | 2파일, 최종 전체 실행에 포함된 **31 통과 / 0 실패** |
| `npm run typecheck` | API·web·contracts·도구 타입 검사 통과 |
| `npm run test` | 최신 devlop의 OpenAI provider 통합 후 **15파일, 185 통과 / 0 실패**, 기존 Phase 3와 신규 권한 31건 포함 |
| `npm run build` | 타입 검사·Vite 빌드 통과 |
| 범위 변경 3회 + 각 범위 GET 10회 | 같은 JWT로 다음 조회에 schedule/full/companion 즉시 반영. 허용 kind SQL과 `Object.keys`로 금지 키 부재 확인. LLM/STT 호출 **0회** |
| 원문 권한·파일 검사 | full 원본 바이트, companion/일정만/비구성원 거부, 현재 권한 철회, 환자·진료 소속, 내부 경로 비노출, 경로 탈출·링크 거부 통과 |

게시 승인 후 `origin/devlop b3fa963`를 기준으로 `npm run test`와 `npm run build`(전체 `npm run typecheck` 포함)를 재실행해 14파일·150건 통과/0실패를 확인했다. PR #30 생성 중 OpenAI provider PR #27이 devlop에 병합돼 최신 `5b4fd9c`를 추가 통합했다. README·API README·결정 기록의 충돌은 양쪽 내용을 보존해 해결했다. provider·설정·테스트와 app.ts의 선택 로직을 보존한 최종 통합 검증은 **15파일·185건 통과/0실패**, 전체 타입 검사·빌드 통과다.

테스트는 fixture·메모리 SQLite와 자체 생성한 임시 가상 파일을 사용했다. 원문 테스트 파일은 종료 후 지웠고 개발 DB·업로드를 열거나 수정하지 않았다. 테스트 setup에서 AWS SDK send를 차단했다. **실제 AWS 호출·자원 생성·IAM 변경·배포는 하지 않았다.** 초기 기본 sandbox 실행은 Vite의 Windows 자식 프로세스 `spawn EPERM`으로 시작하지 못했고, 허용된 실행 환경에서 다시 실행해 위 결과를 얻었다.

이번 작업에서 Playwright 브라우저 검사는 실행하지 않았다. 변경 범위가 백엔드이며 신규 권한은 실제 등록된 Fastify handler를 inject로 검증했다. UI·캐시·브라우저 수용 검증은 T033~T036 담당 범위다. 기존 preview 화면의 동작을 실제 새 API 통합 완료로 보고하지 않는다.

## 프론트·Phase 5 인수인계

모든 아래 경로 앞에 `/api`를 붙인다. JWT Bearer와 포장 없는 JSON을 사용한다.

| API | 요청·응답·권한 |
|---|---|
| `GET /patients/:pid/members` | `{members:[{userId,name,relation,role,scope,active}]}`. 환자 또는 현재 위임이 켜진 지정 대표만 200, 나머지 403 |
| `PUT /patients/:pid/members/:uid/scope` | strict `{scope:'schedule'|'companion'|'full'}` → 200 `{member}`. 환자 대상은 400, 없는/다른 환자/비활성 대상은 404. 같은 값이면 로그 없음 |
| `GET /patients/:pid/members/:uid/share-log` | `{logs:[ShareLog]}`. 해당 가족의 start/scope_change/stop 기록, 최신순. 비활성 가족의 과거 로그도 관리자는 읽을 수 있음 |
| `GET /patients/:pid/share-log` | `{logs:[ShareLog]}`. 전체 기록, seed start/publish 포함. publish는 targetUserId=null. 두 로그 경로 모두 환자·위임 대표만 허용 |
| `GET /patients/:pid/sources/:uploadId` | 등록된 파일 스트림. 현행 full 구성원만 허용. 파일·소속 불일치·경로 탈출은 안전한 404 |

파일은 `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, 고정된 안전한 attachment 파일명으로 반환한다. 알려진 음성 MIME만 그대로 사용하고 그 외는 application/octet-stream으로 반환한다. 파일 시스템 경로나 원래 파일명은 응답하지 않는다. 파일을 공개 static에 등록하지 않는다.

T039의 후속 업로드는 파일을 전용 비공개 `UPLOAD_DIR` 안에 두고 `uploads.storagePath`에 그 루트 기준 상대 경로(권장) 또는 그 루트 내부 절대 경로를 기록한다. `uploads.patientId/visitId/size`는 실제 소속과 바이트 크기에 맞춰 저장해야 한다. T032는 업로드·전사 API나 실제 음성 자료를 생성하지 않는다. 다운로드 요청은 헤더에 토큰을 넣어야 하므로 프론트는 인증된 fetch 후 blob을 사용한다.

파일을 열어 응답하기 직전까지 권한을 재검사한다. 이미 전송된 바이트를 범위 변경 후 회수할 수는 없으며 다음 요청부터 새 권한을 적용한다. 업로드 디렉터리의 파일·하위 경로는 서버가 관리하는 비공개 저장소라는 전제로 경로를 검증한다.

## 후속 작업과 반영 상태

- FE: T033 범위 관리·공유 로그 화면, T034 타임라인, T035 변경 후 환자 캐시 제거·재조회, T036 실제 통합 E2E.
- FE: 기존 T020·T026~T029 실제 API 연결과 인용 표시/인증된 원문 fetch 연결. 저장된 full 인용만 표시하며 낮은 범위에 원문 버튼을 만들지 않는다.
- BE: T039 가상 파일 업로드·전사, T043 공유 확정과 publish 로그 생성. 이번 T031은 범위 변경 로그만 새로 생성한다.
- GitHub: 사용자 검토·게시 승인을 받은 이번 변경은 [이슈 #29](https://github.com/Solquick24/baton-project/issues/29)와 `feat/29-sharing-api`로 관리한다. 팀 형식 커밋·작업 브랜치 push·`devlop` 대상 PR 및 병합의 실제 결과·커밋 링크는 이슈와 PR 본문에 갱신한다. `main` 반영은 이번 요청 범위 밖이며, 다음 변경도 사용자 사전 검토를 받는다.

근거: [정확한 계약](../specs/001-baton-mvp/contracts/schemas.md) 8·8.1·9장, [API 경로](../specs/001-baton-mvp/contracts/api.md), [시드 기대값](../specs/001-baton-mvp/seed-story.md) 4·5장, [작업 목록](../specs/001-baton-mvp/tasks.md), [결정 기록](decisions.md), [팀 작업 방식](branch-workflow.md).
