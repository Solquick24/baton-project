# End-to-end validation

`npm run test:e2e`는 실제 Fastify·SQLite·Vite 프록시·Chromium을 사용한다. fixture/test/메모리 DB를 강제하는 별도 `e2e/server.ts`이며 개발 서버·.env·개발 DB를 재사용하지 않는다. 제품 buildApp에 등록된 API가 동작하고, reset/호출 카운터만 별도 테스트 진입점에 있다.

- `handoff.spec.ts`: 실제 로그인·질문 통합/브리핑·full 근거/null·진료과 격리·GET AI0.
- `scope.spec.ts`: 실제 범위 관리·다음 조회·탭 간 갱신·일반 보호자/위임 거부·AI0.
- `review-share.spec.ts`: 파일/전사/메모/정리/jobs/검토/공유/불일치·blocked/stale/권한 철회·실패 재시도·멱등·인증 파일/blob 해제.
- `session.spec.ts`: PR #31의 세션·401·계정/환자/진료 전환·요청 취소·네트워크 실패 회귀. fault injection은 실제 성공 흐름과 구분한다.
- `setup.spec.ts`: health·진입·프록시·가상 계정 이메일 선택.

API 직접 권한/kind SELECT/생성 입력/저장 전 안전 검사는 `apps/api/tests`의 `npm run test`로 별도 실행한다. OpenAI API 테스트의 transport와 AWS SDK는 모의이며 실제 외부 호출 성공으로 세지 않는다. `npm run test:web`의 preview 14건은 실제 API E2E와 별도다.

실제 명령·수치·초기 실패/해소·OpenAI/STT 모드·남은 범위는 [최신 체크포인트](../docs/api-integration-checkpoint.md)에 기록한다. T048~T051 전체 접근성 검증과 Tier C 완료를 이번 통합 테스트로 대체하지 않는다.
