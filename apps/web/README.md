# Web workspace

React + TypeScript + Vite 모바일 웹이다. 실제 API 연결의 최신 결과는 [통합 체크포인트](../../docs/api-integration-checkpoint.md)에 있다. 루트에서 `npm run dev:preview`를 실행하면 가상 계정으로 로그인·홈·질문·브리핑·타임라인·화면 설정을 확인한다.

- `src/app/App.tsx`: 로그인·홈·질문·브리핑·타임라인·라우팅·기존 화면 보기 설정.
- `src/features/{settings,visit,alerts}`: 실제 공개 범위·입력/전사·정리/검토/공유·불일치 연결.
- `src/components/ui.tsx`: 허용 블록 표시·full 인증 원문 다운로드와 blob 정리.
- `src/lib/use-action.ts`: 화면 변경 시 mutation/폴링 취소.
- `src/app/session.tsx`: 실제 JWT 세션·조회 수명·전환/탭 복귀의 무효화. `invalidate()` 또는 `baton:invalidate` 이벤트는 scope 변경 후 재조회에 사용한다.
- `src/lib/api.ts`: API 요청·401 세션 해제·2초 작업 폴링과 취소.
- `src/styles/base.css`: 글씨 크기 3단계·고대비·모바일 스타일. 외부 폰트 다운로드 없이 시스템 글꼴을 사용한다.
- `dev/preview-api.ts`: Vite preview 모드에서만 등록되는 개발용 응답. 가상 계정과 fixture는 서버에서 읽는다.
- `dev/demo-accounts.ts`: 실제 API/preview의 로컬 개발 서버에서 가상 계정 빠른 선택을 지원한다. 배포 빌드와 정적 preview에는 등록하지 않는다.
- `tests/frontend.spec.ts`: 개발용 흐름·계정별 응답·화면·실패·접근성 브라우저 검사.
- `public/hospital`: 공개 가능한 정적 약도만. 환자 자료는 넣지 않는다.

루트의 `npm run dev`는 실제 API(:3001)와 웹(:5173)을 함께 실행한다. API가 별도로 실행 중이면 `npm run dev:web`로 웹만 실행한다. 웹의 `/api` 요청은 Vite가 실제 API로 프록시하며 로그인 JWT를 Bearer로 보낸다. `npm run build:web`는 프론트만 빌드하며 개발용 API를 포함하지 않는다. 빌드 산출물의 `/api` 호스팅은 이번 로컬 데모 범위에 없다.

T020 실제 세션·요청 취소·401·로그아웃·환자/진료 전환·탭 복귀 재조회는 [검증 기록](../../docs/frontend-session-checkpoint.md)을 참고한다. `npm run test:e2e`는 별도 fixture·메모리 SQLite 테스트 서버에서 실제 API를 검증하며 개발 DB와 로컬 `.env`를 사용하지 않는다. T026~T029·T033~T036·T045~T047의 실제 연결은 이슈 #32 브랜치에서 검증했다. 이 결과와 live 미실시는 통합 체크포인트를 따른다.

네 가상 계정의 빠른 선택 후 로그인 버튼을 누르면 기존 `POST /api/auth/login`으로 로그인한다. API의 시드 데이터가 필요하며, 브리핑까지 확인하려면 `npm run seed -- --pregenerate`로 준비한다. 웹 빌드에는 개발용 API·빠른 선택·가상 비밀번호를 포함하지 않는다.

preview의 개발용 토큰은 메모리의 불투명 식별자이며 JWT가 아니다. 실제 API 모드는 서버가 발급한 JWT를 사용한다. 가상 비밀번호는 로컬 Vite 개발 서버의 `/__demo/accounts`에서만 읽으며 `no-store`로 제공한다. 빠른 선택은 로그인 정보를 채우고 인증은 기존 로그인 폼으로 진행한다.
조회 결과는 계정별로 서버에서 조립하고 프론트는 받은 키만 그린다. JSON fixture를 읽는 개발용 어댑터는 실제 DB의 허용 블록 SELECT와 검증기를 대신하지 않는다.
개발용 응답 모드에서 환자·A의 새 질문은 검증기 연결 전 full 전용으로만 저장한다. 개발용 B의 등록은 준비 중 안내로 거부한다. 실제 API는 B의 질문 등록을 지원하며 서버에서 visibility를 검증한다. 새 질문 이후 일치하는 fixture가 없으면 통합 작업은 실패하며 기존 결과는 오래된 상태로 표시한다. 개발용 질문·브리핑 생성 버튼은 AWS 호출 없이 202 작업·폴링을 시연한다.
공유 범위·진료 기록·검토·공유·불일치는 실제 API 모드에 연결했다. preview 어댑터는 이 새 기능의 서버가 아니므로 실제 API 모드로 시연한다. 병원 안내 API는 이번 범위 밖이다. 로컬 개발 서버의 가상 계정 빠른 선택은 이메일과 가상 비밀번호를 채운다. API 키는 프론트로 보내지 않는다.

Playwright는 처음에 `npx playwright install chromium`이 필요하다. 별도 브라우저가 필요한 환경은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`로 실행 파일을 지정할 수 있다.
빠른 선택의 실제 API 검사는 루트에서 `npx playwright test --config apps/web/playwright.api.config.ts`로 실행한다. 5183/3103의 독립 서버·메모리 SQLite·fixture만 사용한다. preview 검사의 기본 5173 포트가 사용 중이면 `WEB_PORT=5184 npm run test:web`로 분리한다.
`.env.example`에는 브라우저에 공개 가능한 식별자만 있다.
명세: [spec.md](../../specs/001-baton-mvp/spec.md).
