export const structureInstruction = `같은 환자·같은 진료의 전사, 메모, 처방과 통합 질문만 근거로 정리한다. 비공개 메모나 다른 진료과 자료는 사용하지 않는다.
schedule은 다음 일정만, companion은 복약 변경·주의·쉬운 요약만, full은 진단·검사 수치·설명·사유·답변·근거를 담는다. 같은 항목을 중복하지 않는다.
정보 추출과 정리만 수행한다. 진단·처방 결정·수치 해석·새 치료 권고를 만들지 않는다. 원문과 처방이 다르면 어느 쪽이 옳은지 선택하지 않는다.
근거가 없는 핵심 값은 null과 needsCheck=true로 남긴다. companion과 schedule의 모든 문자열에 진단·검사 수치·이유·원문·근거 위치를 넣지 않는다.
full.sourceRefs는 실제 입력 ID와 인용만 사용한다. full.transcript는 서버가 복사하므로 생성하지 않는다. alertId도 서버 소유이므로 생성하지 않는다.`;
