# API workspace

Fastify 서버·SQLite·시드·JWT 로그인·현재 권한 검사・provider・jobs 기반을 구현했다. `npm run seed` 뒤 API를 시작한다. health·로그인·jobs와 환자 목록·홈·타임라인·진료·질문 통합·브리핑 API를 제공한다. 범위 변경·공유 로그·full 원문 스트림(T030~T032)은 로컬 검증 및 사용자 검토·게시 승인을 받았다. `apps/api/.env`의 JWT_SECRET은 32자 이상이어야 한다. [공통 기반](../../docs/backend-foundation-checkpoint.md)·[Phase 3](../../docs/phase3-backend-checkpoint.md)·[Phase 4 백엔드](../../docs/phase4-backend-checkpoint.md)의 실제 API와 미완료 범위를 참고한다.

- handlers: HTTP routes; 요청 검증→인증·관계·행동 권한→기능 모듈→허용 블록 응답.
- modules: members·visits·questions·briefing·summaries·alerts·jobs.
- auth: JWT·매 요청 현재 관계·scope→kind 화이트리스트·위임·원문 검사.
- adapters: SQLite·로컬 files·Bedrock·Transcribe·fixture 연결.
- ai: 생성 입력의 환자·진료과·목적 제한, 세블록 출력·근거·혼입 검증.
- workers: 로컬 비동기 실행·SQLite 작업 상태·재시도·재시작 처리.
- shared: 설정·오류·로그; 원문·토큰을 로그에 남기지 않는다.
- tests: 실제 계약·권한·블록 미조회·AI 입력·공유 보류 검증의 자리.

앱 저장·로그인은로컬, AI만AWS. 원문은full 전용이고 로컬파일은 공개static에 두지 않는다.
진료 전 questions·briefing은 검증 ready 결과를 허용 범위에 바로 제공한다. 진료 후 record는 POST share 확정 후에만 가족에게 공개한다. GET와 scope 변경은 AI를 부르지 않는다.
.env.example은 로컬 SQLite·업로드 경로와 fixture/live 모드·기존 Transcribe staging 버킷 설정을 제공한다. 실제 .env·DB·업로드는 Git에서 제외한다.
구현목록: [tasks.md](../../specs/001-baton-mvp/tasks.md).
