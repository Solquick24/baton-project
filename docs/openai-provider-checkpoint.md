# OpenAI 텍스트 provider 체크포인트

2026-10-09, 작업 이슈 [#23](https://github.com/Solquick24/baton-project/issues/23). 사용자 결정 **“텍스트 생성 AI를 Bedrock 대신 OpenAI API로 사용”**을 기존 'AI만 AWS' 방향의 변경 근거로 적용했다. 질문 통합·브리핑·record 텍스트만 대상이며 음성 전사 provider·STT_MODE는 변경하지 않았다. 권한·가상 자료·근거 검증·검토 후 공유 원칙도 유지한다.

## 브랜치와 의존성

- 기존 Phase 5 `feat/17-phase5-backend`의 `7a7b452`는 미커밋 변경이 없고 원격 커밋과 일치했다. [PR #22](https://github.com/Solquick24/baton-project/pull/22)는 OPEN/draft로 보존했다. 새 작업에서 해당 브랜치에 커밋·push하지 않았다.
- 최신 `origin/devlop=b3fa963`에서 `feat/23-openai-provider`를 만들었다. Phase 5 변경을 이 브랜치에 병합하거나 복사하지 않았다. 공통 계약·DB·패키지/lockfile·apps/web·fixtures를 변경하지 않았다.
- 질문·브리핑 파이프라인과 record RawLLMProvider/스키마는 devlop 기반에서 재사용한다. **record 실제 생성/저장 worker와 record 안전 검증은 미병합 PR #22에 의존한다.** OpenAI provider 추가가 미구현 POST structure/share를 완성하지 않는다.
- 별도 detached 임시 worktree `/private/tmp/baton-openai-record-23`에 보존된 Phase 5 `7a7b452`와 OpenAI 코드 커밋 `f757ee0`만 조합했다. 앱 factory 병합은 충돌 없이 적용됐다. 원본 Phase 5와 OpenAI 작업 브랜치에 이 조합을 되돌려 넣지 않았다.

## 공식 문서와 모델 확인

공식 OpenAI documentation을 검색한 뒤 실제 페이지를 열어 확인했다. API reference 일부 URL은 도구 fetch 오류가 있어 공식 guide의 Responses 요청 예시와 아래 모델 페이지를 함께 사용했다.

- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): Responses의 `text.format=json_schema`, strict 형식, 거부·불완전 응답, 지원 스키마 subset과 required 규칙 확인.
- [Responses migration](https://developers.openai.com/api/docs/guides/migrate-to-responses): Responses 사용과 `store:false` 설정 확인.
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini): `gpt-4.1-mini-2025-04-14` snapshot 및 Responses/구조화 출력 지원 확인. 최신/최선 모델이라고 추천하거나 **이 계정에서 사용 가능하다고 확인한 것은 아니다.**

예시 모델 ID는 `.env.example`에 명시하고 런타임의 암묵적 모델 기본값은 두지 않았다. 모델 변경은 설정으로 가능하지만 Responses와 Structured Outputs 지원·계정 접근을 다시 확인해야 한다. 모델별 미지원 가능성이 있는 temperature/top_p/reasoning 옵션은 보내지 않는다.

## 구현

- 추가 `OpenAILLM implements RawLLMProvider`, `mode='live'`. 기존 `validatedLLM`을 바꾸지 않고 재사용한다. Node 22 fetch를 사용해 새 SDK나 패키지를 추가하지 않았다. Bedrock/fixture 코드는 보존했다.
- 고정 공식 endpoint `POST https://api.openai.com/v1/responses`, `store:false`, 30초 AbortSignal, redirect:error, strict `text.format`, `max_output_tokens=8192`. 외부 도구·conversation·previous_response_id·background 처리를 추가하지 않는다. 전송 내용은 기존 내부 입력 repository가 선별한 가상 자료뿐이다.
- 기존 Zod 스키마에서 요청용 JSON schema를 만든다. SourceRef의 구별되는 type discriminator union을 oneOf→anyOf, const→동일한 단일 enum, 양의 integer 최소값을 동등한 minimum으로 변환하고 `$schema` annotation을 뺀다. nullable을 유지하며 optional 키를 임의로 required+null로 바꾸지 않는다. 추후 optional 생성 필드가 생기면 자동 의미 변경 대신 validation_failed로 중단해 명시적으로 처리해야 한다.
- 권위 있는 서버 Zod 검사·항목 ID 유일성·파이프라인의 근거/혼입/의료 판단 검증은 그대로 남는다. API 형식 준수는 의미 안전성의 보장이 아니다. 거부/불완전/잘못된 JSON/외부 오류가 저장 전 검증을 우회해 ready가 되지 않는다.
- API 출력에서 완성된 assistant message 한 개·output_text 한 개만 허용한다. reasoning 항목은 사용하지 않고 도구 호출·복수 메시지·모호한 출력은 성공으로 처리하지 않는다. raw 출력은 저장/로그하지 않는다. 실제 fixture 대체는 mode=fixture, 주입한 OpenAI 모의 성공은 코드상 mode=live이나 실제 live 측정으로 계산하지 않는다.

| 실패 | 기존 안전 처리 |
|---|---|
| HTTP 400/401/403/404/429/5xx, 전송/시간 초과 | ProviderError ai_unavailable. upstream 오류 본문을 읽거나 로그하지 않음, 숨은 네트워크 재시도 없음 |
| refusal, incomplete/content_filter | ProviderError validation_failed. 부분 출력 사용/재시도 없음 |
| malformed HTTP JSON·출력 JSON·스키마·없는/복수 메시지 | undefined 또는 strict 실패 → 기존 validatedLLM의 최대 1회 형식 재시도. 재실패 시 validation_failed |
| fallback=true인 live 실패 | 기존 fixture provider를 같은 입력으로 호출하고 같은 Zod·저장 전 검증을 적용. mode=fixture |
| 모델/키 누락 | live OpenAI 시작 시 누락된 환경 변수 이름만 표시. fixture 성공으로 숨기지 않음 |

## 환경 설정과 실제 점검

| 변수 | 의미 |
|---|---|
| `LLM_PROVIDER=openai` | 새 기본 선택. `bedrock`로 기존 구현 선택 가능. fixture 모드에서는 외부 provider 호출 없음 |
| `LLM_MODE=fixture` | 기존 기본 시연/테스트 모드 유지. 실제 사용은 명시적 live |
| `STT_MODE=fixture` | 기존 의미/기본값 유지. 이번 변경과 독립적 |
| `OPENAI_API_KEY` | 백엔드 전용, 기본 빈 값. 사용자가 **apps/api/.env에 직접 입력** |
| `OPENAI_MODEL` | 백엔드 전용, 런타임 기본 빈 값. `.env.example`의 문서 확인 예시는 `gpt-4.1-mini-2025-04-14` |
| `LIVE_FALLBACK_TO_FIXTURE` | 기존 동작 유지. **실제 연결 확인에서는 false 필수** |

키를 채팅·로그·Git·명령줄·VITE_*로 전달하지 않는다. 실제 `.env`는 읽기 점검에서 변수의 설정 여부만 확인했고 내용을 출력하거나 덮어쓰지 않았다. **이번 확인 당시 OPENAI_API_KEY와 OPENAI_MODEL 모두 미설정이므로 실제 OpenAI 호출은 미실시다.** 모델/키를 설정했다는 사실만으로 연결 성공이라 보고하지 않는다.

키·계정 모델 준비 뒤 저장소 루트에서 아래를 명시적으로 실행한다. JWT_SECRET 등 기존 서버 필수 설정도 `.env`에 유지한다. 이 스크립트는 dev/test/build에서 호출하지 않는다.

```bash
LLM_PROVIDER=openai LLM_MODE=live LIVE_FALLBACK_TO_FIXTURE=false node --import tsx scripts/check-openai.ts
```

수동 점검은 같은 가상 환자/진료과의 가상 질문 한 개만 전송하고 기존 validatedLLM·질문 저장 전 검증을 거친다. DB 저장·공유·fixture 대체·AWS 호출은 없다. 형식 재시도는 최대 1회다. 성공은 provider/model/mode=live/state=ready/persisted=false만 출력한다. 누락 설정이나 검증 실패는 exit 1이다. 그 결과가 있어야 실제 호출 성공으로 별도 기록한다.

## 실제 검증 결과

기존 고정 Node 22.22.0/npm 10.9.8/패키지 조합을 유지했다. 모든 API 테스트는 메모리 SQLite이며 AWS SDK send와 전역 fetch를 차단하고 주입한 응답만 사용한다.

| 검사 | 실제 결과 |
|---|---|
| OpenAI 브랜치 `npm run test` | **13 파일, 154 통과 / 0 실패 / 0 skip**. 기존 devlop 119개 + OpenAI 35개 |
| `npm run typecheck` | API·web·contracts·도구 통과 |
| `npm run build` | 전체 타입 검사 및 Vite 산출물 생성 통과 |
| 임시 Phase 5 조합 전체 API | **18 파일, 188 통과 / 0 실패 / 3 skipped**. 기존 Phase 5 공유 경로 3개는 선행 의존성으로 그대로 skip |
| 임시 OpenAI→record 추가 3개 | 실제 generateRecord/jobs/storage를 이용한 ready·leak blocked·invented quote failed 통과. mode=live는 모의 응답 표시이며 실제 호출 아님 |
| 외부/안전 검사 | 3섹션 요청/nullable/JSON schema, refusal·incomplete·JSON·시간 초과·인증·429·형식 재시도·fallback·키 비노출 통과 |
| 실제 질문/브리핑 API | OpenAI 모의 응답→실제 job→동일 안전 검증→저장/조회, 민감 혼입 blocked·허용 블록만 응답 통과 |
| GET 10회 | 앱 조립 health·실제 briefing 추가 provider 호출 0. 기존 진료과/비공개 입력 제외 회귀 통과 |
| 수동 점검의 설정 누락 preflight | 키·모델을 빈 값으로 고정한 테스트 환경에서 exit 1 및 변수 이름만 표시. 실제 외부 호출 이전 중단 |

scope PUT과 record POST structure/share는 이 기준 devlop에 없으므로 이번 PR에서 새로 구현/완료 처리하지 않았다. 임시 조합의 공유 skip 3개는 OpenAI 오류가 아니라 기존 Phase 5 미완료 의존성이다. 기존 프론트 코드는 바꾸지 않았으며 이번 별도 provider PR에서는 Playwright 화면 검사를 반복 실행하지 않았다.

실제 OpenAI·AWS 호출, AWS 자원 생성·IAM 변경·배포 없음. Bedrock 접근 실패 기록은 보존했다. 새 provider 연결 코드와 모의 검증 완료를 실제 계정 연결 완료로 표현하지 않는다. 작업 브랜치를 push하고 devlop 대상 PR로 제출하며 자동 병합·devlop/main 직접 push는 하지 않는다.
