# Operational scripts

`check-ai-access.ts`와 기본 시드 투입을 제공한다. T010의 pregenerate와 AI 평가는 아직 없다.
대상 계정·리전·테이블을 확인하고 생성·수정 작업을 명시하는 스크립트로 구현한다.
비밀번호·토큰·AWS 자격 증명을 파일이나 출력에 넣지 않는다.

- `npm run check:ai -- --report <경로>`: Bedrock 소형 연결 확인 호출 1회, Transcribe 목록 조회, 설정된 기존 버킷 HeadBucket, fixture JSON 파일 확인. 기본 dev/test에서는 실행하지 않는다. 모든 검사 성공 시 exit 0, 실패·필수 버킷 미설정 시 exit 1. IAM·버킷 생성·업로드·전사 작업 시작은 하지 않는다.
- `npm run seed`: 현재 fixtures/seed를 strict 스키마로 검증한 뒤 설정 DB의 기본 가상 시드를 한 트랜잭션으로 다시 만든다. 비밀번호는 scrypt 해시만 저장하고 관찰·당시 처방의 dose/timing 비교로 Alert를 만든다. `seedDatabase(db,{fixturesDir})`는 테스트용 메모리 DB에도 사용할 수 있다.
- `npm run seed -- --pregenerate`: T023·T024 의존성이 없어 DB를 열거나 변경하기 전에 exit 1로 거부한다. T010은 미완료 상태다.

`inspect-dataset.py`는 Python 표준 라이브러리로 제공받은 v2.1 ZIP의 구조·개수·참조·PNG 해시를 확인한다.
`python3 scripts/inspect-dataset.py '<ZIP 경로>' --report '<보고서 경로>'`로 실행한다.
원본을 추출하거나 ZIP 안의 스크립트를 실행하지 않으며 DB·AWS·활성 fixture를 변경하지 않는다.
검사 실패 시 종료 코드 1을 반환한다. [활용 기준과 실제 검사 결과](../docs/dataset-integration.md)를 참고한다.
