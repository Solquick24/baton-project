export const structureInstruction = `같은 환자·같은 진료의 전사, 메모, 처방과 통합 질문만 근거로 정리한다. 비공개 메모나 다른 진료과 자료는 사용하지 않는다.
schedule은 다음 일정만, companion은 복약 변경·주의·쉬운 요약만, full은 진단·검사 수치·설명·사유·답변·근거를 담는다. 같은 항목을 중복하지 않는다.
정보 추출과 정리만 수행한다. 진단·처방 결정·수치 해석·새 치료 권고를 만들지 않는다. 원문과 처방이 다르면 어느 쪽이 옳은지 선택하지 않는다.
근거가 없는 핵심 값은 null과 needsCheck=true로 남긴다. companion과 schedule의 모든 문자열에 진단·검사 수치·이유·원문·근거 위치를 넣지 않는다.
full.sourceRefs는 실제 입력 ID와 인용만 사용한다. full.transcript는 서버가 복사하므로 생성하지 않는다. alertId도 서버 소유이므로 needsCheckDetails의 alertId=null로 둔다.
sourceCatalog의 source 객체만 그대로 사용하고 quote는 같은 항목의 quoteOptions에서 실제 부분 문자열을 복사한다. 인용을 요약하거나 서로 다른 근거를 합쳐 쓰지 않는다. sourceRefs.itemId는 이번 출력의 실제 항목 id이고 source 내부 ID는 원본 ID다. 다른 진료의 전사 ID를 복사하지 않는다.
모든 출력 항목 id는 세 블록 전체에서 유일해야 한다. full.medReasons와 medDetails의 medChangeId는 companion.medChanges의 실제 id를 가리킨다. medReasons 자체 id는 해당 약 항목 id와 달라야 한다. medDetails.drugName은 연결한 medChanges.drug와 같으며, 이미 처방에 있는 약은 같은 drugKey/drugName을 사용한다. 약 이름·복용량·시점은 연결된 실제 근거에 있는 값만 사용한다.
full.answers의 questionId는 merged.companion.mergedQuestions의 기존 id만 사용한다. input.questions의 원 질문 id나 임의 id를 넣지 않는다. 통합 질문이 없으면 answers=[]다. 질문 자체를 답의 근거로 쓰지 않는다.
full.needsCheckDetails.itemId는 실제 출력 항목 id만 가리킨다. 알 수 없는 일정·진단·검사·답은 해당 nullable 값을 null, needsCheck=true로 두고 없는 항목을 억지로 만들지 않는다. 근거 목록 전체를 복사하지 말고 실제 출력한 항목의 sourceRefs만 만든다.`;
