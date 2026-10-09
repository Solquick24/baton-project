# Web workspace

React + TypeScript + Vite 모바일 웹의 첫 구현이다. 루트에서 `npm run dev:preview`를 실행하면 가상 계정으로 로그인·홈·질문·브리핑·타임라인·화면 설정을 확인한다.

- `src/app/App.tsx`: 초기 라우팅·화면·세션·화면 보기 설정. 후속 기능에서 화면별 파일로 분리한다.
- `src/lib/api.ts`: API 요청·401 세션 해제·2초 작업 폴링과 취소.
- `src/styles/base.css`: 글씨 크기 3단계·고대비·모바일 스타일. 외부 폰트 다운로드 없이 시스템 글꼴을 사용한다.
- `dev/preview-api.ts`: Vite preview 모드에서만 등록되는 개발용 응답. 가상 계정과 fixture는 서버에서 읽는다.
- `tests/frontend.spec.ts`: 개발용 흐름·계정별 응답·화면·실패·접근성 브라우저 검사.
- `public/hospital`: 공개 가능한 정적 약도만. 환자 자료는 넣지 않는다.

`npm run dev:web`는 localhost:3001의 실제 API로 프록시한다. 실제 API는 아직 구현되지 않았다. `npm run build:web`는 프론트만 빌드하며 개발용 API를 포함하지 않는다. 빌드의 `/api` 제공은 후속 통합 작업이다.

개발용 토큰은 메모리의 불투명 식별자이며 JWT가 아니다. 서버가 재시작되면 다시 로그인한다. 가상 비밀번호는 preview 전용 `/__preview/accounts`에서 읽고 프론트 번들에는 넣지 않는다.
조회 결과는 계정별로 서버에서 조립하고 프론트는 받은 키만 그린다. JSON fixture를 읽는 개발용 어댑터는 실제 DB의 허용 블록 SELECT와 검증기를 대신하지 않는다.
환자·A의 새 질문은 검증기 연결 전 full 전용으로만 저장한다. B의 등록은 준비 중 안내로 거부한다. 새 질문 이후 일치하는 fixture가 없으면 통합 작업은 실패하며 기존 결과는 오래된 상태로 표시한다. 질문·브리핑 생성 버튼은 AWS 호출 없이 202 작업·폴링을 시연한다.
공유 범위 변경·병원 안내·진료 기록·검토·공유·불일치 처리는 아직 연결하지 않았다.

Playwright는 처음에 `npx playwright install chromium`이 필요하다. 별도 브라우저가 필요한 환경은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`로 실행 파일을 지정할 수 있다.
`.env.example`에는 브라우저에 공개 가능한 식별자만 있다.
명세: [spec.md](../../specs/001-baton-mvp/spec.md).
