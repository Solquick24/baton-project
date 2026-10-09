import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BriefingRes, HomeRes } from '@baton/contracts';
import { useResource } from '../../app/session';
import { Card, Items, State, useVisitBase, VisitContext } from '../../components/ui';
import { PreviewNotice, useWorkflow } from './Workflow';

export function PrivateNotesPage() {
  const base = useVisitBase(), home = useResource<HomeRes>(`/patients/${base.pid}/home`);
  const workflow = useWorkflow(); const [text, setText] = useState(''), [include, setInclude] = useState(false);
  const [saved, setSaved] = useState(false), notes = workflow.notes[base.pid!] ?? [];
  if (!home.data) return <State error={home.error} retry={home.reload} />;
  if (home.data.me.role !== 'patient') return <Card><p>환자 본인만 사용할 수 있어요.</p><Link to={`${base.path}/briefing`}>브리핑으로</Link></Card>;
  return <div className="stack"><Link className="back" to={`${base.path}/briefing`}>← 진료 전 브리핑</Link><VisitContext path={base.api} />
    <PreviewNotice>이 로그인에서만 보관하는 비공개 메모예요. 서버 저장·가족 공유·AI 입력에 사용하지 않아요.</PreviewNotice>
    <Card><p>가족에게 말하지 않았지만 의사에게 함께 여쭤보고 싶은 내용을 적어요.</p><form onSubmit={e => {
      e.preventDefault(); if (!text.trim()) return;
      workflow.setNotes(base.pid!, [...notes, { id: crypto.randomUUID(), text: text.trim(), include }]); setText(''); setSaved(true);
    }}><label>함께 여쭤볼 내용<textarea data-testid="private-note-input" maxLength={2000} required value={text} onChange={e => { setText(e.target.value); setSaved(false); }} /></label>
      <label className="choice"><input type="checkbox" data-testid="private-note-include" checked={include} onChange={e => setInclude(e.target.checked)} />의사에게 보여주기 화면에 넣기</label>
      <button className="primary" data-testid="private-note-save" disabled={!text.trim()}>이 로그인에 메모 보관</button></form>{saved && <p role="status">시연용 메모를 보관했어요. 로그아웃하면 사라져요.</p>}</Card>
    <h2>보관한 메모</h2>{notes.length ? notes.map(note => <Card key={note.id}><span className="badge">{note.include ? '의사에게 보여주기 포함' : '나만 보기'}</span><p>{note.text}</p><button onClick={() => workflow.setNotes(base.pid!, notes.filter(n => n.id !== note.id))}>메모 삭제</button></Card>) : <Card><p>아직 메모가 없어요.</p></Card>}
    <Link className="button primary" data-testid="doctor-view-link" to={`${base.path}/doctor-view`}>진료실에서 보여주기</Link>
  </div>;
}

export function DoctorViewPage() {
  const base = useVisitBase(), home = useResource<HomeRes>(`/patients/${base.pid}/home`);
  const briefing = useResource<BriefingRes>(home.data?.me.role === 'patient' ? `${base.api}/briefing` : null);
  const workflow = useWorkflow();
  if (!home.data) return <State error={home.error} retry={home.reload} />;
  if (home.data.me.role !== 'patient') return <Card><p>환자 본인만 사용할 수 있어요.</p><Link to={`${base.path}/briefing`}>브리핑으로</Link></Card>;
  if (!briefing.data) return <State error={briefing.error} retry={briefing.reload} />;
  const d = briefing.data, notes = (workflow.notes[base.pid!] ?? []).filter(n => n.include);
  return <div className="stack doctor-view"><Link className="back" to={`${base.path}/briefing`}>← 진료 전 브리핑</Link><VisitContext path={base.api} />
    <p className="footnote">저장된 브리핑과 직접 선택한 메모만 모았어요. 새 AI 정리를 요청하지 않아요.</p>
    {d.blocks.companion && <Card><h2>지난 진료 이후 바뀐 점</h2><Items values={d.blocks.companion.briefing.changes} /></Card>}
    {d.blocks.full && <Card><h2>지켜본 증상</h2><Items values={d.blocks.full.briefing.watch} /></Card>}
    {notes.length > 0 && <Card testid="doctor-private-notes"><h2>말씀드리고 싶은 것</h2><span className="badge">직접 선택한 비공개 메모</span>{notes.map(n => <p key={n.id}>{n.text}</p>)}</Card>}
    <Card><h2>가족이 궁금한 것</h2><ol className="questions-list">{d.questions.map(q => <li key={q.id}>{q.text}</li>)}</ol></Card>
    <div className="action-row"><Link className="button" to={`${base.path}/private-notes`}>메모 고치기</Link><Link className="button primary" to={`${base.path}/briefing`}>닫기</Link></div>
  </div>;
}
