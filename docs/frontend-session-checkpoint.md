# T020 프론트 실제 API·세션 체크포인트

2026-10-09. [이슈 #26](https://github.com/Solquick24/baton-project/issues/26)의 T020만 완료했다. 사용자의 **작업별 중지 요청**에 따라 T026–T029와 이후 Phase를 이어서 수행하지 않는다. 기존 문서 커밋은 `feat/26-phase3-frontend`에 보존하고, 최신 `origin/devlop`의 `97dfc7a`에서 `feat/26-api-session`으로 이번 변경을 분리했다.

## 변경 결과

- Vite의 `/api` → 로컬 Fastify 프록시와 기존 요청·2초 폴링을 재사용했다. 로그인 JWT는 `sessionStorage`에 저장하고 Bearer로 보낸다. 저장소가 막히면 메모리 세션으로 로그인·로그아웃이 동작한다. 세션의 정확한 형태는 공통 `loginResponseSchema`로 확인한다. 브라우저에 role/scope 표를 추가하지 않았다.
- `apps/web/src/app/session.tsx`에 세션과 조회 수명을 모았다. 조회 결과는 활성 컴포넌트에만 유지하며 경로·토큰·조회 revision이 다르면 즉시 숨긴다. 화면 이탈·환자/진료 변경은 요청을 취소하고 임시 입력을 없앤다. 계정 전환·401·로그아웃은 모든 진행 요청과 이전 세션 화면을 제거한다. 늦은 이전 세션의 401이 새 세션을 지우지 못한다.
- `invalidate()` 또는 `baton:invalidate` 이벤트로 활성 조회를 비우고 다시 읽는다. 탭 복귀의 focus/pageshow/visibilitychange에도 재조회하여 외부 scope 변경을 반영한다. 범위 관리 화면의 PUT 연결은 T033/T035에서 이 진입점을 사용한다. 이번 작업으로 T035/T036을 완료 표시하지 않는다.
- JSON이 아닌 프록시 오류·네트워크 오류도 재시도 안내를 표시한다. 실패한 질문 등록의 입력은 유지하며 화면 이탈 시 작업 폴링을 중지한다.
- 실제 제품 서버 코드는 변경하지 않았다. `tests/e2e/server.ts`만 test·fixture·메모리 DB·테스트 endpoint 설정을 강제하고 기존 서버/시드/사전 생성 파이프라인을 실행한다. reset/호출 횟수 endpoint는 이 테스트 진입점에만 있다. 매 테스트 사전 생성은 별도 fixture provider로 실행하고, 호출 횟수는 reset 후 앱에 주입한 provider의 증가량이다. 개발 DB와 업로드를 변경하지 않았다.

## 실제 검증

Node 22.23.2/npm 10.9.8. 추가 의존성·공통 계약·DB 스키마·fixture 변경 없음.

| 명령/검사 | 결과 |
|---|---|
| 구현 전 T020 회귀 3건 | 3 실패: 진료 전환의 입력 잔류, 외부 scope 변경 후 재조회 부재, 비 JSON 오류의 parser 문구 노출 |
| `npm run typecheck` | 세 workspace 및 도구 통과 |
| `npm run build` | 전체 타입검사와 Vite 산출물 통과 |
| `npm run test` 최종 | 15 파일, **185 통과 / 0 실패** |
| `npm run test:e2e` 최종 | 실제 API·Vite 프록시·Chromium, **10 통과 / 0 실패**(T020 9건 + 기존 health 1건) |
| `npm run test:web` | 기존 preview 회귀 **14 통과 / 0 실패** |
| B를 외부 API로 schedule 변경 후 focus 재조회 | schedule 키만, 이전 약/질문 표시 제거, 앱 provider 호출 증가 **0** |
| 배포 번들 표식 검사 8개 | 가상 비밀번호·원본 fixture 표식·preview 계정 endpoint 등 모두 없음 |
| `git diff --check` | 통과 |

최초 브라우저 실행은 sandbox의 tsx IPC 소켓 EPERM으로 시작하지 못해 승인된 환경에서 다시 실행했다. Chromium 1248은 기존 `/tmp`의 공유 라이브러리와 Noto Sans KR fontconfig를 사용했다. 이 환경 파일들은 커밋하지 않았다. 최초 API 검사에서는 브라우저 검사와 함께 실행 중 1건이 5초 timeout(184 통과/1 실패)이었으며 재실행에서는 185건 모두 통과했다. 이 실패를 제품 코드 수정이나 timeout 증가로 감추지 않았다.

## 한계와 다음 작업

- 실제 사용 모드는 **fixture**다. OpenAI/AWS live 호출·자원 생성·배포는 수행하지 않았다. T020 검사에서 생성은 기존 작업 폴링의 취소를 확인하기 위해 저장된 fixture 작업을 재사용한다. 새 입력의 통합/브리핑 성공·blocked UI·GET 10회 검증은 T027–T029에서 별도로 완성한다.
- T020의 요청/세션 검증은 완료했으나 T026–T029의 전체 화면 수용 조건은 미완료다. 범위 관리 프론트 T033–T036, 진료 후 처리, Tier C도 진행하지 않았다. 개발용 어댑터의 B 질문 등록 거부는 그대로 남는다.
- 화면을 떠나거나 세션/조회가 무효화되면 저장 전 임시 질문 입력은 폐기한다. 실패 응답 상태에서 같은 화면에 남아 있는 입력은 보존한다. 토큰은 로컬 데모의 sessionStorage 방식이며 새로운 인증 체계를 도입하지 않았다.

작업 브랜치 push·devlop 대상 PR과 리뷰 단계는 이슈/PR에 실제 결과를 갱신한다. 이번 체크포인트만으로 devlop/main 병합이나 이슈 #26 전체 완료를 뜻하지 않는다.
