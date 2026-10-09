# 샘플 데이터셋 v2.1 연결 기록

2026-10-09에 사용자가 제공한 `Baton_Dataset_v2_1_FINAL_20261008.zip`을 확인했다.
원본 위치는 Windows의 `C:\Users\JANG\Documents\카카오톡 받은 파일\`이며 WSL에서는 `/mnt/c/Users/JANG/Documents/카카오톡 받은 파일/`로 읽는다.
버전은 ZIP 내부 manifest 기준 `2.1.0`이다. 원본 식별 해시와 검사 결과는 [검증 기록](references/baton-dataset-v2.1-inspection.json)에 있다.

이번 반영은 자료 검증·현행 계약 연결표·평가 활용 기준이다. 앱과 DB는 아직 없고, 원본을 실행 시드나 AI fixture로 직접 불러오지 않는다.
활성 자료는 계속 `fixtures/seed/`와 `fixtures/expected/`다. 원본 ZIP·PNG·실제 의약품 사전·MIMIC 사례는 저장소에 복사하지 않았다.
기존 명세·시드·fixture 기대값과 작업 완료 체크를 바꾸지 않았다.

## 확인한 자료

| 자료 | 실제 수량 | 사용 위치 |
|---|---|---|
| 가상 환자의 진료 | 6회 | 과거 기록·날짜 경계 평가 참고 |
| 처방 주문 / 제품 사전 | 19행 / 4제품 | 정 수·시간 비교 시나리오 참고; 실제 제품은 가상 어휘로 다시 작성 |
| 문서 PNG | 14장: 처방전 6·안내문 4·약봉투 4 | 선택적 OCR 평가 참고; 현재 MVP에 원본 업로드하지 않음 |
| 가족 질문 / 관찰 / 메모 | 24 / 10 / 4 | 질문 중복·메모 오류·근거 누락 사례 참고 |
| STT 대본 / 음성 | 5 / **0파일** | 녹음 준비 참고; STT 성공·정확도 측정 불가 |
| 추출 / 불일치 / 의료 판단 / 권한 평가 | 20 / 12 / 12 / 7건 | 아래 계약에 맞춰 재작성한 뒤 평가 |

`extraction_cases.jsonl`의 20건은 텍스트 평가 사례다. 이미지 20장이 아니다.
원본 `validation_report.json`에는 33건 통과와 “이미지 없음”이라는 이전 설명이 남아 있다.
이번에는 ZIP을 직접 읽어 JSON·JSONL 파싱, 시드/원본 일치, ID·참조, 이미지 연결·해시·크기·PNG 시그니처, 평가 개수, 음성 유무 등을 다시 검사해 **25건 통과·0건 실패**를 확인했다.
GUIDE04·BAG01·BAG03은 원본 체크섬 목록의 교체 표시를 확인했다. 픽셀 내용을 새로 육안/OCR 검수한 결과는 아니다.

검사는 외부 의존성 없이 재실행할 수 있다. ZIP 안의 코드 실행이나 압축 해제는 하지 않는다.

```bash
python3 scripts/inspect-dataset.py \
  '/mnt/c/Users/JANG/Documents/카카오톡 받은 파일/Baton_Dataset_v2_1_FINAL_20261008.zip' \
  --report docs/references/baton-dataset-v2.1-inspection.json
```

## 현행 MVP에 연결하는 규칙

| 원본 | 현행 연결 | 적용 기준 |
|---|---|---|
| `seed/patient.json`, `users.json` | `fixtures/seed/accounts.json`, `patient.json` → T010 | 현재 박하늘·A·B·C와 비구성원 유지. 원본 3계정을 가져와 4계정 시연을 줄이지 않음 |
| `seed/permissions.json`, `mock_api/GET_permissions_*` | T011·T012·T030·T031 | 원본 FULL/SCHEDULE_ONLY 정책을 복사하지 않음. 현행 schedule/companion/full과 위임 false를 사용 |
| `seed/encounters.json`, `appointments.json` | `visits.json`·공통 meta | 원본 V01/V02/V03은 1·2·3월 이야기 참고. v_im_01/02/03의 사실·시간은 현행 시드 기준. 정형외과 격리 기록 유지 |
| `medication_orders.json`, `medications_catalog.json` | `prescriptions.json`·record 블록 | 약·질환을 가상 어휘로 다시 작성. 함량과 1회 정 수를 구분. 원본의 2정→1정과 현행 1정→0.5정을 단순 이름 치환으로 합치지 않음 |
| `family/questions.jsonl`, `question_groups_gold.json` | T021·T022·T023 | 현재 질문 3개→통합 2개+추가 1개 기준 유지. 원본 24개/6그룹은 추가 평가 후보. gold는 모델 입력에 넣지 않음 |
| `family/observations.jsonl`, `family_memos.jsonl` | T016·T038·T044 | 원문은 full 전용. 오류를 사실로 교정하지 않고 두 근거·차이·확인 상태 보존 |
| `transcripts/*`, `stt_gold.json` | T039·T040 | 현행 가상 전사 대본으로 녹음. 실제 파일 없으면 fixture 배지. 대본이 있다는 이유로 live STT 성공으로 기록하지 않음 |
| `mock_api/GET_briefing_*`, `GET_timeline.json` | T024·T025·T028·T034 | 화면 참고만. 현행 strict 블록으로 생성·검증·저장한 결과만 응답. 원본 mock 응답 직접 연결 금지 |
| `hospital/*`, `GET_route_*` | T050(Tier B) | 정적 병원·약도·순서 참고. 동선 계산·길찾기 제외. 방문 경험은 참고용이며 공식 안내를 덮어쓰지 않음 |
| `seed/private_notes.json` | 기본 제외; T053은 Tier C | 어떤 AI 입력에도 넣지 않음. 가족 full도 비공개 메모를 읽지 못함 |
| `sources/real_mimic_reference_cases.json` | 사용 제외 | 실제 비식별 사례이므로 가상 데모의 시드·AI 입력·평가 입력으로 가져오지 않음 |
| `images/*`, `evaluation/image_ocr_gold.jsonl` | T057은 Tier C, T065 전체 평가 후보 | 실제 제품명이 인쇄된 원본은 현재 가상 자료 규칙과 맞지 않음. 채택 시 가상 문서·라벨·근거를 함께 새로 작성해야 함 |

원본에는 3월 12일 오후 권한 변경과 이후 4~6월 기록이 있다. 현재 시연 기준일은 `DEMO_TODAY=2026-03-12`다.
3월 진료 전 브리핑 입력에는 3월 진료 결과나 이후 진료 결과를 넣지 않는다. 같은 환자·같은 진료과의 당시 공유된 과거 기록만 사용한다.
원본에 변경 사유가 없거나 다음 처방에서 약이 빠졌다는 사실만 있으면 중단 이유·중단 지시를 만들지 않는다.
새 record는 현행 검토→공유 확정 절차를 따른다. 원본 mock에 들어 있다는 이유로 공유본으로 간주하지 않는다.

## 평가에 활용할 사례

- **MM02·MM03**: 정 수·복용 시간 차이. 가상 약으로 재작성 후 T038·T044의 같은 drugKey 비교에 활용. MM03과 현재 ob_01/rx_im_02는 같은 유형이며 현재 정확한 기대값을 유지한다.
- **MM06**: 서로 다른 말로 같은 정 수를 표현하는 사례. 구조화한 fact가 같으면 불일치가 없어야 한다.
- **MM01·MM04·MM05·MM10**: 약 종류·일정·순서 차이. 현재 Alert 계약의 비교 필드는 dose/timing뿐이므로 추가 탐지 기능이 구현됐다고 계산하지 않는다.
- **MM07·MM08·MM09·MM11·MM12**: 의미 동등성·약 특정 불가·누락·경험/공식 안내 차이·함량 변환 사례. 현재 MVP가 모두 판별한다고 주장하지 않는다. 구조화 추출 또는 별도 평가 후보로 남긴다.
- **GR01~GR12**: 기록 정리 허용과 진단·처방·수치 해석·치료 권고 거부 구분을 T037·T041·T065에 참고한다. 원문 보기 GR09는 full, 검사 준비 GR02는 full에서만 허용한다. 원본 ALLOW는 공개 범위 허용을 뜻하지 않는다.
- **AC01~AC07**: 범위 변경 다음 요청 반영과 비공개 메모 분리 참고. 실제 검증은 현재 계정·API·3범위로 T011·T012·T030을 실행한다. 비공개 메모 API 구현은 명시적으로 요청한 Tier C에서만 한다.
- **EX01~EX20**: 추출 평가 후보. 기대 필드를 `schemas.md`에 맞추고 근거 참조·null/needsCheck를 붙인다. 입력과 gold를 분리하며 평가 정답을 AI 컨텍스트에 넣지 않는다.

평가 수치는 아직 측정하지 않았다. T065 축소판은 기존 fixture 검증 4건·불일치 1건을 사용한다.
추가 평가를 실제 실행하면 별도 데이터셋·사례 ID·분모·live/fixture·제외 이유를 기록한다. 원본 라벨을 읽은 일을 모델 정확도 평가로 계산하지 않는다.

## 다음 실행 순서

1. **지금 시작할 구현은 Phase 1, T001~T007**이다. 고정 버전 설치와 dev/typecheck/build/test 명령을 만들고 로컬 구동·SQLite·AI 접근 결과를 확인한다. 실패한 live 호출은 fixture로 기록한다.
2. Phase 1 체크포인트 보고 후 **Phase 2, T008~T020**에서 계약·DB·현재 시드·권한·provider·jobs를 구현한다. 데이터셋 연결은 위 표를 참고하고 기존 fixture를 먼저 통과시킨다.
3. **T021~T049**로 이어받기→범위 변경→정리·검토·공유→접근성 설정을 완성한다. 두 시연 경로를 우선한다.
4. Tier A 완료 후 **T050·T051·T065 축소판·T066**, 마지막 **T067·T068**에서 리허설과 실측 결과를 기록한다. **T052~T064는 미요청 상태로 둔다.**

구현 시작 지시 예시:

```text
$speckit-implement AGENTS.md와 docs/dataset-integration.md를 읽고
Phase 1(T001~T007)만 구현해줘. 기존 fixtures/seed·expected를 기준으로 삼고,
샘플 ZIP의 API 예시·실제 약·MIMIC 자료를 직접 가져오지 마.
체크포인트에서 실제 검증 결과를 보고하고 멈춰줘. Tier C는 하지 마.
```
