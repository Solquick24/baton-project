# Quickstart and Validation: 로컬 시연

## 현재 상태

현재는 문서·시드 자료(`fixtures/`)·빈 src·workspace 설정만 있다. 앱·SQLite·로그인·AI·테스트는 미구현이다.
지금 가능한 명령은 workspace 준비·목록 확인뿐이다.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm ls --workspaces --depth=0
```

## 구현 후 준비와 실행

[tasks.md](tasks.md)의 Setup/Foundation이 실제 실행·시드·빌드·테스트 명령을 추가한다. 고정 버전과 명령 정의는 [AGENTS.md](../../AGENTS.md) 6장.
아래 명령은 지금 존재하지 않는 미래 명령이며 해당 작업 완료 후에만 실행한다.

1. Node 22.12+·npm 10.x. better-sqlite3는 `--ignore-scripts` 설치에서도 prebuild로 로드된다(2026-10-09 확인).
2. `cp apps/api/.env.example apps/api/.env` 후 `JWT_SECRET`(32자 이상)만 채우면 fixture 모드로 전부 동작한다.
3. live AI를 쓰려면 `LLM_MODE=live`, 필요하면 `STT_MODE=live`와 `TRANSCRIBE_STAGING_BUCKET`, `AWS_PROFILE`을 채운다. 실제 계정·토큰·비밀번호를 Git에 넣지 않는다.
4. 웹 환경은 `VITE_API_BASE_URL=/api`만 사용한다(Vite가 :3001로 프록시). Cognito·배포 설정은 필요 없다.
5. 처음 e2e를 돌리기 전에 `npx playwright install chromium`.

```bash
# 아래는 tasks의 실행 명령 추가·시드 구현 후 사용
npm run seed                  # DB 초기화 + 시드
npm run seed -- --pregenerate # + v_im_03 질문 통합·브리핑 미리 생성(fixture)
npm run dev                   # API :3001 + web :5173
npm run typecheck
npm run build
npm run test
npm run test:e2e
```

웹과 API는 localhost에서 실행하고 SQLite·uploads(`apps/api/data/`)는 공개 static 밖에 둔다.
SAM·Amplify·CloudFormation 배포는 수행하지 않는다. STT의 임시 버킷은 기존 제공 자원만 사용한다.

## 시연 계정

비밀번호는 모두 `baton-demo-2026`(가상). 상세는 [seed-story.md](seed-story.md).

| 계정 | 이메일 | 범위 |
|---|---|---|
| 환자 박하늘 | patient@baton.demo | 본인(full) |
| A 박지원 | a@baton.demo | full, 대표 보호자, 위임 꺼짐 |
| B 박지후 | b@baton.demo | companion, 이번 첫 동행 |
| C 정다온 | c@baton.demo | schedule |
| 비구성원 | outsider@baton.demo | 테스트 전용 |

## 검증 시나리오

### 이어받기 경로

1. B(companion) 로그인 → 내과 브리핑. 변경·질문만 있고 이유·원문·인용·full 키가 없는지 확인한다.
2. 질문 3개 → 통합 2개 + 추가 1개. 관계·작성자와 needsCheck를 확인한다.
3. 가상 파일 변환·메모·정리 → ready 검토본. 가족의 timeline에 아직 공개되지 않았는지 확인한다.
4. B가 자기 허용 검토 내용을 확인하고 공유하기 → C/A의 다음 조회에 허용 블록만 표시된다.
5. 환자/A로 전환해 메모·약봉투 불일치(화면 19)와 원문을 확인한다. B에게 19번 상세를 공개하지 않는다.
6. 민감 혼입 샘플(메모에 `혼입 시연`)은 blocked이고 공유하기로 우회할 수 없는지 확인한다.

### 범위 경로

1. 환자 로그인 → 화면 25-2에서 B를 schedule/companion/full로 변경하고 공유 기록을 확인한다.
2. B의 다음 조회에서 허용 블록과 화면이 바뀌고 금지 블록 키·잠금·다른 가족 범위가 없는지 확인한다.
3. 일반 B의 scope 변경·비구성원 조회·위임이 꺼진 A의 변경을 직접 호출로 거부하는지 확인한다.
4. GET 10회·scope 3회 동안 AI spy 호출 0회를 확인한다.
5. full에서만 원문·인용·파일을 확인하고 질문·작업·오류·알림 경로도 같은 정책인지 확인한다.

### 공통 품질

가장 큰 글씨·흰 배경 고대비에서 주요 내용·버튼 잘림을 확인한다.
실패·재시작·중복·입력 변경에서 거짓 완료·진료 후 정리의 공유 확정 전 공개가 없는지 확인한다. 진료 전 질문 통합·브리핑은 검증 ready 결과를 허용 범위에 바로 제공한다.
두 경로를 2회 연속 완주하고 SC-001~010 결과·실제 평가 분모·검사 전후 누출률을 기록한다.
실제 호출과 저장 대체 결과, 화면만 동의와 기능 완성을 구분한다.
