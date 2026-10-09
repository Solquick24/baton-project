# 바통 아이콘·캐릭터 사용 기준

2026-10-09 사용자 확정: **A1을 대표 아이콘으로 사용하고 A2·A3·A4는 같은 바통 캐릭터의 상황별 포즈로 사용한다.**

| 이미지 | 역할 | 현재 배치 |
|---|---|---|
| A1 | 기록 카드를 들고 인사하는 대표 아이콘. 상단 로고와 앱 아이콘은 이 포즈로 고정 | 로그인 로고·공통 헤더·favicon·홈 화면 추가용 아이콘 |
| A2 | 기록을 두 손으로 챙기는 준비 포즈 | 홈의 다음 진료·가족 질문 안내·진료과가 없는 타임라인 빈 상태 |
| A3 | 기록을 다음 동행자에게 건네는 포즈 | 브리핑의 변경 사항·질문 아래 안내 |
| A4 | 단순한 인사 포즈 | 로그인 환영 문구 |

주황색 바통 몸체·파란 기록 카드·진한 눈과 미소를 공통으로 유지한다. 몸통·얼굴·카드를 따로 늘이거나 화면마다 색을 바꾸지 않는다. 대표 A1에는 두 개의 인사 표시가 있고 A4에는 없다. 주황색은 캐릭터의 브랜드 색이다. 기존 기능 버튼과 고대비의 진한 청록 강조는 유지한다.

캐릭터는 화면의 안내 문구 옆에 배치하는 장식이다. 성공·오류·공유 완료·권한을 표정이나 색으로 표현하지 않는다. API가 허용한 내용을 텍스트로 표시하며 캐릭터가 추가 정보를 추정하지 않는다. 오류·차단 안내에는 웃는 캐릭터를 추가하지 않는다.

이미지에는 `alt=""`와 `aria-hidden="true"`를 사용한다. 로고 옆의 실제 텍스트 `바통`이 이름을 제공한다. `width`·`height`를 지정해 이미지 로딩 전에도 영역을 확보하고, 비율을 유지한다. 화면용 캐릭터는 84px·투명 WebP이며 작은 화면과 큰 글씨에서 필요하면 다음 줄로 내려간다. 애니메이션은 추가하지 않는다. 브리핑의 변경 사항과 질문 앞에는 캐릭터 영역을 추가하지 않는다.

## 파일

- 런타임: [public/brand](public/brand/), [manifest](public/manifest.webmanifest), [컴포넌트](src/components/brand.tsx).
- PNG 원본과 생성 도구·프롬프트: [승인 에셋](output/imagegen/baton-brand-approved-20261009/prompts.md). 내장 이미지 생성 도구로 시안에서 이미지를 추출하고 브라우저 Canvas로 크기·파일 형식만 최적화했다. A2~A4의 투명 픽셀을 확인했다.
- 실제 화면 캡처: [로그인](output/brand-preview/login.png), [홈](output/brand-preview/home.png), [브리핑](output/brand-preview/briefing-mobile.png), [큰 글씨·고대비](output/brand-preview/briefing-large-contrast.png).
- 루트에서 검증: `npm run build`, `WEB_PORT=5486 npm run test:web`, `node_modules/.bin/playwright test --config apps/web/playwright.brand.config.ts`.

## 이번 검증 결과

- 팀 통합 `f03384c`까지 보존한 별도 작업 공간에서 `npm run build` 통과(API·web·contracts·tools 전체 타입 검사와 Vite 빌드).
- 실제 Fastify API·메모리 SQLite·fixture와 Chromium으로 캐릭터 검사 **3 통과 / 0 실패**: 390×844 보통 글씨, 375×844 아주 큰 글씨·고대비, 844×390 가로 화면. 이미지 로딩·장식 이미지 의미·로고 링크 이름·가로 넘침·질문 3개 유지·조회 중 텍스트 생성 0회를 확인했다.
- 최종 preview 회귀 `WEB_PORT=5486 npm run test:web`: **21 통과 / 0 실패**. 온보딩과 개발용 응답의 계정별 제한 표시·질문 통합·로그아웃·고대비 등을 확인했다. 실제 API의 권한 검증과는 구분한다.
- 최종 fixture API 회귀 `npm run test --workspace @baton/api -- --maxWorkers=1`: **247 통과 / 0 실패**(22개 파일). 최초 기본 병렬 실행은 245 통과/시간 초과 2건이었고, 한 워커로 전체를 재실행해 모두 통과했다. 테스트 시간 제한이나 기대값은 변경하지 않았다.
- 최종 브랜드 검사 `node_modules/.bin/playwright test --config apps/web/playwright.brand.config.ts`: **3 통과 / 0 실패**. 실제 fixture API에서 조회 중 텍스트 생성 호출 0회를 확인했다.
- 원본 폴더의 이전 녹음 종료 검사 실패(13 통과/1 실패)는 당시 기록이다. 이후 팀 통합 [PR #51](https://github.com/Solquick24/baton-project/pull/51)에서 화면·브랜드·온보딩을 병합했다. 이 브랜드 보완 PR은 그 구현을 보존하며 승인 원본·독립 검증·재현 가능한 경로와 기록을 추가한다. 명세 작업의 전체 완료나 실제 기기·외부 AI 검증으로 계산하지 않는다.
- 실행 환경의 Chromium 라이브러리는 기존 `/tmp/baton-main-browser-libs/extracted/usr/lib/x86_64-linux-gnu`, 한글 테스트 폰트는 기존 `/tmp/baton-fe-fonts.conf`를 사용했다. 시스템 설치·프로젝트 의존성 추가 없이 로컬 브라우저 실행 승인을 받아 검증했다.

홈 화면 추가를 위한 아이콘·manifest를 연결했다. 서비스 워커·오프라인 동작·네이티브 앱 패키징은 이번 변경에 포함하지 않는다. 실제 iOS/Android 홈 화면 추가는 별도 기기 검증이 필요하다.

이번 작업은 브랜드 에셋·배치에 한정한다. 명세의 작업 ID를 완료 처리하지 않고 API·계약·시드·권한 정책은 변경하지 않는다. 검증은 가상 데이터의 실제 로컬 API와 fixture 생성 모드를 사용하며 외부 AI 호출을 하지 않는다. 기존 작업 중인 화면 변경은 원본 작업 폴더에 보존한다. 사용자 후속 요청으로 [이슈 #45](https://github.com/Solquick24/baton-project/issues/45)의 `design/45-baton-brand` 브랜치에서 커밋·푸시·devlop PR 병합을 진행한다. main 반영·배포는 이번 범위에 포함하지 않는다.
