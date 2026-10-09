import { useContext, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { BriefingRes, Job, RecordInputResponse, ShareRequest, ShareResponse, VisitView } from '@baton/contracts';
import { SessionContext, useResource } from '../../app/session';
import { Card, Saved, State, RecordCard, useVisitBase, VisitContext } from '../../components/ui';
import { request, waitForJob } from '../../lib/api';
import { useAction } from '../../lib/use-action';

export function VisitPage() {
  const base = useVisitBase(), navigate = useNavigate();
  const input = useResource<RecordInputResponse>(`${base.api}/record-input`);
  const briefing = useResource<BriefingRes>(`${base.api}/briefing`);
  const action = useAction(); const [file, setFile] = useState<File | null>(null), [uploadId, setUploadId] = useState<string>();
  const [note, setNote] = useState(''), [noteCount, setNoteCount] = useState(0), [message, setMessage] = useState('');
  const [converted, setConverted] = useState<Job | null>(null);
  if (!input.data) return <State error={input.error} retry={input.reload} />;
  async function transcribe(token: string, signal: AbortSignal) {
    if (!file) return;
    setMessage('');
    let id = uploadId;
    if (!id) { const form = new FormData(); form.append('file', file); id = (await request<{ uploadId: string }>(`${base.api}/audio`, token, signal, form)).uploadId; setUploadId(id); }
    const accepted = await request<{ jobId: string }>(`${base.api}/transcribe`, token, signal, { uploadId: id });
    const job = await waitForJob(accepted.jobId, token, signal);
    setConverted(job); input.reload();
  }
  return <div className="stack"><Link className="back" to={`/p/${base.pid}`}>← 가족 기록</Link><VisitContext path={base.api} />
    <Card><h2>진료 음성 파일</h2><p>준비한 가상 진료 음성 파일을 올리면 글자로 바꿔요.</p>
      {!input.data.canUploadAudio && <p className="warning">녹음 파일 업로드가 허용되지 않았어요.</p>}
      <label>음성 파일 선택<input data-testid="audio-input" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm" disabled={action.busy || !input.data.canUploadAudio} onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadId(undefined); setConverted(null); }} /></label>
      <p className="footnote">가상 음성만 · 20MB 이하</p><button data-testid="transcribe-button" disabled={action.busy || !file || !input.data.canUploadAudio || Boolean(converted)} onClick={() => void action.run(transcribe)}>글자로 바꾸기{uploadId && !converted ? ' · 다시 시도' : ''}</button>
      {converted && <p data-testid="transcribe-result">변환 완료 <Saved mode={converted.mode!} /></p>}
    </Card>
    {briefing.data?.blocks.companion && <Card><h2>오늘 물어볼 질문</h2>{briefing.data.questions.map(q => <label className="choice" key={q.id}><input type="checkbox" />{q.text}</label>)}</Card>}
    <Card><label>진료 메모<textarea data-testid="note-input" maxLength={2000} value={note} disabled={action.busy} onChange={e => setNote(e.target.value)} /></label>
      <button data-testid="note-save" disabled={action.busy || !note.trim()} onClick={() => void action.run(async (token, signal) => {
        await request(`${base.api}/notes`, token, signal, { text: note.trim() });
        setNote(''); setNoteCount(n => n + 1); setMessage(`메모 ${noteCount + 1}개 저장됨`); input.reload();
      })}>메모 저장</button>{message && <p role="status">{message}</p>}</Card>
    {action.busy && <p role="status" data-testid="job-status">정리하는 중…</p>}{action.error && <p role="alert" className="error">{action.error}</p>}
    <button className="primary" data-testid="structure-button" disabled={action.busy || input.data.recordInputVersion === 0} onClick={() => void action.run(async (token, signal) => {
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
  return <div className="stack"><Link className="back" to={`${base.path}/record`}>← 진료 입력</Link><VisitContext path={base.api} />
    <Card testid="review-state"><h2>내용을 확인한 뒤 공유해 주세요</h2><Saved mode={draft.mode} />
      {draft.state === 'blocked' && <p data-testid="review-blocked" className="warning">가족에게 보이면 안 되는 내용이 섞였을 수 있어요. 입력을 수정한 뒤 다시 정리해 주세요.</p>}
      {draft.stale && <p data-testid="review-stale" className="warning">입력이 바뀌었어요. 다시 정리하고 검토해 주세요.</p>}
      {draft.issues.length > 0 && <p className="warning">확인 필요로 표시된 항목을 확인해 주세요.</p>}
    </Card><RecordCard value={r.data} testid="review-record" />
    {draft.blocks.full && <Link className="button" to={`/p/${base.pid}/alerts`}>서로 다른 기록 확인하기</Link>}
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
