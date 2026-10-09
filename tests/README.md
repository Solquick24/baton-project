# End-to-end validation

`e2e/`는 로그인 → 브리핑 → 진료 정리 → 가족 조회 → 다음 브리핑을 검증할 자리다.
Phase 1의 `setup.spec.ts`는 390px Chromium으로 시작 화면·라우팅·실제 Vite→API 프록시를 검증한다.
시드 로그인·환자 기능의 수용 테스트는 아직 없고 Phase 2 이후 추가한다.
`npm run test:e2e`는 fixture 모드·전용 3101/5174 포트를 사용하며 기존 서버를 재사용하지 않는다.
T010 이후 전용 DB 시드 준비를 추가해야 한다.
백엔드 권한·비교·AI 입력 검증은 `apps/api/tests/`에서 수행한다.
명세 품질 체크와 기능 테스트 통과는 별개다.
