# 화면 정의(1단계 구현 대상)

**상태**: 2026-10-09 명세 보완. 최종 기획안 7장(와이어프레임 v6)의 화면 번호를 그대로 쓰고, 구현에 필요한 경로·API·범위별 표시·테스트 ID를 정리했다.
tasks·quickstart의 "25-2", "19번" 같은 번호는 이 표를 가리킨다. 와이어프레임 원본은 claude.ai 아티팩트라 구현 에이전트가 열 수 없다고 가정하고, 이 문서만으로 만들 수 있게 적었다.

## 공통 규칙

- 모바일 390px 기준, 하단 탭 3개: **홈 · 타임라인 · 설정**. 상단에 기록 주인 칩과 `가상 데이터` 배지를 항상 표시한다.
- 서비스명 표기는 **바통**(부제 '진료 동행 노트').
- 범위 밖 내용은 **처음부터 없는 것처럼** 그린다. 잠금 아이콘·'권한 없음'·'숨김 N개'·흐린 카드 금지. 화면은 응답에 블록 키가 있는지로만 판단하고, 범위 이름으로 분기하지 않는다(응답에 본인 범위 이름이 없다).
- `needsCheck=true` 항목은 값 옆에 `확인 필요` 배지(글자 + 아이콘, 색만으로 구분 금지). 값이 `null`이면 '기록에 없어요'로 표시하고 값을 지어내지 않는다.
- AI 결과 영역에는 출처 배지를 붙인다: `mode=live` → '실시간 AI', `mode=fixture` → '저장된 결과'.
- 작업 진행: '정리하는 중…'(문구 + 스피너) → 실패 시 '정리하지 못했어요' + '다시 시도'. 실패를 완료처럼 표시하지 않는다.
- 글씨 3단계(`normal` 18px · `large` 22px · `extra-large` 26px 기준 본문)와 고대비(흰 배경 #FFFFFF, 검은 글자 #000000, 진한 청록 강조 #00695C, 3px 검은 테두리)를 모든 화면에 적용. 터치 영역 최소 48×48px. 다크 모드로 대체하지 않는다.
- 사용자 문구는 '환자 · 보호자', 쉬운 말. 의료 판단 문구를 화면에서 새로 만들지 않는다.

## 화면 목록

| 번호 | 웹 경로 | 기능 | 호출 API | 단계 |
|---|---|---|---|---|
| 01 | `/login` | 이메일·비밀번호 로그인. 시연용 계정 빠른 선택 4개(환자·A·B·C). '가입하기'·'비밀번호 찾기'는 화면만(US6) | POST /auth/login | 1단계 |
| 02 | `/p/:pid` | 홈·가족 기록 | GET /me/patients, GET /home | 1단계 |
| 03 | `/me` | 홈·내 기록 빈 화면(일정 등록·문서 올리기·가족 초대 버튼은 화면만) | GET /me/patients | 1단계 |
| 04 | `/p/:pid` | 02와 같은 컴포넌트. 일정만 받은 경우의 모습 | GET /home | 1단계 |
| 08 | `/p/:pid/visits/:vid/questions` | 가족 질문 등록·AI 정리 | GET·POST questions, POST questions/merge, GET jobs | 1단계 |
| 09 | `/p/:pid/visits/:vid/briefing` | 진료 전 브리핑 | POST·GET briefing, GET jobs | 1단계 |
| 10·11 | `/hospital/:hid` | 병원 위치(정적 지도 SVG)·원내 약도(정적 SVG)·안내 순서·경험 메모(더미). 탭 2개 | GET /hospitals/:hid | 정적 |
| 15 | `/p/:pid/visits/:vid/record` | 가상 음성 파일 올리기→변환, 메모, 정리하기 | POST audio, transcribe, notes, structure, GET jobs | 1단계 |
| 18 | `/p/:pid/visits/:vid/review` | 진료 후 정리 검토·공유하기 | GET visit?view=draft, POST share | 1단계 |
| 19 | `/p/:pid/alerts/:aid` | 정보 바로잡기(메모 vs 약봉투) | GET alerts, POST alerts/:aid/resolve | 1단계 |
| 21·23·23-1 | `/p/:pid/timeline` | 진료과별 타임라인(범위에 따라 모양이 달라짐) | GET /timeline | 1단계 |
| 25 | `/settings` | 글씨·고대비·로그아웃, 가족별 공유 범위 목록(환자·위임 대표만) | GET members | 1단계 |
| 25-2 | `/p/:pid/sharing/:uid` | 보호자별 범위 바꾸기·항목표·공유 기록 | GET members, PUT scope, GET share-log | 1단계 |
| 01-1·06·07 | `/preview/consent` 등 | 동의·가족 초대·일정 등록 화면만 | 없음 | US6, 선택 |

화면 14·22·24·12·13·16·17·20·26~29는 1단계 구현 대상이 아니다.

## 화면별 상세

### 01 로그인
- 실패 시 '이메일 또는 비밀번호를 확인해 주세요'(어느 쪽이 틀렸는지 구분하지 않음).
- 로그인 후: 연결된 환자가 있으면 첫 환자의 02, 환자 계정이면 자기 기록 02.
- testid: `login-email`, `login-password`, `login-submit`, `quick-login-<patient|a|b|c>`.

### 02 · 04 홈
- 기록 주인 칩: `나`(→03) · 연결된 환자 이름들. 진료과 필터 칩(`depts`).
- **다음 진료 카드**(`nextVisit.meta`): 진료과, 날짜·시간, 병원, 이번 동행자. '병원 위치·약도'(→10·11)는 모두에게.
  - `briefingReady` 키가 있을 때만 '진료 전 브리핑 보기'(→09)와 '가족 질문 N개'(→08), '진료 기록하기'(→15).
- **확인 필요 카드**: `openAlertCount` 키가 있을 때만(→19).
- **지난 기록**: `recent[]`를 진료과별로. 카드 내용은 받은 블록만(schedule만이면 날짜·병원·다음 일정만).
- 완료 기준: A 로그인 시 확인 필요 1건, C 로그인 시 브리핑·질문·약 정보가 화면과 응답 모두에 없음.
- testid: `next-visit-card`, `briefing-link`, `questions-link`, `alert-card`, `recent-visit-<vid>`.

### 08 가족 질문
- 질문 입력(1~200자) + 등록. 등록된 질문 목록(작성자 이름·시각).
- 'AI로 질문 정리하기' → 작업 진행 → 통합 질문 목록: 합친 원 질문 번호 표시(예: '질문 1·2를 합쳤어요'), `addedByAI`는 'AI가 추가' 배지.
  - `merged.blocks.full`이 있을 때만 AI 추가 질문 아래 '근거 보기'(basisRefs 인용).
  - `merged.stale=true`면 '새 질문이 있어요. 다시 정리할까요?'.
- '이 질문으로 브리핑 만들기' → POST briefing → 09로 이동.
- testid: `question-input`, `question-submit`, `merge-button`, `merged-question-<id>`, `ai-added-badge`, `basis-<id>`.

### 09 진료 전 브리핑(데모 핵심)
- 순서: **바뀐 점**(`briefing.changes`) → **오늘 물어볼 질문**(`questions`) → (full만) **지켜볼 증상**·**먼저 받을 검사**·**준비사항** → 병원 동선 미리보기(정적 약도 썸네일) → '진료 기록 시작'(→15).
- full 블록이 있으면 바뀐 점 각 항목 아래 이유(`changeReasons`)와 '원문 보기'(sourceRefs 인용 펼치기). full이 없으면 이 버튼을 **만들지 않는다**.
- 준비사항 `text=null` → '기록에 없어요 · 확인 필요'.
- 30초 안에 읽히게: 바뀐 점과 질문을 첫 화면(스크롤 없이 390×844)에 둔다.
- testid: `briefing-changes`, `change-<id>`, `briefing-questions`, `briefing-watch`, `briefing-tests`, `briefing-prep`, `source-button-<itemId>`.

### 10 · 11 병원 위치 · 약도(정적)
- 탭 '병원 위치': `map.svg`(가상 지도 그림, 병원 핀), 주소(복사 버튼), 전화(`tel:` 링크). 길찾기·경로 버튼 없음.
- 탭 '원내 약도': `floor.svg`(번호 경로가 그려진 그림), `guideSteps` 순서 목록, 다른 이용자 경험(더미) + '참고용 정보' 안내.
- 외부 지도 SDK는 쓰지 않는다(키 확인 전). testid: `hospital-map`, `hospital-floor`, `guide-steps`.

### 15 진료 기록(1단계: 파일 업로드)
- 상단 안내: '준비한 진료 음성 파일을 올리면 글자로 바꿔요'. 녹음 허용이 꺼져 있으면 업로드 버튼 비활성 + 문구.
- 파일 선택 → 업로드 → '글자로 바꾸기'(작업 진행). 결과 화면에는 '변환 완료'와 출처 배지만 보이고 **전사 원문은 full 블록이 있는 정리 결과에서만** 본다.
- 메모 입력·저장(여러 번 가능). 저장하면 '메모 N개 저장됨'.
- 오늘 물어볼 질문 체크 목록(브리핑 질문, 체크 상태는 화면 상태만, 저장은 2단계).
- '정리하기' → POST structure(현재 inputVersion) → 작업 진행 → 18로 이동.
- testid: `audio-input`, `transcribe-button`, `note-input`, `note-save`, `structure-button`, `job-status`.

### 18 진료 후 정리 검토 · 공유
- `view=draft`로 읽는다. 받은 블록만 표시:
  - schedule: 다음 일정.
  - companion: 약 변경(이전 → 이후, 주의사항), 쉬운 말 요약.
  - full: 진단·검사 수치(민감 정보 배지), 의사 주요 설명, 약 변경 이유, 가족 질문 답변(없으면 '기록에 없어요'), 원문 인용·음성 원본 열기.
- 확인 필요 섹션: needsCheck 항목 목록. full이면 열린 불일치(→19) 링크.
- `state=blocked`: '가족에게 보이면 안 되는 내용이 섞였을 수 있어요. 다시 정리해 주세요.' + 걸린 항목 강조(문자열은 보여주지 않음). 공유 버튼 비활성.
- `state=ready && shareable`: '가족에게 공유하기' → 확인 대화상자('허용된 가족에게 이 정리가 보여요') → POST share(idempotencyKey=UUID) → '공유했어요'.
- 공유 전에는 다른 가족의 타임라인에 이 진료 정리가 없다(일정만 meta).
- testid: `review-state`, `review-blocked`, `share-button`, `share-confirm`, `draft-full-section`.

### 19 정보 바로잡기
- full 계정만 진입. 두 근거를 나란히(가족 메모 인용 · 약봉투 인용), 다른 점 한 줄(`summary`), 상태 배지.
- 처리 3가지: '메모 고치기'(약·복용 시간 칩·용량 입력 → edit_note), '사진 다시 올리기'(안내만, 2단계 표시), '병원에 확인할게요'(confirm_hospital).
- 처리 이력 목록. AI가 어느 쪽이 맞는지 말하는 문구 금지.
- testid: `alert-left`, `alert-right`, `alert-summary`, `resolve-edit`, `resolve-reupload`, `resolve-hospital`.

### 21 · 23 · 23-1 타임라인
- 진료과 필터 필수(기본: 첫 진료과). 다른 과 기록이 섞이지 않는다.
- 카드: meta(날짜·과·병원·동행자) + 받은 블록:
  - schedule만(23): 진료일과 다음 일정만.
  - companion까지(23-1): 약 변경·주의사항·쉬운 요약·다음 일정.
  - full(21): 위 + 진단·검사·이유·답변·원문 보기.
- testid: `timeline-dept-<dept>`, `timeline-card-<vid>`.

### 25 설정
- 화면 보기: 글씨 크기 3단계 라디오, 고대비 스위치(localStorage `baton.display`에 저장, 실패해도 기본값으로 동작).
- 가족별 공유 범위: `GET members`가 200일 때만 섹션 표시(환자·위임 대표). 일반 보호자에게는 섹션 자체가 없다. '민감 정보는 전체 내용에서만 보여요' 안내.
- 로그아웃. 위임·녹음 허용·알림·언어는 '준비 중' 항목(화면만).
- testid: `font-size-<normal|large|extra-large>`, `high-contrast`, `sharing-member-<uid>`, `logout`.

### 25-2 공개 범위 바꾸기
- 세 단계 라디오(일정만 · 동행 · 전체 내용, 전체 내용에 '민감 정보 포함' 배지) + 범위별 보이는 항목표(spec.md 허용표와 같은 내용).
- 저장 → PUT scope → '바로 반영됐어요'. AI를 부르지 않는다.
- 공유 기록 목록(누가 · 언제 · 이전 → 이후). '공유 멈추기'는 2단계라 표시하지 않는다.
- testid: `scope-<schedule|companion|full>`, `scope-save`, `share-log`.
