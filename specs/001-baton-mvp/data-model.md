# Data Model: 로컬 SQLite와 등급별 블록

최신 근거는 최종 기획안 8장·부록 A다. 기존 DynamoDB 키 초안을 SQLite로 옮기는 설계다.
아직 schema.sql·DB 파일은 만들지 않았다. 시드 자료는 `fixtures/seed/`에 준비했다.
블록·응답의 정확한 JSON 형태는 [contracts/schemas.md](contracts/schemas.md)가 기준이다.

**2026-10-09 보완**: 진료 전 자료(질문 통합·브리핑)와 진료 후 정리가 한 진료의 블록을 어떻게 나눠 쓰는지 정하지 않았던 빈칸을
`block_sets.section`으로 채웠다. 메모·전사·약봉투(처방) 저장 위치도 추가했다.

## Entities and constraints

| 엔터티 | 필드·관계 | 제약 |
|---|---|---|
| users | id,email,name,passwordHash,testOnly | 시드 계정만. 해시는 `node:crypto` scrypt(`scrypt$<saltB64>$<hashB64>`), 원문 저장 금지 |
| patients | id,name,userId,leadUserId,delegated,recordingAllowed | userId=환자 본인 계정. delegated 기본 false, recordingAllowed 시드 true. 설정 변경은 환자만(2단계) |
| members | patientId,userId,role,scope,active,relation | PK(patientId,userId). role=patient/lead/guardian; scope=schedule/companion/full; patient는 full 고정; active=false면 접근 거부 |
| hospitals | id,name,address,phone,mapImage,floorImage,guideSteps(JSON),experiences(JSON) | 가상 병원 1곳. 정적 안내 |
| visits | id,patientId,dept,hospitalId,date,time,companionUserId,status, recordInputVersion,recordDraftVersion,recordPublishedVersion, questionsInputVersion,questionsVersion,briefingVersion | status=upcoming/done. 입력 버전은 0부터 증가하는 정수, 결과 포인터는 null 가능 |
| block_sets | id,patientId,visitId,section,version,inputVersion,state,mode,createdBy,createdAt,issues(JSON) | section=questions/briefing/record; state=generating/ready/blocked/failed; UNIQUE(visitId,section,version). issues에는 itemId·rule만 저장 |
| visit_blocks | blockSetId,kind,payload(JSON) | kind=schedule/companion/full; UNIQUE(blockSetId,kind). 한 세트의 세 블록은 한 트랜잭션으로 저장 |
| questions | id,patientId,visitId,authorId,text,visibility,createdAt | 질문마다 독립 행. visibility=companion/full(등록 시 혼입 검사로 결정) |
| notes | id,patientId,visitId,authorId,text,createdAt | 진료 중·후 메모. 원문은 full 전용, 작성자도 companion이면 다시 열람 불가 |
| transcripts | id,patientId,visitId,uploadId,mode,segments(JSON),createdAt | 전사 결과. full 전용. structure 결과의 full.transcript로 복사 |
| prescriptions | id,patientId,visitId,uploadId,source,items(JSON),text | 약봉투·처방 값. 1단계는 source='seed'. items=MedFact[]. full 전용 |
| observations | id,patientId,dept,authorId,text,fact(JSON),date,revision,supersedesId | 가족 관찰 메모. 1단계 시드만. 원문·상세는 full. edit_note는 새 revision 행을 만들고 원본 보존 |
| alerts | id,patientId,visitId,dept,kind,references(JSON),differences(JSON),summary,status,history(JSON) | status=open/awaiting_confirmation/resolved; 전체 full 전용 |
| jobs | id,patientId,visitId,requestedBy,kind,inputVersion,status,attempt,mode,resultVersion,resultState,errorCode,createdAt,updatedAt | status=queued/running/succeeded/failed. 원문·결과 내용 저장 금지(블록 세트 version만) |
| share_logs | id,patientId,targetUserId,actorId,action,oldScope,newScope,visitId,version,at | action=start/scope_change/stop/publish. publish는 targetUserId=null. 환자·위임 대표만 조회 |
| uploads | id,patientId,visitId,uploaderId,storagePath,mediaType,size,createdAt | 공개 static 밖. 원본 읽기는 full, 업로드 권한과 읽기 권한 분리 |
| documents | id,patientId,visitId,uploadId,extractedFields,editedFields | 2단계 |
| private_notes | id,patientId,text,includeInDoctorView | 2단계; 환자만, 모든 AI 입력 제외 |
| experiences | hospitalId,dept,order,waitBand,tip | 2단계 입력. 1단계는 hospitals.experiences 더미만 |

UUID 또는 동등한 불투명 ID, 시간은 ISO 8601로 통일한다. 하위 리소스(visit·question·upload·alert)의 patientId 소속을 서버에서 검사한다.
SQL 바인딩·foreign key(`PRAGMA foreign_keys=ON`)·트랜잭션을 사용한다. 마이그레이션은 `schema.sql` 한 파일, 시드는 `npm run seed`가 DB를 지우고 다시 만든다.

## Block sets and sections

| section | 생성 요청 | 입력 | 가족 공개 |
|---|---|---|---|
| questions | POST questions/merge | 이 진료의 원 질문 + 같은 과 공유 기록 + 열린 alerts | state=ready면 바로 |
| briefing | POST briefing | 같은 과 이전 진료 공유본 세 블록 + 같은 과 관찰 메모 + 열린 alerts + questions 최신 ready 세트 | state=ready면 바로 |
| record | POST structure | 이 진료의 notes + 최신 transcript + prescriptions + questions 최신 ready 세트 | POST share 후에만 |

- 모든 섹션의 입력은 같은 patientId·dept로 제한한다. 진료과 미확인 기록·비공개 메모·다른 환자 자료는 입력에 넣지 않는다.
- blocked 세트: questions·briefing은 full 블록만 전체 내용 계정에 보이고 companion/schedule은 아무에게도 응답하지 않는다. record는 공유할 수 없다.
- 이전 세트는 지우지 않는다. 포인터(questionsVersion·briefingVersion·recordDraftVersion·recordPublishedVersion)만 바꾼다.

## Block payloads

- 정확한 형태: [contracts/schemas.md](contracts/schemas.md) 3장.
- **schedule**: record는 nextSchedule[]. questions·briefing은 빈 객체.
- **companion**: record는 medChanges[]·easySummary[], questions는 mergedQuestions[], briefing은 briefing{changes[],questions[]}.
- **full**: record는 diagnosis·labResults·doctorExplanation·medReasons·medDetails·answers·needsCheckDetails·sourceRefs·transcript,
  questions는 basisRefs, briefing은 briefing{changeReasons,watch,tests,prep}·sourceRefs.
- **private_notes**: 블록 바깥. 어떤 AI 파이프라인에도 포함하지 않는다.

같은 값을 블록에 중복하지 않는다. 여러 화면은 같은 저장 필드를 재사용한다.
briefing.questions는 mergedQuestions의 ID를 참조하고 중복 문장을 저장하지 않는다.
low-scope 항목은 id·needsCheck만, sourceRefs·basisRefs·quote·문서 주소는 full에만 둔다.
null은 미확인 값이며 needsCheck=true다. full의 sourceRefs는 항목 ID로 근거를 연결한다.

## Access repository

- 외부 조회: 인증 → 현행 members/active/role/위임 → allowed kind 목록 → 필요한 section·version의 블록만 `SELECT … WHERE kind IN (…)`.
- 원본 진료의 meta를 먼저 읽되 원문·full은 포함하지 않는다. payload 전체 읽기 후 키 삭제는 쓰지 않는다.
- 내부 생성 입력 repository는 같은 patientId·dept·목적의 허용 원본만 읽는다. 외부 응답 경로와 파일·모듈을 분리한다.
- Q/OBS/ALERT/전사/메모/작업/로그의 보조 경로도 scope 규칙을 적용한다. 원 질문 문장의 혼입 검사 실패는 visibility=full로 격리한다.
- 범위 이름·등급은 일반 가족 응답과 JWT에 넣지 않는다(본인 범위 이름 포함). 서버는 매 요청 DB 관계를 읽는다.

## State transitions and transactions

- 작업: queued → running → succeeded/failed. 서버 재시작 시 남은 running은 failed로 전환한다. 재시도 규칙은 schemas.md 6장.
- 블록 세트: generating → ready/blocked/failed. 구조 실패는 failed, 민감 혼입·의료 판단 문구는 blocked.
- 공유: record 세트 ready + 현행 공유 권한 + 세트 inputVersion = visits.recordInputVersion → recordPublishedVersion 갱신 + publish 로그 + status=done을 한 트랜잭션으로 저장.
- 미해결 일반 불일치·missing_source는 needsCheck 유지로 공유 가능; blocked는 공유하기로 우회 불가(409 blocked).
- recordInputVersion 증가(메모 추가·전사 완료) 시 이전 draft는 stale이 된다. 이전 publishedVersion은 보존하고, 새 공유 확정 전에는 기존 공유본만 가족에게 전달한다.
- scope 변경과 scope_change 로그를 함께 저장한다. 같은 값으로의 변경·같은 요청 재전송은 로그·공유를 중복 생성하지 않는다.
- 비공개 메모·위임·stop은 2단계. stop은 active=false와 stop 로그를 함께 저장한다.

## Files and AWS staging

영구 DB는 `apps/api/data/baton.sqlite`, 업로드는 `apps/api/data/uploads/`. Git·Vite public에서 제외한다(`.gitignore`).
원본 다운로드는 환자 소속·현재 권한(full) 검사 후 스트림으로 제공하고 storagePath는 응답하지 않는다.
Transcribe용 임시 S3 object key는 `baton-staging/{patientId}/{jobId}/{uploadId}`로 구분하고, 결과는 SDK로 회수해 로컬 transcripts에 저장한다.
시드의 full 진단·검사 수치는 실제 정보 대신 `가상질환 K1`·`가상지표 X 7.2%` 같은 자리표시자로 동행과의 차이를 보여준다.
