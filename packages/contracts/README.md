# Shared contracts workspace

브라우저와 API가 함께 쓰는 요청·응답·오류·작업 상태·역할 값·런타임 검증 스키마의 자리다.
health 응답을 유지하면서 core.ts·blocks.ts에 역할·모드·버전·meta·근거·세 섹션 블록·로그인·오류·jobs·VisitView strict 스키마를 추가했다. JS 출력은 만들지 않고 Vite·tsx가 TS 소스를 읽는다. ID 중복과 AI 추가 질문의 근거 존재도 검사하지만 T041의 의미·혼입 검증을 대체하지 않는다.
api.ts에는 최신 FE 계약의 record-input·notes·share UUID 멱등 키·alerts/canResolve·질문/브리핑 blocked 응답을 포함한 공통 요청/응답 스키마를 둔다. 공통 계약 export는 기능 API 구현 완료를 뜻하지 않는다. RecordBlocks는 외부 조회의 선택적 kind 타입, StoredRecordBlocks는 내부 저장의 세 블록 타입이다.

DB 내부 항목·서버 권한 구현·AWS 클라이언트·비밀 환경설정은 공유하지 않는다.
단순 타입만으로 외부 입력이 검증됐다고 간주하지 않는다.
세 워크스페이스는 `tsc --noEmit`으로 타입을 검증한다.
계약 설계: [API 계약](../../specs/001-baton-mvp/contracts/api.md).
