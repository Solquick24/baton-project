# Operational scripts

`check-ai-access.ts`와 시드·질문/브리핑 fixture 사전 생성을 제공한다. T065 축소 fixture 검증 평가를 제공한다. 실제 모델 품질 평가는 아니다.
대상 계정·리전·테이블을 확인하고 생성·수정 작업을 명시하는 스크립트로 구현한다.
비밀번호·토큰·AWS 자격 증명을 파일이나 출력에 넣지 않는다.

- `npm run check:ai -- --report <경로>`: Bedrock 소형 연결 확인 호출 1회, Transcribe 목록 조회, 설정된 기존 버킷 HeadBucket, fixture JSON 파일 확인. 기본 dev/test에서는 실행하지 않는다. 모든 검사 성공 시 exit 0, 실패·필수 버킷 미설정 시 exit 1. IAM·버킷 생성·업로드·전사 작업 시작은 하지 않는다.
- `npm run seed`: 현재 fixtures/seed를 strict 스키마로 검증한 뒤 설정 DB의 기본 가상 시드를 한 트랜잭션으로 다시 만든다. 비밀번호는 scrypt 해시만 저장하고 관찰·당시 처방의 dose/timing 비교로 Alert를 만든다. `seedDatabase(db,{fixturesDir})`는 테스트용 메모리 DB에도 사용할 수 있다.
- `npm run seed -- --pregenerate`: 기본 시드를 다시 만든 뒤 실제 fixture provider → 질문 통합 job → 브리핑 job → 저장 전 검증 → 원자 저장을 실행한다. 두 결과 모두 fixture/ready일 때만 exit 0이다. 실패하면 exit 1이며 기본 시드와 이미 성공한 결과·실패 job은 DB에 남는다. fixture 파일을 결과 테이블에 직접 넣어 생성 성공으로 취급하지 않는다. AWS를 호출하지 않는다.
- `npm run seed -- --pregenerate --database /절대/임시경로/baton.sqlite`: 지정한 별도 DB에만 위 과정을 실행한다. `--database` 생략 시 설정 DB를 재생성하므로 기존 데이터를 보존할 검증에는 반드시 별도 경로를 준다. 상대 경로 옵션은 실행 디렉터리 기준이며 `:memory:`도 지원한다. 실제 별도 파일 DB 검증은 [Phase 3 체크포인트](../docs/phase3-backend-checkpoint.md)에 기록했다.

`inspect-dataset.py`는 Python 표준 라이브러리로 제공받은 v2.1 ZIP의 구조·개수·참조·PNG 해시를 확인한다.
`python3 scripts/inspect-dataset.py '<ZIP 경로>' --report '<보고서 경로>'`로 실행한다.
원본을 추출하거나 ZIP 안의 스크립트를 실행하지 않으며 DB·AWS·활성 fixture를 변경하지 않는다.
검사 실패 시 종료 코드 1을 반환한다. [활용 기준과 실제 검사 결과](../docs/dataset-integration.md)를 참고한다.

`LLM_PROVIDER=openai LLM_MODE=live LIVE_FALLBACK_TO_FIXTURE=false node --import tsx scripts/check-openai.ts`는 명시적인 수동 점검이다. `apps/api/.env`의 키·모델을 사용하고 최소 가상 질문 한 개만 Responses에 보낸다. 스키마 형식 재시도는 최대 1회이며 fixture 대체·DB 저장·AWS 호출은 없다. 저장 전 질문 안전 검증까지 통과해야 exit 0이고 원문/키는 출력하지 않는다. dev/test/build에서 자동 실행하지 않는다. 초기 연결 구현 당시 키·모델 미설정으로 미실시했다. 이후 사용자의 단일 live 응답 성공 보고와 에이전트 fixture 검증은 [최신 체크포인트](../docs/final-validation-checkpoint.md)에서 구분한다.

## T065 축소 평가 (외부 호출 없음)

```bash
LLM_MODE=fixture STT_MODE=fixture LIVE_FALLBACK_TO_FIXTURE=false node --import tsx scripts/evaluate.ts --report docs/references/final-fixture-evaluation.json
```

.env를 읽지 않고 메모리 DB/fixture pipeline으로 validation.json 4건의 state/issues와 alerts.json 1건을 비교한다. 별도 재서술 도전 1건의 탐지 실패도 JSON에 기록한다. 명령의 성공은 고정 기대값 일치를 뜻하며 별도 도전의 안전성 통과를 뜻하지 않는다. 정확 문자열 누출 검사 전 1/4, blocked 비공개 적용 후 0/4; 불일치 1/1. 원래 20장 추출 평가·의료적 정확성·실제 OpenAI/STT 품질·문서 수정률은 미수행이다.
