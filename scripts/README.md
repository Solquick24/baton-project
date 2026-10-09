# Operational scripts

환경 점검·시드 투입·모의 자료 평가 스크립트의 자리다. 앱 시드·AI 평가 스크립트는 아직 없다.
대상 계정·리전·테이블을 확인하고 생성·수정 작업을 명시하는 스크립트로 구현한다.
비밀번호·토큰·AWS 자격 증명을 파일이나 출력에 넣지 않는다.

`inspect-dataset.py`는 Python 표준 라이브러리로 제공받은 v2.1 ZIP의 구조·개수·참조·PNG 해시를 확인한다.
`python3 scripts/inspect-dataset.py '<ZIP 경로>' --report '<보고서 경로>'`로 실행한다.
원본을 추출하거나 ZIP 안의 스크립트를 실행하지 않으며 DB·AWS·활성 fixture를 변경하지 않는다.
검사 실패 시 종료 코드 1을 반환한다. [활용 기준과 실제 검사 결과](../docs/dataset-integration.md)를 참고한다.
