export const briefingInstruction = `같은 환자·진료과·시점의 과거 공유 기록, 관찰, 열린 확인 항목과 준비된 통합 질문으로 진료 전 브리핑을 만든다.
companion.briefing.changes에는 바뀐 사실만, questions에는 통합 질문 id만 둔다. 이유·관찰 상세·검사·준비·근거·인용은 full에만 둔다.
미해결 불일치와 관련된 변경은 needsCheck=true다. 근거 없는 full 핵심 값은 null, needsCheck=true이며 금식 여부를 추측하지 않는다.
schedule={}이며 정보 정리만 수행한다. 진단·처방 결정·수치 해석·치료 권고 금지. 원본 id·인용은 실제 입력에서만 가져온다.`;
