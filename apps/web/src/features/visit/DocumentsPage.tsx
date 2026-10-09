import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { BriefingRes, RecordInputResponse, VisitView } from '@baton/contracts';
import { useResource } from '../../app/session';
import { Card, State, useVisitBase, VisitContext } from '../../components/ui';
import { request, waitForJob } from '../../lib/api';
import { useAction } from '../../lib/use-action';
import { useWorkflow, PreviewNotice, WorkflowSteps } from './Workflow';

export function DocumentsPage() {
  const base = useVisitBase(), navigate = useNavigate(), workflow = useWorkflow();
  const input = useResource<RecordInputResponse>(`${base.api}/record-input`);
  const visit = useResource<VisitView>(base.api);
  const [category, setCategory] = useState('자동 인식'), [error, setError] = useState('');
  const document = workflow.documents[base.api];
  if (!input.data) return <State error={input.error} retry={input.reload} />;
  function select(file: File | undefined) {
    setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('JPG·PNG 파일 하나를 10MB 이하로 선택해 주세요.'); return; }
    workflow.setDocument(base.api, { file, category, date: '', dept: visit.data?.meta.dept ?? '', text: '' });
  }
  return <div className="stack"><Link className="back" to={`${base.path}/record`}>← 진료 녹음·메모</Link><WorkflowSteps current={2} /><VisitContext path={base.api} />
    <PreviewNotice>문서 선택·확인 흐름을 체험해요. 서버 업로드와 AI 판독은 아직 연결되지 않았어요.</PreviewNotice>
    <Card><h2>문서 종류</h2><div className="chips">{['자동 인식', '처방전', '진단서', '검사 안내문', '약봉투', '병원 약도'].map(c => <button key={c} aria-pressed={category === c} onClick={() => { setCategory(c); if (document) workflow.setDocument(base.api, { ...document, category: c }); }}>{c}</button>)}</div></Card>
    <Card><h2>올릴 문서</h2><div className="upload-options"><label className="button">사진 찍기<input className="visually-hidden" aria-label="문서 사진 찍기" type="file" accept="image/jpeg,image/png" capture="environment" onChange={e => select(e.target.files?.[0])} /></label>
      <label className="button">앨범에서 선택<input data-testid="document-input" className="visually-hidden" aria-label="문서 사진 선택" type="file" accept="image/jpeg,image/png" onChange={e => select(e.target.files?.[0])} /></label></div><p className="footnote">JPG·PNG 한 장 · 10MB 이하 · 가상 문서만</p>
      {document && <div className="inner-card"><p>{document.file.name}</p><small>아직 업로드하지 않았어요.</small><button onClick={() => workflow.setDocument(base.api, undefined)}>선택 취소</button></div>}
      {error && <p role="alert" className="error">{error}</p>}
    </Card>
    <button className="primary" data-testid="document-next" disabled={!document} onClick={() => navigate(`${base.path}/documents/confirm`)}>문서 확인하기</button>
    <Link className="button" to={`${base.path}/documents/confirm`}>문서 없이 계속하기</Link>
  </div>;
}

export function DocumentConfirmPage() {
  const base = useVisitBase(), navigate = useNavigate(), workflow = useWorkflow();
  const input = useResource<RecordInputResponse>(`${base.api}/record-input`);
  const briefing = useResource<BriefingRes>(`${base.api}/briefing`);
  const action = useAction(), document = workflow.documents[base.api];
  const [imageUrl, setImageUrl] = useState('');
  const full = Boolean(briefing.data?.blocks.full);
  useEffect(() => {
    if (!document || !full) { setImageUrl(''); return; }
    const url = URL.createObjectURL(document.file); setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [document?.file, full]);
  if (!input.data) return <State error={input.error} retry={input.reload} />;
  return <div className="stack"><Link className="back" to={`${base.path}/documents`}>← 문서 올리기</Link><WorkflowSteps current={2} /><VisitContext path={base.api} />
    <PreviewNotice>자동 판독 결과가 아니에요. 선택한 문서는 서버나 가족에게 저장·공유되지 않아요.</PreviewNotice>
    {document ? <><Card><h2>선택한 문서</h2><p>{document.category} · {document.file.name}</p>{full && imageUrl && <img className="document-image" data-testid="document-original" src={imageUrl} alt="직접 선택한 가상 문서" />}<p className="warning">AI가 판독한 내용은 아직 없어요. 확인하지 않은 값은 비워 두세요.</p></Card>
      {full && <Card><h2>직접 확인하기 · 화면 시연</h2><label>문서 날짜<input type="date" value={document.date} onChange={e => workflow.setDocument(base.api, { ...document, date: e.target.value })} /></label><label>문서에서 읽은 내용<textarea value={document.text} onChange={e => workflow.setDocument(base.api, { ...document, text: e.target.value })} maxLength={2000} /></label><p className="footnote">이 입력은 시연에만 사용하며 AI 정리에는 보내지 않아요.</p></Card>}</> : <Card><h2>문서 없이 진료 정리</h2><p>녹음과 저장한 메모로 진료를 정리할 수 있어요.</p></Card>}
    <Card><h2>연결할 진료</h2><VisitContext path={base.api} /><p className="footnote">지금 선택한 같은 진료에 연결해 확인해요. 문서 내용의 실제 저장은 준비 중이에요.</p></Card>
    {input.data.recordInputVersion === 0 && <p className="warning">진료 정리를 만들려면 먼저 음성을 변환하거나 진료 메모를 저장해 주세요.</p>}
    {action.busy && <p role="status" data-testid="job-status">저장된 진료 입력을 정리하는 중…</p>}{action.error && <p role="alert" className="error">{action.error}</p>}
    <button className="primary" data-testid="document-structure" disabled={action.busy || input.data.recordInputVersion === 0} onClick={() => void action.run(async (token, signal) => {
      const current = await request<RecordInputResponse>(`${base.api}/record-input`, token, signal);
      const accepted = await request<{ jobId: string }>(`${base.api}/structure`, token, signal, { inputVersion: current.recordInputVersion });
      await waitForJob(accepted.jobId, token, signal); navigate(`${base.path}/review`);
    })}>녹음·메모로 진료 정리하기</button>
    <Link className="button" to={`${base.path}/review`}>저장된 진료 정리 확인</Link><Link className="button" to={`${base.path}/record`}>진료 입력으로 돌아가기</Link>
  </div>;
}
