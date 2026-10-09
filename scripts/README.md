# Operational scripts

Phase 1에서 `check-ai-access.ts`와 seed 명령의 선행 조건 검사를 추가했다. 실제 시드 투입(T010)·AI 평가는 아직 없다.
대상 계정·리전·테이블을 확인하고 생성·수정 작업을 명시하는 스크립트로 구현한다.
비밀번호·토큰·AWS 자격 증명을 파일이나 출력에 넣지 않는다.

- `npm run check:ai -- --report <경로>`: Bedrock 소형 연결 확인 호출 1회, Transcribe 목록 조회, 설정된 기존 버킷 HeadBucket, fixture JSON 파일 확인. 기본 dev/test에서는 실행하지 않는다. 모든 검사 성공 시 exit 0, 실패·필수 버킷 미설정 시 exit 1. IAM·버킷 생성·업로드·전사 작업 시작은 하지 않는다.
- `npm run seed`: 아직 T009·T010이 미완료여서 안내와 exit 1을 반환하며 DB를 변경하지 않는다. 이 보호 동작을 시드 구현 완료로 계산하지 않는다.

`inspect-dataset.py`는 Python 표준 라이브러리로 제공받은 v2.1 ZIP의 구조·개수·참조·PNG 해시를 확인한다.
`python3 scripts/inspect-dataset.py '<ZIP 경로>' --report '<보고서 경로>'`로 실행한다.
원본을 추출하거나 ZIP 안의 스크립트를 실행하지 않으며 DB·AWS·활성 fixture를 변경하지 않는다.
검사 실패 시 종료 코드 1을 반환한다. [활용 기준과 실제 검사 결과](../docs/dataset-integration.md)를 참고한다.
