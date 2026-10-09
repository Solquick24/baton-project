# Phase 3 OpenAI 실제 연결·생성 검증

2026-10-09. 사용자 요청에 따라 로컬 설정과 실제 질문 통합·브리핑을 검증했다. 초기 검증은 `origin/devlop d525f2d`의 Phase 5 백엔드를 보존해 진행했고, 사용자 검토·게시 승인 후 [이슈 #37](https://github.com/Solquick24/baton-project/issues/37)을 만들었다. `origin/devlop de8b924`에서 `fix/37-live-previsit-integration`을 생성했다. 게시 직전 PR #36이 병합된 최신 `origin/devlop 8318aab`을 fast-forward로 반영한 뒤 검토한 변경을 적용했다. 결정 기록 충돌은 양쪽 내용을 모두 보존해 해결했다. T020 세션·요청 취소·캐시 정리와 PR #36의 API 화면 연결을 그대로 포함하며 작업 브랜치 push 및 `devlop` 대상 PR 제출까지 진행한다. 병합은 별도 리뷰 이후다.

## 설정과 변경

- 실제 키는 Git 제외 `apps/api/.env`에만 있다. `.env.example`에는 키가 없다.
- `LLM_PROVIDER=openai`, `LLM_MODE=live`, `OPENAI_MODEL=gpt-4.1-mini-2025-04-14`, `LIVE_FALLBACK_TO_FIXTURE=false`. 전사는 `STT_MODE=fixture`다.
- 원격의 Phase 5 변경은 최신 기준으로 사용하며 이번 실제 검증 범위는 Phase 3 질문 통합·브리핑이다. 실제 전사·record 생성·공유 live 검증을 완료했다고 주장하지 않는다.
- 최소 연결 점검은 성공했지만 초기 제품 요청은 검증 실패했다. 질문 통합에서 원 질문별 필수 근거가 빠졌고, 브리핑에서는 ID 중복·현재 입력에 없는 원문 참조·출력에 없는 참조 대상이 나타났다.
- `openai.ts`의 지침에 원 질문 관계, 출력 항목 ID와 근거 source ID의 구분을 명시했다. 질문·브리핑 요청에는 기존 검증기의 `sourceCatalog`를 동일 입력에서 계산해 전달한다. 원문 인용과 출처를 모델이 임의로 조립하지 않고 실제 허용 목록에서 고르도록 안내한다.
- `output-validator.ts`는 기존 `sourceCatalog` 함수의 export만 추가했다. 스키마·근거·누출·의료 판단 검사와 실패/blocked 경계는 변경하지 않았다. 원문과 외부 오류 본문은 로그에 남기지 않았다.
- 질문·브리핑 요청의 허용 근거·인용 및 다른 진료과 제외에 대한 회귀 테스트 2개를 추가했다. 계약·DB 스키마·fixture·패키지/lockfile·웹 코드는 변경하지 않았다.
- `tests/e2e/previsit-generation.spec.ts`에 실제 API 기반 fixture E2E를 추가했다. 사전 생성 없이 B 로그인→질문 통합 POST/202→jobs 폴링→결과 표시→브리핑 POST/202→화면 이동·GET을 확인한다. 두 job의 ready·fixture, provider 호출 2회, 진료과 격리와 B의 응답에서 full·state 키 부재를 검사한다. 기존 프론트 공통 파일을 수정하지 않고 최신 devlop에 병합된 PR #36의 API 화면 연결을 그대로 재사용했다.
- `scope.spec.ts`의 별도 보호자 컨텍스트는 고정 5174 주소 대신 현재 테스트 화면의 origin을 사용하게 한 줄 수정했다. 포트를 바꿔 검증할 때 실행 중인 다른 앱을 조회하던 문제를 해결하며 권한 판정과 기대값은 그대로 유지한다.

## 실제 확인 결과

| 확인 | 결과 |
|---|---|
| `scripts/check-openai.ts` | 실제 모델 응답과 저장 전 검증 성공: `provider=openai`, `mode=live`, `state=ready`, `persisted=false` |
| 실제 POST 질문 통합 | job `39eb6688-a839-45f9-9444-216325e8cc5d`: succeeded/live/ready, errorCode=null |
| 실제 POST 브리핑 | job `336046fc-ff59-4d9e-a93a-62aafd0bdc42`: succeeded/live/ready, errorCode=null |
| 실제 GET·SQLite 저장 | 최초 questions version=1/inputVersion=3, briefing version=1/inputVersion=1. 최신 통합 후 재조회에서는 questions version=3/inputVersion=5, briefing version=3/inputVersion=3. 모두 live/ready, stale=false. 재조회는 추가 생성 호출 없이 기존 성공 결과를 확인함 |
| `npm run test` | 최종 8318aab 통합 후 fixture·메모리 SQLite **22파일·247통과/0실패/0skip**. 외부 호출 차단 |
| `npm run build` | 전체 typecheck(API·web·contracts·도구)와 Vite 빌드 통과 |
| 실제 API fixture E2E | 최신 PR #36의 25개와 추가 생성/폴링/조회 검사 1개, **26통과/0실패/0skip**. Fastify·메모리 SQLite·Vite·Chrome 사용 |
| preview E2E | 최신 코드에서 **14통과/0실패**. 실제 API 통합 검사와 별도 |
| 최종 도구 타입 검사 | scope 테스트의 주소 수정 후 `tsc --noEmit -p tsconfig.tools.json` 통과 |
| 실제 Chrome 화면 | 5173 시연 및 5174 실제 API에서 로그인→홈→브리핑 표시 확인, pageerror 0. 이 화면 확인은 추가 생성 호출을 하지 않음 |
| Git | 최신 devlop 기반 이슈별 브랜치, diff check·비밀 제외 확인. push·PR 결과는 이슈 #37 및 연결된 PR에 기록하며 devlop/main 병합은 별도 단계 |

브라우저 검사는 실행 중인 시연 서버와 분리해 API 3201/web 5184/preview 5183을 사용했다. 저장소의 기존 Playwright 설정을 가져오고 port/baseURL·Chrome 실행 경로·결과 폴더만 바꾼 로컬 임시 설정으로 다음을 실행했다. 고정 Node/npm의 PATH를 사용하며 이 임시 설정은 Git 게시 대상이 아니다. 팀의 기본 설정과 검사 명령은 `npm run test:e2e`·`npm run test:web` 그대로다.

```powershell
node node_modules/@playwright/test/cli.js test --config '..\.toolkit-setup\live-phase3-review\api-e2e.config.mts'
node node_modules/@playwright/test/cli.js test --config '..\.toolkit-setup\live-phase3-review\preview.config.mts'
```

초기 병렬 실행에서 API 2건은 5초 timeout으로 실패했고 단독 실행에서 246건 모두 통과했다. 이후 최신 PR #36 통합 후에는 247건 모두 통과했다. 추가 E2E의 첫 기대값은 B에게 `state`가 제공된다고 잘못 가정해 실패했고, 계약대로 `state`·`full` 키 부재 검사로 바로잡았다. 최신 통합의 첫 전체 E2E는 고정 5174 보호자 주소로 다른 서버를 조회해 범위 1건 실패/25건 통과했으며 현재 테스트 origin으로 수정한 뒤 26건 전체가 통과했다. 테스트를 skip하거나 제품 권한 검사를 완화하지 않았다.

한 번의 저장 성공이 임의 입력 전체의 성공이나 의미 안전성을 보장하지 않는다. 초기 실패는 실패 job으로 보존했고 성공 결과로 꾸미지 않았다. 이번 검증은 가상 자료만 사용했다. OpenAI 실제 호출은 수행했으며 AWS 호출·자원 생성·IAM 변경·배포는 하지 않았다. 총 유료 HTTP 호출·토큰·비용은 측정하지 않았다.

## 실행 중인 파일과 재확인

실제 API 화면은 <http://127.0.0.1:5174>, 개발용 시연은 <http://127.0.0.1:5173>이다. 실제 검증은 5174를 사용한다. `patient@baton.demo` / 시드 가상 비밀번호 `baton-demo-2026`로 로그인한다. API 재시작 전에 로그인했다면 다시 로그인한다.

현재 DB는 저장소 상위 `.toolkit-setup/baton-live-20261009-150111/demo.sqlite`이며 `.env`의 SQLITE_PATH에도 이 경로를 설정했다. 기존 fixture 시연 DB를 지우지 않고 별도 DB를 만들었다. 성공 증거는 같은 폴더 `live-verification.json`에 저장했다. 재사용 도구는 저장소 상위 `.toolkit-setup`에 있으며 Git 게시 대상이 아니다.

저장소 루트에서 다음은 저장된 결과만 확인하며 새로운 외부 생성 요청을 하지 않는다.

```powershell
& '..\.toolkit-setup\node-v22.22.0-win-x64\node.exe' '..\.toolkit-setup\Check-BatonLive.mjs'
```

`passed=true`와 questions/briefing의 `mode=live`, `state=ready`, `stale=false`, savedRows를 확인한다. SQLite로도 다음을 조회할 수 있다.

```sql
SELECT section, version, inputVersion, mode, state
FROM block_sets
WHERE visitId = 'v_im_03' AND section IN ('questions', 'briefing');

SELECT kind, status, mode, resultState, errorCode
FROM jobs
WHERE visitId = 'v_im_03'
ORDER BY createdAt DESC;
```

화면에서 새로 생성하려면 홈→가족 질문에서 새로운 가상 질문을 등록하고 **AI로 질문 정리하기**→**이 질문으로 브리핑 만들기**를 누른다. 개발자 도구 Network에서 POST `/questions/merge`·POST `/briefing`의 202/jobId, GET `/jobs/{jobId}`의 succeeded/live/ready, 최종 GET 결과의 live를 확인한다. 초기 연결 실패나 검증 실패는 생성 실패로 표시돼야 한다. 같은 입력 버전의 성공 작업은 재사용하므로 버튼을 다시 누르는 것만으로 새 유료 호출이 발생하지 않을 수 있다. 새 입력의 생성 요청은 실제 OpenAI를 호출한다.

API를 같은 DB로 재시작하려면 저장소 루트에서 아래를 실행한다. 이 스크립트는 이번 세션의 로컬 상태 파일을 사용하며 기존 웹 프로세스는 유지한다.

```powershell
& '..\.toolkit-setup\Start-BatonLive.ps1'
```

정책·설정 근거: [PR #36 API 통합 기록](api-integration-checkpoint.md), [기존 provider 기록](openai-provider-checkpoint.md), [Phase 3 API](phase3-backend-checkpoint.md), [공식 모델 기능](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [결정 기록](decisions.md).
