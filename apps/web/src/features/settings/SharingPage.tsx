import { useContext, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MembersResponse, ShareLog } from '@baton/contracts';
import { SessionContext, useResource } from '../../app/session';
import { Card, State } from '../../components/ui';
import { request } from '../../lib/api';
import { useAction } from '../../lib/use-action';

const choices = [
  ['schedule', '일정만', '진료 날짜·시간·병원·다음 일정'],
  ['companion', '동행', '일정과 약 변경·주의사항·쉬운 요약·가족 질문'],
  ['full', '전체 내용', '위 항목과 진단·수치·이유·답변·원문·불일치 상세 (민감 정보)'],
] as const;
const label = (scope: string | null) => choices.find(c => c[0] === scope)?.[1] ?? '';

export function SharingSettings({ pid }: { pid: string | undefined }) {
  return pid ? <MembersLinks pid={pid} /> : null;
}
function MembersLinks({ pid }: { pid: string }) {
  // The server decides management authority; a general full guardian still gets 403.
  const r = useResource<MembersResponse>(`/patients/${pid}/members`);
  if (r.error && 'status' in r.error && [403, 404].includes(Number(r.error.status))) return null;
  if (!r.data) return <State error={r.error} retry={r.reload} />;
  return <Card><h2>가족별 공유 범위</h2><p>민감 정보는 전체 내용에서만 보여요.</p>{r.data.members.filter(m => m.role !== 'patient' && m.active).map(m =>
    <Link className="button" data-testid={`sharing-member-${m.userId}`} key={m.userId} to={`/p/${pid}/sharing/${m.userId}`}>{m.name} · {label(m.scope)}</Link>)}</Card>;
}
export function SharingPage() {
  const { pid, uid } = useParams();
  const members = useResource<MembersResponse>(`/patients/${pid}/members`);
  const log = useResource<{ logs: ShareLog[] }>(`/patients/${pid}/members/${uid}/share-log`);
  const [selected, select] = useState<MembersResponse['members'][number]['scope'] | undefined>();
  const action = useAction(); const { invalidate, notify } = useContext(SessionContext);
  if (!members.data) return <State error={members.error} retry={members.reload} />;
  const member = members.data.members.find(m => m.userId === uid && m.role !== 'patient' && m.active);
  if (!member) return <Card><p>찾을 수 없어요.</p><Link to="/settings">설정으로</Link></Card>;
  return <div className="stack"><Link className="back" to="/settings">← 설정</Link><Card><h2>{member.name}님에게 보여줄 내용</h2>
    <fieldset><legend>공유 범위 선택</legend>{choices.map(([scope, name, description]) => <label className="choice" key={scope}>
      <input type="radio" name="scope" data-testid={`scope-${scope}`} checked={(selected ?? member.scope) === scope} onChange={() => select(scope)} /><span>{name}<small>{description}</small></span>
    </label>)}</fieldset><p className="muted">비공개 메모는 어느 가족 범위에도 포함되지 않아요.</p>
    <button className="primary" data-testid="scope-save" disabled={action.busy} onClick={() => void action.run(async (token, signal) => {
      await request(`/patients/${pid}/members/${uid}/scope`, token, signal, { scope: selected ?? member.scope }, { method: 'PUT' });
      // Contains no identity, scope or clinical data; other tabs discard their current responses.
      try { localStorage.setItem('baton.permissions-revision', crypto.randomUUID()); } catch { /* focus refresh also works */ }
      notify('공유 범위를 저장했어요.'); invalidate();
    })}>{action.busy ? '저장 중…' : '저장'}</button>{action.error && <p role="alert" className="error">{action.error}</p>}</Card>
    <Card testid="share-log"><h2>공유 기록</h2>{log.data ? log.data.logs.length ? log.data.logs.map(l => <p key={l.id}>{l.action === 'scope_change' ? `범위 변경 · ${label(l.oldScope)} → ${label(l.newScope)}` : l.action === 'publish' ? '진료 정리 공유' : l.action === 'start' ? '공유 시작' : '공유 중단'}<small>{l.actor.name} · {l.at}</small></p>) : <p>기록이 없어요.</p> : <State error={log.error} retry={log.reload} />}</Card>
  </div>;
}
