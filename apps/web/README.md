# Web workspace

Phase 1의 React·Vite 시작 화면·라우터·API 프록시가 구현됐다.
`npm run dev --workspace @baton/web`로 실행한다. `/`·`/login`은 준비 안내만 표시하며, 실제 로그인·환자 기능은 아직 없다. `/api`는 localhost API로 전달한다. 기본 포트는 5173(API 3001), e2e는 5174(API 3101)다.

- `src/app`: 라우팅·인증 상태·공통 레이아웃·전역 접근성 설정.
- `src/features`: 로그인·홈·질문·브리핑·진료·타임라인·확인 항목·설정별 코드.
- `src/components`: 공통 UI. 기능 전용 컴포넌트는 해당 feature 내부에 둔다.
- `src/lib`: API·인증 연결. 서버 권한 검사를 화면 숨김으로 대신하지 않는다.
- `src/styles`: 글씨 크기 3단계·고대비·모바일 스타일.
- `src/mocks`: 서버 계약과 권한별로 일치하는 개발용 응답.
- `public/hospital`: 공개 가능한 정적 약도만. 환자 자료는 넣지 않는다.

구현 착수 시 React·Vite·TypeScript와 타입 의존성, 진입점, 실제 실행·빌드 명령을 추가한다.
`.env.example`에는 브라우저에 공개 가능한 식별자만 있다.
명세: [spec.md](../../specs/001-baton-mvp/spec.md).
