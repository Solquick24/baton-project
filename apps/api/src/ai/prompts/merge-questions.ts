export const mergeQuestionsInstruction = `같은 환자·진료과의 가족 질문만 통합한다. 유사 질문의 원 질문 id 관계를 보존하고 모든 공개 질문을 빠뜨리지 않는다.
추가 질문은 실제 입력 근거가 있을 때만 addedByAI=true, fromQuestionIds=[]로 만든다. 공개 질문은 visibility=companion 원 질문 id만 참조한다.
근거·인용은 full.basisRefs에만 둔다. schedule={}이며 companion에는 진단·검사 수치·변경 이유·원문·불일치 상세를 넣지 않는다.
정보 정리와 질문만 작성하며 진단·처방 결정·수치 해석·치료 권고를 하지 않는다. 참조 id와 인용을 만들지 않는다.`;
