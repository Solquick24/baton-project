# 프론트–백엔드 API 통합 체크포인트

2026-10-09, [이슈 #32](https://github.com/Solquick24/baton-project/issues/32). 사용자가 부른 “Phase 6 API 연동”은 **기존 기능의 통합 작업**이다. tasks.md Phase 6(T048~T051) 전체 구현·완료를 뜻하지 않는다.

## 보존과 기준

- 시작 브랜치 `feat/17-phase5-backend`는 미커밋 변경이 없었다. PR #22는 `devlop`에 병합된 `d525f2d`이며 이 커밋에서 `feat/32-api-integration`을 만들었다. 원격 이름은 `devlop`이고 `develop` 브랜치를 만들지 않았다.
- 다른 CLI의 T020 [PR #31](https://github.com/Solquick24/baton-project/pull/31), `c59ee0e`를 새 브랜치의 `b9fc3d9`로 보존 병합했다. README/decisions 충돌은 Phase 5·OpenAI와 T020 기록을 함께 보존했다. 원본 작업 브랜치·PR은 수정하지 않았다.
- 최종 fetch에서 원격 PR #31 브랜치가 `d878624`로 갱신됐다. 이는 같은 Phase 5 병합본을 T020에 통합한 커밋이며 웹 세션 코드의 추가 변경은 없다. `origin/devlop`은 여전히 `d525f2d`다. 이번 브랜치는 기존 T020 커밋을 포함하므로 제출 시 PR #31 선행/포함 관계를 확인해야 한다.
- 루트/앱 AGENTS, 명세 읽기 순서·우선순위, contracts, seed-story, dataset-integration, 최근 체크포인트와 결정 기록을 확인했다. requirements 체크리스트는 16/16이며 수정하지 않았다. `.specify/extensions.yml`은 없어 전후 hook은 없다.
- Phase 3·4·5의 실제 등록 handler와 기존 저장/권한/provider/검증기를 재사용했다. 제품 백엔드 결함 수정·새 endpoint·공통 계약·DB 스키마·패키지/lockfile·fixture 변경은 필요하지 않았다.

## 구현·완료 ID

| ID | 연결 및 실제 확인 |
|---|---|
| T020 | PR #31 세션·요청 취소·401/로그아웃/계정·환자·진료 전환 회귀 유지. PUT/multipart/blob 지원 및 탭 간 무효화 확장 |
| T026 | 네 가상 계정의 실제 로그인·로그인 유지·홈·내 기록 빈 상태·진료과 선택. 빠른 선택은 실제 모드에서 이메일만 채우고 비밀번호는 직접 입력 |
| T027 | 실제 질문 등록/작성자/시각, 원 질문 3→통합 2+추가 1·관계·full 근거. jobs 생성/재조회 및 새 질문 뒤 stale·fixture 불일치 실패 |
| T028·T029 | B 변경/질문 우선·390×844 질문 영역 표시, full 근거/금식 null+확인 필요, 진료과 격리·금지 키/원문 버튼 부재·GET10회 AI0 |
| T033·T034 | 실제 members/PUT scope/share-log, 세 범위 항목표·민감 정보 안내. 관리 가능한 응답에만 관리 링크. 타임라인은 서버 허용 블록과 진료과로 표시 |
| T035·T036 | scope 변경 후 재조회·이전 응답 제거·focus/pageshow/visibility 복귀 및 같은 브라우저 탭 storage 무효화. 일반 보호자/위임 꺼진 대표 PUT403·C 일정만·scope3회 AI0 |
| T045 | 실제 record-input/audio/transcribe/notes/structure/jobs/draft/share. 진행/실패/재시도·fixture 배지·검토 버전·명시적 공유·blocked/stale 거부 |
| T046 | full alerts 목록/상세/두 근거/차이/현재 canResolve, edit_note·재비교·확인 예정·이력. 재등록은 안내만 남기며 실제 사진 업로드를 구현하지 않음 |
| T047 | 브라우저 입력→정리→검토→공유와 API의 공유 전 비공개, 허용 조회, blocked 우회·stale·권한 철회 거부, 중복/네트워크 재전송·이전 공유본 유지·생성 실패 재시도 |

화면은 `src/app/App.tsx`의 기존 로그인/홈/질문/브리핑/타임라인을 재사용하고 새 연결은 `features/settings/SharingPage.tsx`, `features/visit/VisitPage.tsx`, `features/alerts/AlertsPage.tsx`에 있다. 공통 표시·인증된 원문 파일 처리는 `components/ui.tsx`, 변경/폴링 수명은 `lib/use-action.ts`와 기존 session/api에 둔다. tasks.md의 예시 파일명과 실제 배치 차이는 이 연결표를 따른다.

## 통신·캐시·공개 규칙

- 브라우저는 `/api`만 호출한다. Vite 기본 모드는 실제 Fastify 프록시다. `dev:preview`는 서버 측 개발용 응답의 기존 시연 모드로 보존하며, 진료 후 새 연결의 완료 근거로 사용하지 않는다. 앱 브라우저 코드에서 fixture 파일·OpenAI/AWS·키·scope→kind 표를 읽지 않는다.
- 사용자·환자·진료·view·진료과·revision별 컴포넌트 응답만 유지한다. 401/로그아웃/세션 전환·화면 이탈 때 이전 요청/폴링을 취소하고 오래된 응답의 반영을 차단한다. scope/share 성공은 활성 응답을 무효화한다. 다른 탭에는 무작위 UUID만 localStorage로 알리고 이름·scope·환자/진료 데이터는 전달하지 않는다. 다른 브라우저/기기의 변경은 다음 조회·탭 복귀 시 반영되며 push 실시간 동기화를 새로 만들지는 않았다.
- notes/transcribe 성공 뒤 record-input을 다시 읽는다. structure는 그 버전으로 요청하고 2초 jobs 폴링 후 실제 draft를 조회한다. 질문/브리핑도 POST 후 폴링·재조회한다. GET/화면 이동/scope 변경으로 생성 POST를 보내지 않는다.
- share는 **검토본의** draftVersion/inputVersion과 UUID를 보낸다. 네트워크 결과 불명 시 같은 본문/키를 유지한다. 409는 재조회·재검토가 필요하며 자동 공유하지 않는다. 현재 권한이 사라지면 이전 상세를 제거한다. 보류된 낮은 블록·full 원문·범위 정보는 서버 응답에서 부재이고 UI도 만들지 않는다.
- 원문 파일은 full.transcript.uploadId가 있을 때만 Bearer fetch로 읽는다. 서버 파일 경로/인증 없는 URL을 쓰지 않는다. blob URL은 재조회/권한 변경/화면 이탈 때 해제한다.
- 단순 needsCheck/null·일반 불일치와 blocked를 구분한다. AI 결과의 상태/모드는 서버 저장값을 따른다. 문자열/근거 휴리스틱이 의미적 정확성·재서술 차단을 완전히 보장한다는 주장은 하지 않는다.

## 실제 검사 결과

Node 22.22.0/npm 10.9.8과 기존 고정 버전 사용. 자동 API 검사는 fixture·메모리/분리 임시 SQLite이며 전역 fetch/AWS send 차단, OpenAI 테스트만 transport를 명시적으로 mock한다. 브라우저 서버는 `.env`를 로드하지 않고 fixture/test/메모리 DB를 강제한다. 원래 개발 DB를 seed하거나 덮어쓰지 않았다.

| 명령/검사 | 실제 결과 |
|---|---|
| 변경 전 `npm run test` | 21 파일 **244 통과 / 0 실패 / 0 skip** |
| 신규 브라우저 red `npm run test:e2e -- --grep core --max-failures=3` | record-link 부재로 **1 실패**, 다음 alerts-link 사례는 중단(1 interrupted), scope 사례는 미실행. 3개 실패로 세지 않음 |
| 최종 `npm run test` | 22 파일 **245 통과 / 0 실패 / 0 skip**. 기존 질문/브리핑/pregenerate, Bedrock/fixture/OpenAI, 권한/kind SELECT, 공유/안전/불일치 회귀 포함 |
| `npm run typecheck` | API·web·contracts·도구 통과 |
| 최종 `npm run build` | 전체 타입 검사 및 Vite 실제 산출물 생성 통과 |
| 최종 `npm run test:e2e` | 실제 Fastify·SQLite·Vite·Chromium **25 통과 / 0 실패 / 0 skip**. handoff4, scope3, review-share8, 기존 session9, health1 |
| 최종 `npm run test:web` | 개발용 preview 회귀 **14 통과 / 0 실패**. 제품 API 통합 검사와 별도 |
| 조회·scope | 브라우저/API GET10회·scope3회 provider 증가 0. 생성 입력의 다른 진료과 제외·비공개 메모 제외는 기존 API 회귀에서 유지 |
| 빌드/비밀 검사 | .env·DB·uploads Git 제외. 브라우저 산출물에 가상 비밀번호/preview 계정 endpoint/fixture 경로/OpenAI key 변수·endpoint 없음 |

초기 브라우저 실행은 sandbox의 tsx IPC EPERM으로 **테스트 시작 전** 실패했고 로컬 서버 실행 승인 후 진행했다. 최초 신규 scope 검사 1건은 테스트가 이전 `/home?…` URL만 기다려 timeout됐으며 진료과 생략 주소도 인식하게 수정해 통과했다. preview 초기 결과는 13통과/1실패였고 공통 오류 문구 변경이 원인이었다. preview의 저장 예시 부재 안내를 보존하고 실제 API의 ai_unavailable은 live 인증/요청 실패도 가능하므로 성공 또는 fixture 부재로 단정하지 않는 안내로 유지했다. 최종 미해결 실패는 없다. 기존 코드의 알려진 failing test를 숨기거나 skip하지 않았다.

## OpenAI와 STT: 각각의 결과

- **OpenAI 코드·모의 통합 검증 완료 / 실제 외부 호출 미실시.** 기존 `LLM_PROVIDER=openai|bedrock`, `RawLLMProvider`/`validatedLLM`/저장 전 안전 검증을 그대로 유지했다. 새 OpenAI 통합 API 테스트는 선택된 app provider로 질문→브리핑→record의 3회 모의 Responses 요청→동일 검증→ready 저장→검토→share→허용 조회를 실행했다. 모의 Job의 mode=live를 실제 호출 성공으로 세지 않는다. 기존 35개 OpenAI 검사와 record 혼입 blocked 검사도 통과했다.
- [공식 OpenAI documentation의 Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)와 [Responses migration](https://developers.openai.com/api/docs/guides/migrate-to-responses)을 다시 열어 기존 strict text.format/store:false 구조와 대조했다. 거부·불완전 출력·잘못된 JSON·시간 초과·인증/요청 제한·최대1회 형식 재시도·fallback 모드·키 비노출 회귀를 유지했다. 구조화 형식 보장은 근거/의미 안전 보장이 아니다.
- 서버의 실제 환경은 비밀값 출력 없이 존재 여부만 확인했으며 **OPENAI_API_KEY=false, OPENAI_MODEL=false**다. 키/모델 누락으로 실제 요청은 0회다. 사용자는 `apps/api/.env`에 두 변수만 직접 채워야 하며 채팅·로그·Git·프론트 VITE_*에 넣지 않는다. 모델 ID/계정 권한은 아직 확인하지 않았다.
- 실제 연결 확인은 준비 뒤 `LLM_PROVIDER=openai LLM_MODE=live STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false node --import tsx scripts/check-openai.ts`로 명시적으로 실행한다. 기존 스크립트가 최소 가상 질문·동일 검증을 수행하며 DB 저장/공유/AWS 호출은 없다. 지금 이를 성공했다고 보고하지 않는다.
- **STT는 기존 Amazon Transcribe 선택 구조 유지 / 실제 사용은 fixture.** 브라우저의 가상 바이트 업로드→FixtureTranscription→구간 검증→저장/버전 증가·mode=fixture까지 통과했다. 기존 SDK 모의 테스트도 통과했지만 실제 음성 파일 인식·AWS 전사·정확도·staging 정리는 미검증이다. 실제 AWS 호출은 0회다.

## 실행과 남은 작업

루트에서 고정 Node/npm PATH를 사용한다. 실제 API 시연은 기존 DB를 보존하려면 새 임시 경로를 골라 실행한다. 같은 임시 경로를 다시 seed하면 **그 임시 DB는 초기화**되므로 재사용 여부를 확인한다. JWT_SECRET은 기존 서버 `.env`에 유지하며 출력하지 않는다.

```bash
# 실제 개발 DB 대신 별도 가상 시연 DB
LLM_MODE=fixture STT_MODE=fixture npm run seed -- --pregenerate --database /private/tmp/baton-integration-demo.sqlite
SQLITE_PATH=/private/tmp/baton-integration-demo.sqlite UPLOAD_DIR=/private/tmp/baton-integration-demo-uploads LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false npm run dev

npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:web
```

위 시연 준비 명령은 안내이며 이번 검증 중 개발 DB에 실행하지 않았다. 브라우저에서 가상 계정 버튼은 이메일만 선택하고 시드의 가상 시연 비밀번호는 직접 입력한다. 질문을 새로 추가한 뒤 기존 fixture가 그 질문을 포함하지 않으면 통합이 실패하는 것은 실제 검증 결과이며 임의의 성공 응답으로 대체하지 않는다. 새로운 fixture 제작이나 live 제공자의 의미적 정확성 평가는 별도다.

완료 표시: T020(재사용/회귀), T026~T029, T033~T036, T045~T047. **T048~T051·Tier C·최종 평가/전체 리허설 작업은 체크하지 않는다.** 정적 병원 API/안내, 문서 실제 재업로드, 직접 녹음, 비공개 메모 등 독립 신규 기능은 추가하지 않았다. OpenAI key/model·계정 사용 가능 여부/실제 호출, 실제 STT는 남아 있다.

사용자의 이번 종료 지시는 **검증 후 커밋 체크포인트**다. 작업 브랜치에서 커밋하고 멈추며 이번 변경을 push/PR 생성/병합하지 않는다. devlop/main 직접 push, AWS 자원 생성·IAM 변경·배포 없음. 결과는 이슈 #32에 기록한다.
