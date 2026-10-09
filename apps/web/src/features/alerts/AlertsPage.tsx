import { useContext, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Alert, AlertsResponse, MedFact, ResolveRequest } from '@baton/contracts';
import { SessionContext, useResource } from '../../app/session';
import { Card, State } from '../../components/ui';
import { request } from '../../lib/api';
import { useAction } from '../../lib/use-action';
const timing = [['morning', '아침'], ['lunch', '점심'], ['evening', '저녁'], ['bedtime', '취침 전']] as const;
const status = { open: '확인 필요', awaiting_confirmation: '병원 확인 예정', resolved: '해결됨' };
const actions = { detected: '차이 발견', edit_note: '메모 수정', reupload: '사진 재등록 안내', confirm_hospital: '병원 확인 예정' };

export function AlertsPage() {
  const { pid, aid } = useParams(); const r = useResource<AlertsResponse>(`/patients/${pid}/alerts`);
  if (!r.data) return <State error={r.error} retry={r.reload} />;
  if (!aid) return <div className="stack"><Link className="back" to={`/p/${pid}`}>← 가족 기록</Link><Card><h2>서로 다른 기록</h2>{r.data.alerts.length ? r.data.alerts.map(a => <Link className="button" data-testid={`alert-open-${a.id}`} key={a.id} to={`/p/${pid}/alerts/${a.id}`}>{a.dept} · {status[a.status]} · {a.summary}</Link>) : <p>확인할 기록이 없어요.</p>}</Card></div>;
  const alert = r.data.alerts.find(a => a.id === aid);
  return alert ? <AlertDetail key={`${alert.id}:${alert.history.length}`} alert={alert} canResolve={r.data.canResolve} pid={pid!} reload={r.reload} /> : <Card><p>찾을 수 없어요.</p><Link to={`/p/${pid}`}>가족 기록으로</Link></Card>;
}
function AlertDetail({ alert, canResolve, pid, reload }: { alert: Alert; canResolve: boolean; pid: string; reload: () => void }) {
  const action = useAction(), { notify } = useContext(SessionContext);
  const [editing, edit] = useState(false), [fact, setFact] = useState<MedFact>(alert.references[0].fact), [text, setText] = useState(alert.references[0].quote ?? '');
  function resolve(body: ResolveRequest) { void action.run(async (token, signal) => {
    await request(`/patients/${pid}/alerts/${alert.id}/resolve`, token, signal, body); notify('처리 결과를 저장했어요.'); reload();
  }); }
  return <div className="stack"><Link className="back" to={`/p/${pid}/alerts`}>← 기록 목록</Link>
    <Card><p>어느 쪽이 맞는지는 판단하지 않아요. 두 기록을 확인해 주세요.</p><span data-testid="alert-status" className="badge warning">{status[alert.status]}</span></Card>
    {alert.references.map((ref, index) => <Card key={index} testid={index === 0 ? 'alert-left' : 'alert-right'}><h2>{ref.type === 'observation' ? '가족 메모' : ref.type === 'record' ? '진료 정리' : '약봉투'}</h2><blockquote>{ref.quote ?? '기록에 없어요'}</blockquote><p>{ref.fact.drugName} · {ref.fact.dose ?? '기록에 없어요'} · {ref.fact.timing?.map(t => timing.find(v => v[0] === t)?.[1]).join('·') ?? '기록에 없어요'}</p></Card>)}
    <Card testid="alert-summary"><h2>다른 점</h2><p>{alert.summary}</p></Card>
    {canResolve && <Card>{alert.kind === 'observation_vs_prescription' ? <button data-testid="resolve-edit" disabled={action.busy} onClick={() => edit(!editing)}>메모 고치기</button> : <p>진료 입력을 수정한 뒤 다시 정리해 주세요.</p>}
      {editing && <form onSubmit={e => { e.preventDefault(); resolve({ action: 'edit_note', fact, text }); }}><p>{fact.drugName}</p><label>1회 복용량<input value={fact.dose ?? ''} onChange={e => setFact({ ...fact, dose: e.target.value.trim() || null })} /></label>
        <fieldset><legend>복용 시간</legend>{timing.map(([key, name]) => <label className="choice" key={key}><input type="checkbox" checked={fact.timing?.includes(key) ?? false} onChange={e => setFact({ ...fact, timing: e.target.checked ? [...(fact.timing ?? []), key] : (fact.timing ?? []).filter(t => t !== key) })} />{name}</label>)}</fieldset>
        <label>수정한 메모<textarea required value={text} onChange={e => setText(e.target.value)} /></label><button data-testid="resolve-edit-save" disabled={action.busy}>메모 수정 저장</button></form>}
      <button data-testid="resolve-reupload" disabled={action.busy} onClick={() => resolve({ action: 'reupload' })}>사진 다시 올리기 안내</button><p className="footnote">사진 업로드는 준비 중이에요. 이 버튼은 재등록 안내 이력만 남겨요.</p>
      <button data-testid="resolve-hospital" disabled={action.busy} onClick={() => resolve({ action: 'confirm_hospital' })}>병원에 확인할게요</button>
    </Card>}
    {action.error && <p role="alert" className="error">{action.error}</p>}
    <Card testid="alert-history"><h2>처리 이력</h2>{alert.history.map((h, i) => <p key={i}>{actions[h.action]}<small>{h.at}</small>{h.note && <span>{h.note}</span>}</p>)}</Card>
  </div>;
}
