# Shared contracts workspace

브라우저와 API가 함께 쓰는 요청·응답·오류·작업 상태·역할 값·런타임 검증 스키마의 자리다.
Phase 1에서 엄격한 health 응답 Zod 스키마와 TS 소스 export를 추가했다. 환자·블록·권한 관련 계약은 T008 이후 구현한다. JS 출력은 만들지 않고 Vite·tsx가 TS 소스를 읽는다.

DB 내부 항목·서버 권한 구현·AWS 클라이언트·비밀 환경설정은 공유하지 않는다.
단순 타입만으로 외부 입력이 검증됐다고 간주하지 않는다.
세 워크스페이스는 `tsc --noEmit`으로 타입을 검증한다.
계약 설계: [API 계약](../../specs/001-baton-mvp/contracts/api.md).
