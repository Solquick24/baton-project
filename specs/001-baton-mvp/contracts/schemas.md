# 계약 스키마: 블록 · 응답 · 작업의 정확한 형태

**상태**: 2026-10-09 명세 보완 기본안. 팀 검토 전이며 바뀌면 이 파일과 `fixtures/`를 함께 고친다.
**구현 위치**: 아래 타입을 `packages/contracts/src/`에 Zod 스키마로 옮긴다(T008). 모든 객체 스키마는 `.strict()`로 알 수 없는 키를 거부한다.
**검증 자료**: `fixtures/seed/records.json`과 `fixtures/expected/**.json`이 이 형태를 그대로 따른다. 스키마와 fixture가 다르면 스키마를 기준으로 fixture를 고친다.

## 1. 공통 값

```ts
type Id = string;               // 불투명 ID. 시드는 읽기 쉬운 접두어(v_im_02, mc_im02_1)를 쓴다. 새 ID는 crypto.randomUUID()
type IsoDate = string;          // 'YYYY-MM-DD'
type IsoDateTime = string;      // ISO 8601, 오프셋 포함
type HhMm = string;             // 'HH:mm'

type Scope = 'schedule' | 'companion' | 'full';
type BlockKind = Scope;         // 블록 종류 = 범위 이름
type Role = 'patient' | 'lead' | 'guardian';
type Mode = 'live' | 'fixture'; // 실제 AWS 호출 결과인지, 저장된 대체 결과인지
type Section = 'questions' | 'briefing' | 'record';
type BlockSetState = 'generating' | 'ready' | 'blocked' | 'failed';
type Timing = 'morning' | 'lunch' | 'evening' | 'bedtime';

// 범위 → 읽을 수 있는 블록. 이 표는 apps/api/src/auth/block-policy.ts 한 곳에만 둔다.
const ALLOWED_KINDS = {
  schedule: ['schedule'],
  companion: ['schedule', 'companion'],
  full: ['schedule', 'companion', 'full'],
} as const;
// role=patient 구성원은 scope 컬럼을 'full'로 저장한다. 단 비공개 메모는 scope와 무관하게 환자 본인만.
```

### 1.1 항목 규칙(모든 블록 공통)

- 블록 안의 모든 목록 항목은 `id`와 `needsCheck`를 가진다.
- **핵심 값 필드**(`text`, `value`, `nextSchedule.date`, `medChanges.from/to`)가 `null`이면 `needsCheck`는 반드시 `true`다. 검증기는 `null + false`를 `true`로 고치고 issue `missing_source`를 남긴다.
- **보조 필드**(`caution`, `time`, `unit`, `dept`, `hospital`)의 `null`은 '없음'이며 `needsCheck`와 무관하다.
- 값이 있는데 `full.sourceRefs`(questions 섹션은 `full.basisRefs`)에 같은 `itemId`가 없으면 `needsCheck=true`로 고치고 issue `missing_source`를 남긴다. 공유를 막지는 않는다.
- 예외: `medChanges.from`은 `change='start'`일 때, `medChanges.to`는 `change='stop'`일 때 `null`이 정상이다.
- 한 블록 세트 안에서 `id`는 모든 kind를 통틀어 유일하다.

## 2. 진료 공통 정보(meta)

블록이 아니라 `visits` 행에서 조립한다. **일정만 이상 모두** 받는다.

```ts
interface VisitMeta {
  id: Id;
  patientId: Id;
  date: IsoDate;
  time: HhMm | null;
  dept: string;                                  // '내과' · '정형외과' 등 한국어 표기 그대로
  hospital: { id: Id; name: string };
  companion: { userId: Id; name: string } | null; // 이번 진료의 동행자
  status: 'upcoming' | 'done';                   // 첫 공유 확정 시 'done'
}
```

meta에는 진료 내용·다른 가족의 범위·숨긴 블록 개수·초안 존재 여부를 넣지 않는다.

## 3. 블록 세트와 섹션

AI 생성 결과 한 번 = 블록 세트 한 개 = `schedule`·`companion`·`full` 세 블록. 섹션은 세 가지다.

| 섹션 | 만드는 요청 | 가족 공개 시점 | 진료당 포인터 |
|---|---|---|---|
| `questions` | `POST …/questions/merge` | 검증 `ready`가 되면 바로 허용 범위에 공개 | `visits.questionsVersion` |
| `briefing` | `POST …/briefing` | 검증 `ready`가 되면 바로 허용 범위에 공개 | `visits.briefingVersion` |
| `record` | `POST …/structure` | **공유하기 확정 후에만**. 그 전에는 작성자·범위 관리자만 자기 범위로 검토 | `visits.recordDraftVersion` · `visits.recordPublishedVersion` |

- questions·briefing은 이미 가족이 볼 수 있는 기록과 가족 질문으로 만드는 진료 전 자료라서 공유 단계를 두지 않는다. 혼입 검사에 걸리면(`blocked`) `companion`·`schedule` 블록을 아무에게도 주지 않고 `full`만 전체 내용 계정에 준다.
- 섹션마다 `version`은 1부터 증가한다. 이전 버전은 지우지 않는다.

### 3.1 `questions` 섹션

```ts
interface QuestionsScheduleBlock {}              // 항상 빈 객체로 저장
interface QuestionsCompanionBlock {
  mergedQuestions: Array<{
    id: Id;
    text: string;
    fromQuestionIds: Id[];                       // 원 질문 id. AI 추가 질문은 []
    addedByAI: boolean;
    needsCheck: boolean;
  }>;
}
interface QuestionsFullBlock {
  basisRefs: SourceRef[];                        // itemId = mergedQuestions[].id. addedByAI 항목은 1개 이상 필수
}
```

### 3.2 `briefing` 섹션

```ts
interface BriefingScheduleBlock {}               // 항상 빈 객체
interface BriefingCompanionBlock {
  briefing: {
    changes: Array<{ id: Id; text: string; needsCheck: boolean }>; // 무엇이 어떻게 바뀌었는지만. 이유 없음
    questions: Id[];                             // questions 섹션 mergedQuestions[].id 참조. 문장 중복 저장 금지
  };
}
interface BriefingFullBlock {
  briefing: {
    changeReasons: Array<{ id: Id; changeId: Id; text: string | null; needsCheck: boolean }>;
    watch: Array<{ id: Id; text: string | null; needsCheck: boolean }>;   // 지켜볼 증상
    tests: Array<{ id: Id; text: string | null; needsCheck: boolean }>;   // 먼저 받을 검사
    prep: Array<{ id: Id; label: string; text: string | null; needsCheck: boolean }>; // 준비사항. 근거 없으면 text=null
  };
  sourceRefs: SourceRef[];
}
```

### 3.3 `record` 섹션(진료 후 정리)

```ts
interface RecordScheduleBlock {
  nextSchedule: Array<{
    id: Id; date: IsoDate | null; time: HhMm | null;
    dept: string | null; hospital: string | null; needsCheck: boolean;
  }>;
}
interface RecordCompanionBlock {
  medChanges: Array<{
    id: Id;
    drug: string;                                // 약 이름 표시는 허용(진단 추론 한계는 decisions.md)
    change: 'start' | 'stop' | 'dose' | 'timing' | 'keep';
    from: string | null;                         // 예: '아침 1정'
    to: string | null;                           // 예: '아침 0.5정'
    caution: string | null;                      // 주의사항. 사유·진단·수치 금지
    needsCheck: boolean;
  }>;
  easySummary: Array<{ id: Id; text: string | null; needsCheck: boolean }>; // 쉬운 말. 진단명·검사·수치·사유 금지
}
interface RecordFullBlock {
  diagnosis: Array<{ id: Id; text: string | null; needsCheck: boolean }>;
  labResults: Array<{ id: Id; name: string; value: string | null; unit: string | null; needsCheck: boolean }>;
  doctorExplanation: Array<{ id: Id; text: string | null; needsCheck: boolean }>;
  medReasons: Array<{ id: Id; medChangeId: Id; text: string | null; needsCheck: boolean }>;
  medDetails: Array<MedFact & { medChangeId: Id }>; // 불일치 코드 비교용(화면 표시 안 함)
  answers: Array<{ id: Id; questionId: Id; text: string | null; needsCheck: boolean }>; // questionId = mergedQuestions[].id
  needsCheckDetails: Array<{
    itemId: Id;
    reason: 'no_source' | 'low_confidence' | 'conflict' | 'restricted_value' | 'medical_judgment';
    alertId: Id | null;
  }>;
  sourceRefs: SourceRef[];
  transcript: Transcript | null;                 // AI 출력이 아니다. 서버가 저장 직전에 transcripts 행을 복사해 넣는다
}
interface Transcript {
  transcriptId: Id;
  uploadId: Id | null;                           // fixture 전사는 null
  mode: Mode;
  segments: Array<{ id: Id; startMs: number | null; endMs: number | null; speaker: string | null; text: string }>;
}
interface MedFact {
  drugKey: string;                               // 비교 키(영문 소문자). 예: 'batodipine'
  drugName: string;
  dose: string | null;                           // '0.5정' 형태로 정규화
  timing: Timing[] | null;
}
```

**LLM 출력 = 위 세 블록에서 `full.transcript`만 뺀 것.** fixture 파일(`fixtures/expected/structure/*.json`)도 같은 형태다.

### 3.4 근거 참조

```ts
interface SourceRef {
  itemId: Id;                                    // 근거를 단 항목 id(어느 블록이든)
  source:
    | { type: 'transcript'; segmentId: Id }
    | { type: 'note'; noteId: Id }
    | { type: 'prescription'; prescriptionId: Id }
    | { type: 'observation'; observationId: Id }
    | { type: 'question'; questionId: Id }
    | { type: 'record'; visitId: Id; version: number; itemId: Id };
  quote: string | null;                          // 원문 인용. full 블록 안에만 존재
}
```

- 인용은 `full` 블록에 저장된 `quote`를 그대로 보여준다. 원본 파일(음성)은 `GET /patients/{pid}/sources/{uploadId}`로만 연다.
- `transcript` 근거의 `uploadId`는 `full.transcript.uploadId`에서 찾는다.

## 4. 검증기(저장 직전, `apps/api/src/ai/safety/`)

순서대로 실행하고 결과를 `block_sets.state`와 `issues`에 저장한다.

1. **스키마**: 섹션별 Zod 스키마 통과 실패 → 최대 1회 재호출, 그래도 실패 → `failed`(errorCode `validation_failed`).
2. **항목 규칙**: 1.1 규칙으로 `needsCheck`를 보정하고 issue `missing_source`(공유 가능).
3. **제한값 혼입**(`restricted_value`, 공유 보류):
   - 제한 문자열 = 같은 환자의 모든 `full` 블록(이번 출력 포함)에서 `diagnosis[].text`, `labResults[].name`, `labResults[]`의 `value+unit`(예: `7.2%`), `medReasons[].text`, `doctorExplanation[].text`, `answers[].text`, `changeReasons[].text`.
   - 정규화: NFKC → 소문자 → 공백만 제거(문장부호는 유지해 `7.2%`가 `72`로 뭉개지지 않게). 정규화 후 3자 미만은 제외.
   - `schedule`·`companion` 블록의 모든 문자열 값에 제한 문자열이 부분 문자열로 들어 있으면 해당 항목 `needsCheck=true`, issue 추가, 세트 상태 `blocked`.
   - 말을 바꿔 쓴 표현은 못 잡는다. 이 한계를 테스트·발표에서 그대로 적는다.
4. **의료 판단 문구**(`medical_judgment`, 공유 보류): 낮은 블록 문자열에 다음이 있으면 `blocked` — `가능성이 있`, `으로 보입니다`, `것 같습니다`, `정상입니다`, `정상 범위`, `비정상`, `권장합니다`, `추천합니다`. 휴리스틱이며 목록은 `output-validator.ts` 한 곳에 둔다.
5. 모두 통과하면 `ready`.

```ts
interface ValidationIssue {
  blockKind: BlockKind;
  itemId: Id;
  rule: 'schema' | 'missing_source' | 'restricted_value' | 'medical_judgment';
  // 걸린 문자열 자체는 저장·응답하지 않는다(낮은 범위 검토자에게 full 값이 새지 않도록)
}
```

질문 등록(`POST …/questions`)에도 3번 검사를 적용한다. 걸리면 그 질문 행의 `visibility='full'`로 저장해 전체 내용 계정에게만 보인다.

## 5. 불일치(alerts) — 코드 비교

```ts
interface Alert {
  id: Id; patientId: Id; visitId: Id; dept: string;
  kind: 'observation_vs_prescription' | 'record_vs_prescription';
  references: [AlertRef, AlertRef];              // [가족 메모 또는 정리 결과, 약봉투]
  differences: Array<{ field: 'dose' | 'timing'; left: string | null; right: string | null }>;
  summary: string;                               // 코드가 만드는 한 줄. 예: '바토디핀정 5mg 복용 시간이 다릅니다(가족 메모: 저녁 / 약봉투: 아침)'
  status: 'open' | 'awaiting_confirmation' | 'resolved';
  history: Array<{ action: 'detected' | 'edit_note' | 'reupload' | 'confirm_hospital'; by: Id | null; at: IsoDateTime; note: string | null }>;
}
type AlertRef =
  | { type: 'observation'; id: Id; quote: string; fact: MedFact }
  | { type: 'prescription'; id: Id; quote: string; fact: MedFact }
  | { type: 'record'; visitId: Id; version: number; itemId: Id; quote: string | null; fact: MedFact };
```

- 비교 함수(순수 함수, AI 없음): 같은 `drugKey`끼리 `dose` 문자열 비교, `timing`은 정렬한 집합 비교. 차이가 있으면 Alert 1건. 어느 쪽이 맞는지 판단하는 문구를 만들지 않는다.
- 실행 시점: (a) `npm run seed`에서 시드 관찰 메모 vs 시드 약봉투, (b) `structure` 작업이 `ready`로 끝난 직후 `full.medDetails` vs 같은 진료의 약봉투.
- 처리(`POST …/alerts/{aid}/resolve`, 환자·대표 보호자):
  - `edit_note` — 본문 `{ fact: MedFact, text?: string }`. 관찰 메모의 새 버전을 저장하고(원본·수정 이력 보존) 다시 비교한다. 차이가 없어지면 `resolved`, 남으면 `open`.
  - `reupload` — 1단계는 안내만 기록한다. 상태 `open` 유지.
  - `confirm_hospital` — `awaiting_confirmation`. `resolved`로 바꾸지 않는다.
- 상태가 `resolved`가 아니면 다음 브리핑 생성 입력에 포함하고, 브리핑의 해당 변경 항목은 `needsCheck=true`가 된다. 이미 저장된 과거 블록은 다시 쓰지 않는다.
- Alert 전체는 full 전용이다. 동행 이하에게는 목록·개수·상세 모두 주지 않는다.

## 6. 작업(jobs)

```ts
interface Job {
  id: Id;
  kind: 'transcribe' | 'merge_questions' | 'briefing' | 'structure';
  visitId: Id;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempt: number;                               // 같은 (visitId, kind, inputVersion)의 몇 번째 시도인지
  mode: Mode | null;
  resultVersion: number | null;                  // 결과 블록 세트 version. transcribe는 null
  resultState: BlockSetState | null;             // ready / blocked
  errorCode: 'ai_unavailable' | 'stt_unavailable' | 'validation_failed' | 'stale_input' | 'internal' | null;
  createdAt: IsoDateTime; updatedAt: IsoDateTime;
}
```

- AI 생성(merge·briefing·structure)과 전사는 **항상 202 + jobId**로 시작한다. 프론트는 2초마다 `GET /jobs/{jobId}`를 부르고 `succeeded`·`failed`에서 멈춘다.
- 재시도는 별도 경로 없이 같은 생성 요청을 다시 보낸다.
  - 같은 `(visitId, kind, inputVersion)`에 `queued`·`running` 작업이 있으면 그 jobId를 돌려준다.
  - `succeeded` 작업이 있으면 새로 만들지 않고 그 jobId를 돌려준다(중복 생성 금지).
  - 마지막이 `failed`면 `attempt+1`로 새 작업을 만든다.
- 서버 시작 시 `running`으로 남은 작업은 `failed`(`internal`)로 바꾼다.
- 작업 조회는 요청자 본인 또는 그 환자의 전체 내용 구성원만 가능하다. 다른 사람에게는 404. 응답에 원문·전사·블록 내용을 넣지 않는다.

## 7. 오류

```ts
interface ErrorResponse {
  error: {
    code: 'unauthorized' | 'forbidden' | 'not_found' | 'bad_request' | 'conflict' | 'upstream_error';
    reason?: 'stale_input' | 'blocked' | 'not_ready' | 'not_author' | 'recording_not_allowed';
    message: string;                             // 한국어 짧은 안내. 원문·내부 경로·다른 범위 개수 금지
    requestId: string;
  };
}
```

401 인증 실패 · 403 행동 권한 없음 · 404 없음 또는 허용 범위 밖 · 400 입력 오류 · 409 버전 충돌·공유 보류 · 502 외부 처리 오류.

## 8. API 요청·응답(1단계)

모든 경로는 `/api` 아래에 있다. `{pid}`가 붙는 경로는 매 요청 `members`에서 호출자의 현재 `role`·`scope`·`active`를 읽어 판단한다(JWT에는 `sub`만).

```ts
// POST /api/auth/login
type LoginReq = { email: string; password: string };
type LoginRes = { accessToken: string; user: { id: Id; name: string } };
// JWT: HS256, iss='baton-local', aud='baton-web', exp=8h, claims={ sub }. 2026-10-09 @fastify/jwt 10.2.4로
// 잘못된 aud·iss·alg=none 토큰이 401이 되는 설정을 확인했다:
// app.register(jwt, { secret, sign: { iss, aud, expiresIn: '8h' }, verify: { allowedIss: iss, allowedAud: aud } })

// GET /api/me/patients
type MePatientsRes = {
  self: { patientId: Id | null };                // 내 기록. 환자 계정만 값이 있고, 나머지는 null → 03 빈 화면
  linked: Array<{ patientId: Id; name: string }>;// 내가 구성원인 다른 환자
};

// GET /api/patients/{pid}/home?dept=내과
type HomeRes = {
  patient: { id: Id; name: string };
  me: { role: Role; canManageScopes: boolean };  // 내 범위 이름은 넣지 않는다(화면은 블록 유무로 판단)
  depts: string[];
  nextVisit: null | {
    meta: VisitMeta;
    questionCount?: number;                      // companion 이상만 키가 존재
    briefingReady?: boolean;                     // companion 이상만 키가 존재
  };
  openAlertCount?: number;                       // full만 키가 존재
  recent: VisitView[];                           // 공유된 기록만, 최신순 최대 5건
};

// GET /api/patients/{pid}/timeline?dept=내과
type TimelineRes = { items: VisitView[] };       // 공유본만. dept 필터 필수 적용

// GET /api/patients/{pid}/visits/{vid}?view=published|draft  (기본 published)
type VisitView = {
  meta: VisitMeta;
  record?: {                                     // 보여줄 기록이 없으면 키 자체가 없음
    view: 'published' | 'draft';
    version: number;
    mode: Mode;
    state?: BlockSetState;                       // draft일 때만
    shareable?: boolean;                         // draft일 때만: state=ready && inputVersion 일치 && 공유 권한
    issues?: ValidationIssue[];                  // draft일 때만, 호출자 허용 kind의 issue만
    blocks: { schedule?: RecordScheduleBlock; companion?: RecordCompanionBlock; full?: RecordFullBlock };
  };
};
// view=draft는 (초안 작성자로서 현재 companion 이상) 또는 (환자 · 위임 켜진 대표)만. 그 외 403.

// POST /api/patients/{pid}/visits/{vid}/questions        (companion 이상)
type CreateQuestionReq = { text: string };       // 1~200자
type CreateQuestionRes = { id: Id; questionsInputVersion: number };

// GET /api/patients/{pid}/visits/{vid}/questions          (companion 이상, schedule은 404)
type QuestionsRes = {
  originals: Array<{ id: Id; text: string; author: { userId: Id; name: string }; createdAt: IsoDateTime }>;
  // companion에게는 visibility='companion'인 질문만
  questionsInputVersion: number;
  merged?: {                                     // 통합 결과가 없으면 키 없음
    version: number; mode: Mode; stale: boolean; // stale = 통합 후 질문이 추가됨
    blocks: { companion?: QuestionsCompanionBlock; full?: QuestionsFullBlock };
  };
};

// POST …/questions/merge   { inputVersion }  → 202 { jobId }  | 409 stale_input
// POST …/briefing          { questionsVersion } → 202 { jobId } | 409 not_ready(통합 결과 없음)
// GET  …/briefing          (companion 이상, schedule은 404, 없으면 404)
type BriefingRes = {
  version: number; mode: Mode; stale: boolean;   // stale = 브리핑 이후 질문 통합 버전이 바뀜
  blocks: { companion?: BriefingCompanionBlock; full?: BriefingFullBlock };
  questions: QuestionsCompanionBlock['mergedQuestions']; // briefing.questions id로 찾은 통합 질문(companion 이상)
};

// POST …/audio   multipart(file), audio/mpeg·mp4·x-m4a·wav·webm, 20MB 이하
//   companion 이상 + patients.recordingAllowed=true, 아니면 403 recording_not_allowed → 201 { uploadId }
// POST …/transcribe { uploadId }       → 202 { jobId }. 성공 시 transcripts 저장 + recordInputVersion+1
// POST …/notes      { text }           → 201 { noteId, recordInputVersion }   (메모 원문은 full 전용)
// POST …/structure  { inputVersion }   → 202 { jobId } | 409 stale_input
// POST …/share      { draftVersion, inputVersion, idempotencyKey }
type ShareRes = { publishedVersion: number; sharedAt: IsoDateTime; alreadyPublished: boolean };
//   409 reason: blocked | stale_input | not_ready, 403: 공유 권한 없음
//   같은 draftVersion을 다시 공유하면 200 + alreadyPublished=true, 로그 추가 없음

// GET /api/jobs/{jobId} → Job

// GET /api/patients/{pid}/sources/{uploadId}   (full만) → 파일 스트림. storagePath는 응답하지 않음

// GET  /api/patients/{pid}/alerts                    (full만, 그 외 404) → { alerts: Alert[] }
// POST /api/patients/{pid}/alerts/{aid}/resolve       (환자·대표 보호자)
type ResolveReq =
  | { action: 'edit_note'; fact: MedFact; text?: string }
  | { action: 'reupload'; note?: string }
  | { action: 'confirm_hospital'; note?: string };

// GET /api/patients/{pid}/members                     (환자 · 위임 켜진 대표만, 그 외 403)
type MembersRes = { members: Array<{ userId: Id; name: string; relation: string; role: Role; scope: Scope; active: boolean }> };
// PUT /api/patients/{pid}/members/{uid}/scope { scope } → { member: MembersRes['members'][number] }
//   role=patient 대상 변경 불가(400). 같은 값이면 로그를 남기지 않고 200
// GET /api/patients/{pid}/members/{uid}/share-log   그 가족 대상 기록(start·scope_change·stop)
// GET /api/patients/{pid}/share-log                 환자 전체 기록(위 + publish)
type ShareLog = {
  id: Id;
  targetUserId: Id | null;                       // publish는 특정 가족 대상이 아니므로 null
  actor: { userId: Id; name: string };
  action: 'start' | 'scope_change' | 'stop' | 'publish'; // start=가족 공유 시작(시드), publish=진료 정리 공유 확정
  oldScope: Scope | null; newScope: Scope | null;
  visitId: Id | null; version: number | null;    // publish일 때만
  at: IsoDateTime;
};
// 응답: { logs: ShareLog[] } 최신순. 두 경로 모두 환자 · 위임 켜진 대표만

// GET /api/hospitals/{hid}  (인증만 필요)
type HospitalRes = {
  id: Id; name: string; address: string; phone: string;
  mapImage: string; floorImage: string;          // apps/web/public/hospital/*.svg 경로
  guideSteps: Array<{ order: number; place: string; floor: string }>;
  experiences: Array<{ id: Id; order: string[]; waitBand: '10분 이내' | '30분' | '1시간 이상'; tip: string }>;
  notice: string;                                // '가상 병원 · 참고용 정보'
};
```

## 9. 응답 키 규칙 요약

| 키 | 최소 범위 |
|---|---|
| `meta`, `record.blocks.schedule`, `nextVisit.meta` | 일정만 |
| `record.blocks.companion`, `questionCount`, `briefingReady`, 질문·브리핑 응답 전체 | 동행 |
| `record.blocks.full`, `openAlertCount`, alerts, sources, `merged.blocks.full`, `blocks.full` | 전체 내용 |
| 다른 가족의 `scope`, members, share-log | 환자 · 위임 켜진 대표(행동 권한) |

허용되지 않은 키는 `undefined`로 두거나 지우는 방식이 아니라 **처음부터 SELECT하지 않고 조립하지 않는다.** 테스트는 `Object.keys`로 키 부재를 확인한다.
