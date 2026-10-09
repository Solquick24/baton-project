# Demo and evaluation fixtures

모든 자료는 가상이다. 실존 환자·음성·문서를 넣지 않는다. 이야기와 범위별 기대값은 [seed-story.md](../specs/001-baton-mvp/seed-story.md), JSON 형태는 [schemas.md](../specs/001-baton-mvp/contracts/schemas.md)를 따른다.

## seed — `npm run seed`가 DB에 넣는 자료

| 파일 | 내용 |
|---|---|
| accounts.json | 환자·A·B·C 4계정 + 테스트 전용 비구성원 1계정, 가상 공통 비밀번호(DB에는 해시만) |
| patient.json | 환자 p_01, 구성원 4명(role·scope), 위임 false·녹음 허용 true, 시드 공유 기록 |
| hospital.json | 가상 병원 1곳의 주소·전화·안내 순서·더미 방문 경험 |
| visits.json | 내과 1·2월, 정형외과 2월(공유됨), 내과 3월 예정(B 동행) |
| records.json | 과거 3개 진료의 공유된 정리 결과(record 섹션 v1, 세 블록 + 전사) |
| questions.json | 3월 진료의 가족 질문 3개 |
| observations.json | 가족 관찰 메모 3개(1단계는 등록 화면 없이 시드 고정) |
| prescriptions.json | 약봉투 값(1단계 시드, 사진 판독은 2단계) |

## expected — fixture provider 응답과 테스트 기대값

| 파일 | 용도 |
|---|---|
| manifest.json | fixture provider가 응답 파일을 고르는 규칙 |
| transcribe/v_im_03.json | 3월 진료 가상 대화 전사(6구간) |
| merge-questions/v_im_03.json | 질문 3개 → 통합 2개 + AI 추가 1개 |
| briefing/v_im_03.json | 3월 내과 브리핑(동행용·전체 내용용 블록) |
| structure/v_im_03.json | 3월 진료 정리(검증 ready) |
| structure/v_im_03.leak.json | 쉬운 요약에 진단명이 섞인 혼입 샘플(검증 blocked) |
| validation.json | 위 4개 파일의 검증 기대 상태·issue |
| alerts.json | seed 코드 비교가 만들어야 하는 불일치 1건 |

## audio · documents

- audio: 가상 음성 파일은 저장소에 없다. [audio/README.md](audio/README.md)의 대본을 팀원이 녹음해 쓰고, 없거나 변환에 실패하면 `expected/transcribe/v_im_03.json`으로 대체하며 화면에 '저장된 결과'로 표시한다.
- documents: 약 20장 모의 문서는 아직 없다(2단계 사진 판독·T065 전체 평가용). 만들기 전까지 평가는 축소판으로 기록한다.

## 제공받은 샘플 데이터셋 v2.1

외부 ZIP의 문서 14장·추출 평가 20건·불일치 12건 등을 확인했다. 음성 파일은 없으며, 추출 사례 20건은 문서 20장을 뜻하지 않는다.
원본은 실제 의약품 정보·별도 MIMIC 참고 사례·2범위 mock 응답을 포함하므로 활성 시드/fixture로 직접 복사하지 않는다.
현재 자료에 연결할 기준과 평가 후보는 [데이터셋 연결 기록](../docs/dataset-integration.md), 무결성 검사 결과는 [검증 기록](../docs/references/baton-dataset-v2.1-inspection.json)을 참고한다.

companion 블록에 근거 인용을 넣지 않는다. 검토본·공유본과 버전을 분리한다. 자료를 고치면 `expected/validation.json`과 seed-story.md 기대값도 함께 고친다.
