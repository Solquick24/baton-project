import { useContext, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { BriefingRes, Job, RecordInputResponse, ShareRequest, ShareResponse, VisitView } from '@baton/contracts';
import { SessionContext, useResource } from '../../app/session';
import { Card, Saved, State, RecordCard, useVisitBase, VisitContext } from '../../components/ui';
import { request, waitForJob } from '../../lib/api';
import { useAction } from '../../lib/use-action';
import { Recorder } from './Recorder';
import { WorkflowSteps, useWorkflow } from './Workflow';

export function VisitPage() {
  const base = useVisitBase(), navigate = useNavigate();
  const input = useResource<RecordInputResponse>(`${base.api}/record-input`);
  const briefing = useResource<BriefingRes>(`${base.api}/briefing`);
  const action = useAction(); const [file, setFile] = useState<File | null>(null), [uploadId, setUploadId] = useState<string>();
  const [note, setNote] = useState(''), [noteCount, setNoteCount] = useState(0), [message, setMessage] = useState('');
  const [converted, setConverted] = useState<Job | null>(null);
  const [recording, setRecording] = useState(false); const workflow = useWorkflow();
  if (!input.data) return <State error={input.error} retry={input.reload} />;
  async function transcribe(token: string, signal: AbortSignal, selected = file) {
    if (!selected) return;
    setMessage('');
    let id = selected === file ? uploadId : undefined;
    if (!id) { const form = new FormData(); form.append('file', selected); id = (await request<{ uploadId: string }>(`${base.api}/audio`, token, signal, form)).uploadId; setUploadId(id); }
    const accepted = await request<{ jobId: string }>(`${base.api}/transcribe`, token, signal, { uploadId: id });
    const job = await waitForJob(accepted.jobId, token, signal);
    setConverted(job); input.reload();
  }
  return <div className="stack"><Link className="back" to={`${base.path}/briefing`}>← 진료 전 브리핑</Link><WorkflowSteps current={1} /><VisitContext path={base.api} />
    <Recorder allowed={input.data.canUploadAudio} busy={action.busy} onRecordingChange={setRecording} onFinish={recorded => {
      setFile(recorded); setUploadId(undefined); setConverted(null);
      void action.run(async (token, signal) => { await transcribe(token, signal, recorded); navigate(`${base.path}/documents`); });
    }} />
    <Card><h2>진료 음성 파일</h2><p>준비한 가상 진료 음성 파일을 올리면 글자로 바꿔요.</p>
      {!input.data.canUploadAudio && <p className="warning">녹음 파일 업로드가 허용되지 않았어요.</p>}
      <label>음성 파일 선택<input data-testid="audio-input" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm" disabled={action.busy || recording || !input.data.canUploadAudio} onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadId(undefined); setConverted(null); }} /></label>
      <p className="footnote">가상 음성만 · 20MB 이하</p><button data-testid="transcribe-button" disabled={action.busy || recording || !file || !input.data.canUploadAudio || Boolean(converted)} onClick={() => void action.run(transcribe)}>글자로 바꾸기{uploadId && !converted ? ' · 다시 시도' : ''}</button>
      {converted && <p data-testid="transcribe-result">변환 완료 <Saved mode={converted.mode!} /></p>}
    </Card>
    {briefing.data?.blocks.companion && <Card><h2>오늘 물어볼 질문</h2>{briefing.data.questions.map(q => <label className="choice" key={q.id}><input type="checkbox" checked={workflow.checks[base.api]?.includes(q.id) ?? false} onChange={e => workflow.setChecks(base.api, e.target.checked ? [...(workflow.checks[base.api] ?? []), q.id] : (workflow.checks[base.api] ?? []).filter(id => id !== q.id))} />{q.text}</label>)}<p className="footnote">체크는 이 로그인에서만 유지돼요.</p></Card>}
    <Card><label>진료 메모<textarea data-testid="note-input" maxLength={2000} value={note} disabled={action.busy} onChange={e => setNote(e.target.value)} /></label>
      <button data-testid="note-save" disabled={action.busy || recording || !note.trim()} onClick={() => void action.run(async (token, signal) => {
        await request(`${base.api}/notes`, token, signal, { text: note.trim() });
        setNote(''); setNoteCount(n => n + 1); setMessage(`메모 ${noteCount + 1}개 저장됨`); input.reload();
      })}>메모 저장</button>{message && <p role="status">{message}</p>}</Card>
    {action.busy && <p role="status" data-testid="job-status">정리하는 중…</p>}{action.error && <p role="alert" className="error">{action.error}</p>}
    <button data-testid="documents-link" disabled={recording || action.busy} onClick={() => navigate(`${base.path}/documents`)}>문서 올리기 · 선택</button>
    <button className="primary" data-testid="structure-button" disabled={action.busy || recording || input.data.recordInputVersion === 0} onClick={() => void action.run(async (token, signal) => {
      try {
        const accepted = await request<{ jobId: string }>(`${base.api}/structure`, token, signal, { inputVersion: input.data!.recordInputVersion });
        await waitForJob(accepted.jobId, token, signal); navigate(`${base.path}/review`);
      } catch (error) { if (!signal.aborted) input.reload(); throw error; }
    })}>정리하기{action.error ? ' · 다시 시도' : ''}</button>
    <Link className="button" to={`${base.path}/review`}>저장된 검토본 확인</Link>
  </div>;
}

export function ReviewPage() {
  const base = useVisitBase(), r = useResource<VisitView>(`${base.api}?view=draft`);
  const action = useAction(), { invalidate, notify } = useContext(SessionContext);
  const [confirm, setConfirm] = useState(false);
  // Keep the exact body/key after an unknown network outcome. Never silently upgrade versions.
  const intent = useRef<ShareRequest | null>(null);
  if (!r.data) return <State error={r.error} retry={r.reload} />;
  const draft = r.data.record;
  if (!draft || draft.view !== 'draft') return <Card><p>검토할 정리가 없어요.</p><Link to={`${base.path}/record`}>진료 입력으로</Link></Card>;
  const shareable = draft.state === 'ready' && draft.shareable && !draft.stale;
  return <div className="stack"><Link className="back" to={`${base.path}/record`}>← 진료 입력</Link><WorkflowSteps current={3} /><VisitContext path={base.api} />
    <Card testid="review-state"><h2>내용을 확인한 뒤 공유해 주세요</h2><Saved mode={draft.mode} />
      {draft.state === 'blocked' && <p data-testid="review-blocked" className="warning">가족에게 보이면 안 되는 내용이 섞였을 수 있어요. 입력을 수정한 뒤 다시 정리해 주세요.</p>}
      {draft.stale && <p data-testid="review-stale" className="warning">입력이 바뀌었어요. 다시 정리하고 검토해 주세요.</p>}
      {draft.issues.length > 0 && <p className="warning">확인 필요로 표시된 항목을 확인해 주세요.</p>}
    </Card><RecordCard value={r.data} testid="review-record" />
    {draft.blocks.full && <Link className="button" to={`/p/${base.pid}/alerts`}>서로 다른 기록 확인하기</Link>}
    <Card><h2>첨부 문서 · 선택</h2><p className="footnote">문서 확인 화면을 체험할 수 있어요. 실제 문서 저장·판독은 준비 중이에요.</p><Link className="button" to={`${base.path}/documents`}>문서 추가하기</Link></Card>
    <Card className="ai-panel"><h2>다음 이용자를 위한 방문 경험</h2><p className="footnote">안내 순서·대기 구간 입력 화면을 둘러봐요.</p><Link className="button" data-testid="experience-link" to={`${base.path}/experience`}>방문 경험 남기기</Link></Card>
    {action.error && <p role="alert" className="error">{action.error}</p>}
    <button className="primary" data-testid="share-button" disabled={!shareable || action.busy} onClick={() => setConfirm(true)}>가족에게 공유하기</button>
    {confirm && <Card><div role="dialog" aria-modal="true" aria-labelledby="share-title"><h2 id="share-title">공유할까요?</h2><p>허용된 가족에게 이 정리가 보여요.</p>
      <button className="primary" data-testid="share-confirm" disabled={!shareable || action.busy} onClick={() => void action.run(async (token, signal) => {
        if (!intent.current || intent.current.draftVersion !== draft.version || intent.current.inputVersion !== draft.inputVersion) intent.current = { draftVersion: draft.version, inputVersion: draft.inputVersion, idempotencyKey: crypto.randomUUID() };
        try {
          await request<ShareResponse>(`${base.api}/share`, token, signal, intent.current);
          setConfirm(false); notify('공유했어요.'); invalidate();
        } catch (error) { if (!signal.aborted) { setConfirm(false); r.reload(); } throw error; }
      })}>{action.busy ? '공유 중…' : '공유 확정'}</button><button disabled={action.busy} onClick={() => setConfirm(false)}>취소</button>
    </div></Card>}
  </div>;
}
