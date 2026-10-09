# API workspace

Fastify·SQLite·시드 JWT·현재 권한·provider/jobs 기반과 Phase 3 질문·브리핑·환자/진료 조회 API를 제공한다. `npm run seed` 뒤 API를 시작한다. `apps/api/.env`의 JWT_SECRET은 32자 이상이어야 한다. 실제 API 목록은 [Phase 3 체크포인트](../../docs/phase3-backend-checkpoint.md), 기반은 [백엔드 기록](../../docs/backend-foundation-checkpoint.md)을 참고한다. OpenAI 선택이 미병합 Phase 5 record/공유 API를 완성하지는 않는다.

- handlers: HTTP routes; 요청 검증→인증·관계·행동 권한→기능 모듈→허용 블록 응답.
- modules: members·visits·questions·briefing·summaries·alerts·jobs.
- auth: JWT·매 요청 현재 관계·scope→kind 화이트리스트·위임·원문 검사.
- adapters: SQLite·로컬 files·Bedrock·Transcribe·fixture 연결.
- ai: 생성 입력의 환자·진료과·목적 제한, 세블록 출력·근거·혼입 검증.
- workers: 로컬 비동기 실행·SQLite 작업 상태·재시도·재시작 처리.
- shared: 설정·오류·로그; 원문·토큰을 로그에 남기지 않는다.
- tests: 실제 계약·권한·블록 미조회·AI 입력·공유 보류 검증의 자리.

앱 저장·로그인은 로컬이다. 2026-10-09 사용자 결정으로 텍스트는 OpenAI Responses를 기본 live provider로 선택하고 Bedrock/fixture를 보존한다. 전사 provider는 변경하지 않는다. 이전 'AI만 AWS' 방향의 변경 근거와 실제 검증은 [OpenAI 체크포인트](../../docs/openai-provider-checkpoint.md)에 있다. 원문은 full 전용이고 로컬 파일은 공개 static에 두지 않는다.
진료 전 questions·briefing은 검증 ready 결과를 허용 범위에 바로 제공한다. 진료 후 record는 POST share 확정 후에만 가족에게 공개한다. GET와 scope 변경은 AI를 부르지 않는다.
.env.example은 로컬 SQLite·업로드 경로와 fixture/live 모드·기존 Transcribe staging 버킷 설정을 제공한다. 실제 .env·DB·업로드는 Git에서 제외한다.
구현목록: [tasks.md](../../specs/001-baton-mvp/tasks.md).

## 텍스트 provider 설정

기본은 `LLM_MODE=fixture`, `STT_MODE=fixture`, `LLM_PROVIDER=openai`다. fixture에서는 키 없이 동작하고 외부 호출이 없다. live OpenAI는 `apps/api/.env`에 사용자가 `OPENAI_API_KEY`를 직접 입력하고 `OPENAI_MODEL`을 지정해야 한다. 키를 채팅·로그·Git·VITE_*에 넣지 않는다. 예시 모델 `gpt-4.1-mini-2025-04-14`는 공식 문서상 Responses/구조화 출력 지원 snapshot이며 계정 사용 권한은 별도 확인한다. 모델을 바꾸면 해당 지원도 확인해야 한다.

실제 연결 확인은 저장/공유 없이 가상 질문 하나를 보내며 fallback을 금지한다. 저장소 루트에서 다음 명령을 실행한다(키는 명령에 넣지 않는다).

```bash
LLM_PROVIDER=openai LLM_MODE=live LIVE_FALLBACK_TO_FIXTURE=false node --import tsx scripts/check-openai.ts
```

성공 출력은 provider/model/mode=live/state=ready/persisted=false뿐이다. 설정 누락·거부·불완전·검증 실패는 exit 1이며 성공으로 표시하지 않는다. 이번 구현에서는 키·모델 미설정으로 실제 호출을 하지 않았다. `LLM_PROVIDER=bedrock`는 기존 Bedrock live 구현을 선택하며 STT_MODE와 독립적이다. 자세한 오류·재시도·미병합 record 의존성은 체크포인트를 확인한다.
