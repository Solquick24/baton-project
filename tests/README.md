# End-to-end validation

`npm run test:e2e`는 실제 Fastify·SQLite·Vite 프록시·Chromium을 사용한다. fixture/test/메모리 DB를 강제하는 별도 `e2e/server.ts`이며 개발 서버·.env·개발 DB를 재사용하지 않는다. 제품 buildApp에 등록된 API가 동작하고, reset/호출 카운터와 결정적 실패 재현용 pause/interrupt 경로만 별도 테스트 진입점에 있다. 실제 DB 재시작 검사는 제품 buildApp/API로 따로 수행한다.

- `handoff.spec.ts`: 실제 로그인·질문 통합/브리핑·full 근거/null·진료과 격리·GET AI0.
- `scope.spec.ts`: 실제 범위 관리·다음 조회·탭 간 갱신·일반 보호자/위임 거부·AI0.
- `review-share.spec.ts`: 파일/전사/메모/정리/jobs/검토/공유/불일치·blocked/stale/권한 철회·실패 재시도·멱등·인증 파일/blob 해제.
- `session.spec.ts`: PR #31의 세션·401·계정/환자/진료 전환·요청 취소·네트워크 실패 회귀. fault injection은 실제 성공 흐름과 구분한다.
- `accessibility.spec.ts`: 390px 최대 글씨/고대비, 주요 화면 20상태의 컨트롤 경계/잘림/스크롤 후 hit test, 설정 유지·키보드·정적 병원.
- `failure.spec.ts`: 중단 작업의 실패 표시·attempt2 재시도·중복 방지·fixture 표시.
- `record-flow.spec.ts`: 코드 변경 없는 idle/실제 탭 복귀·입력 DOM/스크롤·메모 상태·최신 버전·실패 후 성공 job 재사용·공유 후 기록·조회 오류 반복 부재·권한 철회. job 응답 fault injection과 실제 provider 성공을 구분.
- `rehearsal.spec.ts`: 이어받기(B→C→A), 환자 범위 변경 경로 각각 두 번 연속. JSON 측정 기록.
- `setup.spec.ts`: health·진입·프록시·가상 계정 이메일 선택.

API 직접 권한/kind SELECT/생성 입력/저장 전 안전 검사는 `apps/api/tests`의 `npm run test`로 별도 실행한다. OpenAI API 테스트의 transport와 AWS SDK는 모의이며 실제 외부 호출 성공으로 세지 않는다. `npm run test:web`의 preview 14건은 실제 API E2E와 별도다.

실제 API E2E는 3314/5314·매 실행별 임시 업로드, preview는 5313을 사용한다. 사용자 서버 3001/5173·개발 DB를 건드리지 않는다. 브라우저 테스트는 fixture 환경을 강제하고 키/모델을 비우며 실제 API E2E의 외부 fetch를 차단한다.

실제 명령·수치·초기 실패/해소·OpenAI/STT 모드·남은 범위는 [최종 체크포인트](../docs/final-validation-checkpoint.md)에 기록한다. T065 축소 평가의 별도 재서술 실패와 20장 문서 평가 미수행, Tier C 제외를 유지한다.
