# AGENTS.md — 바통 프론트 작업 지침

이 파일은 `apps/web`의 작업 지침이다. [루트 AGENTS.md](../../AGENTS.md)를 함께 따르며, 공통 안전 규칙·명세 우선순위·Tier·브랜치 절차를 유지한다. 기본 작업 위치는 `apps/web`이다.

## 담당 범위와 참고 문서

- 최신 이슈 #32 작업 브랜치의 실제 API 화면 통합·검증·종료 범위는 [통합 체크포인트](../../docs/api-integration-checkpoint.md)를 우선 확인한다. T020·T026~T029·T033~T036·T045~T047을 fixture API/브라우저로 검증했고 OpenAI key/model 미설정으로 실제 호출은 미실시다. STT fixture, T048~T051·Tier C 미완료 유지. 아래 이전 체크포인트의 미완료 문장은 당시 기록이다. 이번 통합은 사용자 요청대로 커밋 후 중지하며 push/PR/병합은 하지 않는다.

- 기본 수정 범위는 이 앱의 `src/`, `dev/`, `public/`, `tests/`와 웹 설정·안내 문서다. 사용자는 FE 리드이므로 공통 UI·접근성·API 연결·프론트 리뷰 기준을 중심으로 보고한다.
- 루트의 읽는 순서를 따른 뒤 [프론트 계획과 검증 기록](../../docs/frontend-plan.md), [웹 실행 안내](README.md), [FE API 연동 기준](../../docs/fe-api-contract.md), [최신 백엔드 API 인수인계](../../docs/phase3-backend-checkpoint.md)를 확인한다. 이전 백엔드 기반 기록보다 최신 체크포인트의 실제 API 목록을 우선 확인한다.
- 화면은 [screens.md](../../specs/001-baton-mvp/screens.md), 요청·응답은 [schemas.md](../../specs/001-baton-mvp/contracts/schemas.md)·[api.md](../../specs/001-baton-mvp/contracts/api.md), 가상 내용은 [seed-story.md](../../specs/001-baton-mvp/seed-story.md)가 기준이다.
- 배치는 [와이어프레임 반영 기준](../../docs/wireframe-integration.md)과 [팀 PDF](../../docs/references/baton-ui-wireframe-selection.pdf)를 참고한다. PDF가 기능·권한·Tier C 구현 범위를 확대하지 않는다.
- `packages/contracts`, 백엔드, 루트 설정 변경이 이슈에 필요하면 영향과 연동 범위를 기록하고 해당 앱 지침도 읽는다. 공통 계약·DB 스키마·루트 package.json/lockfile은 한 작업자씩 변경·통합한다. 다른 담당자의 변경을 덮어쓰지 않는다.

## 코드와 UI 기준

- React·Vite·TypeScript와 루트에서 고정한 버전을 유지한다. 현재 라우트·화면은 `src/app/App.tsx`, API 요청·세션·폴링은 `src/lib/api.ts`, 공통 스타일은 `src/styles/base.css`에 있다. 변경 범위에 필요한 단위로 파일을 분리한다.
- 모든 화면에 `가상 데이터` 배지를 표시한다. 새 예시도 가상 자료만 사용하며 확정된 시드 내용을 기준으로 한다.
- screens.md의 경로와 `data-testid`를 그대로 사용한다. UI를 바꿔도 기존 E2E 식별자를 임의로 바꾸지 않는다.
- 받은 블록·응답 키의 존재로 표시 여부를 정한다. 프론트에 `ALLOWED_KINDS`나 계정별 scope 표를 복제하지 않는다. 서버의 허용 블록 조회를 UI 필터로 대신하지 않는다.
- full 블록이 없으면 원문·근거 버튼을 만들지 않는다. 일반 보호자에게 다른 가족 범위·잠금·숨긴 개수를 보여주지 않으며 본인 범위 이름도 추정해 표시하지 않는다.
- 로딩·빈 상태·실패·재시도·입력 보존을 구분한다. 실제 작업 성공이나 공유 확정 응답을 받기 전에 완료 안내를 표시하지 않는다.
- 저장된 결과의 `mode`를 표시하고 근거 없는 값은 `기록에 없어요`·`확인 필요`로 표현한다. 진단·처방 결정·수치 해석·치료 권고 문구를 추가하지 않는다.

## 접근성

- 모바일 한 열 배치·48px 이상의 터치 영역·키보드 조작·명확한 초점을 유지한다. 입력 label, 상태 안내, 오류 안내를 제공하고 색만으로 의미를 구분하지 않는다.
- 글씨 3단계와 고대비를 모든 구현 화면에 적용한다. 고대비는 흰 배경·검은 글자·진한 청록 강조·두꺼운 검은 테두리다.
- 화면 설정은 `baton.display`에 유지하고 저장소 접근이 실패해도 기본값으로 동작한다.
- 390×844 보통 글씨의 B 브리핑에서 바뀐 점과 질문을 먼저 보여준다. 아주 큰 글씨에서는 내용을 생략하지 않고 스크롤을 허용한다. 하단 탭·고정 버튼·safe area가 마지막 내용과 입력을 가리지 않게 한다.
- 병원 안내는 공개 가능한 정적 SVG만 사용하고 외부 지도 SDK·길찾기·경로 계산을 추가하지 않는다.

## API 연결과 개발용 응답

- 공통 타입·스키마는 `@baton/contracts`를 사용한다. 계약 export만으로 실제 endpoint가 등록됐다고 판단하지 않고 백엔드 체크포인트와 handler를 확인한다.
- 실제 API 모드는 `/api`를 로컬 API로 프록시한다. 인증 요청은 Bearer 토큰을 사용하며 JWT·응답에 없는 role/scope를 추정하지 않는다.
- 401·로그아웃·계정/환자 전환·범위 변경 뒤에는 이전 세션 또는 환자 응답 캐시를 적절히 비우고 재조회한다. 이전 요청을 취소해 다른 계정·환자 응답이 현재 화면에 남지 않게 한다.
- 생성은 명세의 POST와 입력 버전을 사용한다. 202의 jobId로 2초 폴링하고 succeeded/failed 및 화면 이탈에서 중지한다. 조회·화면 이동·범위 변경으로 생성 요청을 보내지 않는다.
- record 초안의 `inputVersion`·`stale`·`state`·`shareable`을 확인한다. 공유는 명시적 확인 후 계약대로 요청하며 blocked·오래된 입력의 409를 성공으로 표시하지 않는다.
- `dev/preview-api.ts`의 개발용 응답은 Vite preview 모드에서만 제공한다. fixture·가상 비밀번호·원문·scope 표는 서버 측에서 읽고 브라우저 번들에 포함하지 않는다. `VITE_*`에는 공개 가능한 값만 넣는다.
- preview의 메모리 토큰·저장 예시·작업 상태 시연은 실제 JWT·DB·AI·API 통합 완료로 계산하지 않는다. 입력에 맞는 fixture가 없으면 실패를 표시한다.

## apps/web에서 실행하는 명령

| 목적 | 명령 |
|---|---|
| 프론트 개발용 응답으로 실행 | `npm run dev:preview` |
| 실제 API 프록시로 웹 실행(API 별도 실행) | `npm run dev` |
| 웹 타입검사 | `npm run typecheck` |
| 웹 타입검사와 Vite 빌드 | `npm run build` |
| 프론트 preview Playwright 검사 | `npm --prefix ../.. run test:web` |
| 전체 타입검사 / API fixture 검사 | `npm --prefix ../.. run typecheck` / `npm --prefix ../.. run test` |
| 실제 API 기반 E2E | `npm --prefix ../.. run test:e2e` |

루트의 `npm run dev`는 API·웹 동시 실행이지만 여기의 `npm run dev`는 웹만 실행한다. 설치와 공통 명령은 루트에서 실행한다. Playwright 첫 설치는 루트에서 `npx playwright install chromium`이다.

## 검증과 완료 기준

- 웹 코드·설정 변경은 타입검사·빌드를 실행하고, 사용자 흐름·권한 표시·접근성 변경에 해당하는 Playwright 검사를 실행한다. 문서만 변경하면 경로·링크·명령 정의를 확인한다.
- API 응답의 금지 키·문자열 부재와 UI 버튼 부재를 함께 확인한다. preview 화면 통과는 실제 API 권한 검증을 대체하지 않는다.
- B 변경/질문·A 근거/빈 준비사항·C 일정만·진료과 필터·아주 큰 글씨/고대비의 관련 수용 기준을 확인한다.
- 실제 API 연결이 필요한 작업은 실제 API 모드에서 검증해야 완료로 표시한다. 선행 API가 없으면 의존성과 검증 한계를 기록하고 완료 체크를 남겨 두지 않는다.
- Phase 체크포인트에서는 루트의 전체 typecheck·API test 규칙도 따른다. Tier C는 명시적 요청이 없으면 미완료로 둔다.
- 완료한 작업 ID·실제 명령/결과·preview/실제 API 및 live/fixture 여부·남은 연동·결정 기록을 보고하고 관련 이슈·PR에도 기록한다.
