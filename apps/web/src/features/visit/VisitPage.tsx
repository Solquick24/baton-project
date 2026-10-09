import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { BriefingRes, Job, RecordInputResponse, ShareRequest, ShareResponse, VisitView } from '@baton/contracts';
import { SessionContext, useResource } from '../../app/session';
import { Card, Saved, State, RecordCard, useVisitBase, VisitContext } from '../../components/ui';
import { ApiError, request, waitForJob } from '../../lib/api';
import type { z } from 'zod';
import type { noteResponseSchema } from '@baton/contracts';
import { useAction } from '../../lib/use-action';

export function VisitPage() {
  const base = useVisitBase(), navigate = useNavigate();
  const input = useResource<RecordInputResponse>(`${base.api}/record-input`);
  const briefing = useResource<BriefingRes>(`${base.api}/briefing`);
  const action = useAction();
  const [file, setFile] = useState<File | null>(null), [uploadId, setUploadId] = useState<string>();
  const [note, setNote] = useState(''), [savedNote, setSavedNote] = useState('');
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [operation, setOperation] = useState<'transcribe' | 'structure' | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [converted, setConverted] = useState<Job | null>(null), [loaded, setLoaded] = useState(false);
  const version = useRef(0);
  const denied = input.error instanceof ApiError && [401,403,404].includes(input.error.status);
  useEffect(() => {
    if (input.data) { setLoaded(true); version.current = Math.max(version.current, input.data.recordInputVersion); }
    if (denied) { setNote(''); setSavedNote(''); setChecked({}); setFile(null); setUploadId(undefined); setConverted(null); setNoteStatus('idle'); }
  }, [input.data, denied]);
  if ((!input.data && !loaded) || denied) return <State error={input.error} retry={input.reload} />;
  const dirty = note.trim() !== savedNote && Boolean(note.trim());
  const canMutate = Boolean(input.data) && !action.busy;
  async function transcribe(token: string, signal: AbortSignal) {
    if (!file) return;
    setOperation('transcribe');
    try {
      let id = uploadId;
      if (!id) { const form = new FormData(); form.append('file', file); id = (await request<{ uploadId: string }>(`${base.api}/audio`, token, signal, form)).uploadId; setUploadId(id); }
      const accepted = await request<{ jobId: string }>(`${base.api}/transcribe`, token, signal, { uploadId: id });
      setConverted(await waitForJob(accepted.jobId, token, signal)); input.reload();
    } finally { if (!signal.aborted) setOperation(null); }
  }
  return <div className="stack"><Link className="back" to={`/p/${base.pid}`}>← 가족 기록</Link><VisitContext path={base.api} />
    {!input.data && <p className="footnote">입력 권한과 최신 버전을 확인하고 있어요.</p>}
    {input.error && <p className="error">입력 정보를 확인하지 못했어요. <button onClick={input.reload}>다시 확인</button></p>}
    <Card><h2>진료 음성 파일</h2><p>준비한 가상 진료 음성 파일을 올리면 글자로 바꿔요.</p>
      {input.data && !input.data.canUploadAudio && <p className="warning">녹음 파일 업로드가 허용되지 않았어요.</p>}
      <label>음성 파일 선택<input data-testid="audio-input" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm" disabled={!canMutate || !input.data?.canUploadAudio} onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadId(undefined); setConverted(null); }} /></label>
      <p className="footnote">가상 음성만 · 20MB 이하</p><button data-testid="transcribe-button" disabled={!canMutate || !file || !input.data?.canUploadAudio || Boolean(converted)} onClick={() => void action.run(transcribe)}>글자로 바꾸기{uploadId && !converted ? ' · 다시 시도' : ''}</button>
      {converted && <p data-testid="transcribe-result">변환 완료 <Saved mode={converted.mode!} /></p>}
    </Card>
    {briefing.data?.blocks.companion && <Card><h2>오늘 물어볼 질문</h2>{briefing.data.questions.map(q => <label className="choice" key={q.id}><input type="checkbox" checked={Boolean(checked[q.id])} onChange={e => setChecked(v => ({...v, [q.id]:e.target.checked}))} />{q.text}</label>)}</Card>}
    <Card><label>진료 메모<textarea data-testid="note-input" maxLength={2000} value={note} disabled={action.busy} onChange={e => setNote(e.target.value)} /></label>
      <button data-testid="note-save" disabled={!canMutate || !dirty} onClick={() => void action.run(async (token, signal) => {
        const text = note.trim(); setNoteStatus('saving');
        try {
          const saved = await request<z.infer<typeof noteResponseSchema>>(`${base.api}/notes`, token, signal, { text });
          version.current = saved.recordInputVersion; setSavedNote(text); setNoteStatus('saved'); input.reload();
        } catch (error) { if (!signal.aborted) setNoteStatus('failed'); throw error; }
      })}>{noteStatus === 'saving' ? '메모 저장 중…' : '메모 저장'}</button>
      {noteStatus !== 'idle' && <p data-testid="note-message" role="status">{noteStatus === 'saving' ? '메모를 저장하고 있어요.' : noteStatus === 'saved' ? '메모를 저장했어요.' : '메모 저장에 실패했어요. 입력을 유지했으니 다시 시도해 주세요.'}</p>}
    </Card>
    {action.busy && operation && <p role="status" data-testid="job-status">{operation === 'transcribe' ? '음성을 글자로 바꾸는 중…' : '정리하는 중…'}</p>}
    {action.error && <p role="alert" className="error">{action.error}</p>}
    {dirty && <p className="warning">바꾼 메모를 먼저 저장한 뒤 정리해 주세요.</p>}
    <button className="primary" data-testid="structure-button" disabled={!canMutate || dirty || input.data?.recordInputVersion === 0} onClick={() => void action.run(async (token, signal) => {
      setOperation('structure');
      try {
        // Re-read permission/version at the action boundary, including immediate save and successful job reuse.
        const latest = await request<RecordInputResponse>(`${base.api}/record-input`, token, signal);
        version.current = Math.max(version.current, latest.recordInputVersion);
        const accepted = await request<{ jobId: string }>(`${base.api}/structure`, token, signal, { inputVersion: version.current });
        const job = await waitForJob(accepted.jobId, token, signal);
        const view = await request<VisitView>(`${base.api}?view=draft`, token, signal), draft = view.record;
        if (!draft || draft.view !== 'draft' || draft.version !== job.resultVersion || draft.inputVersion !== latest.recordInputVersion || draft.stale) throw new ApiError(409, '입력이 바뀌었어요. 최신 내용을 확인하고 다시 정리해 주세요.', 'stale_input');
        navigate(`${base.path}/review`);
      } catch (error) { if (!signal.aborted) input.reload(); throw error; }
      finally { if (!signal.aborted) setOperation(null); }
    })}>정리하기{action.error ? ' · 다시 시도' : ''}</button>
    <Link className="button" to={`${base.path}/review`}>저장된 검토본 확인</Link>
  </div>;
}

export function ReviewPage() {
  const base = useVisitBase(), r = useResource<VisitView>(`${base.api}?view=draft`);
  const action = useAction(), { invalidate, notify } = useContext(SessionContext);
  const [confirm, setConfirm] = useState(false), [shared, setShared] = useState(false);
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
    {shared && <Link className="button primary" data-testid="shared-history-link" to={`/p/${base.pid}/timeline`}>공유한 기록 확인하기</Link>}
    {action.error && <p role="alert" className="error">{action.error}</p>}
    <button className="primary" data-testid="share-button" disabled={!shareable || action.busy} onClick={() => setConfirm(true)}>가족에게 공유하기</button>
    {confirm && <Card><div role="dialog" aria-modal="true" aria-labelledby="share-title"><h2 id="share-title">공유할까요?</h2><p>허용된 가족에게 이 정리가 보여요.</p>
      <button className="primary" data-testid="share-confirm" disabled={!shareable || action.busy} onClick={() => void action.run(async (token, signal) => {
        if (!intent.current || intent.current.draftVersion !== draft.version || intent.current.inputVersion !== draft.inputVersion) intent.current = { draftVersion: draft.version, inputVersion: draft.inputVersion, idempotencyKey: crypto.randomUUID() };
        try {
          await request<ShareResponse>(`${base.api}/share`, token, signal, intent.current);
          setConfirm(false); setShared(true); notify('공유했어요.'); invalidate();
        } catch (error) { if (!signal.aborted) { setConfirm(false); r.reload(); } throw error; }
      })}>{action.busy ? '공유 중…' : '공유 확정'}</button><button disabled={action.busy} onClick={() => setConfirm(false)}>취소</button>
    </div></Card>}
  </div>;
}
