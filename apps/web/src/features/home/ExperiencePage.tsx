import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { RecordInputResponse } from '@baton/contracts';
import { useResource } from '../../app/session';
import { Card, State, useVisitBase, VisitContext } from '../../components/ui';
import { PreviewNotice } from '../visit/Workflow';

const places = ['접수', '검사실', '내과 진료', '수납·약국'];
const waits = ['10분 이내', '30분', '1시간 이상'];
export function ExperiencePage() {
  const base = useVisitBase(), input = useResource<RecordInputResponse>(`${base.api}/record-input`);
  const [bands, setBands] = useState<Record<string, string>>({}), [tip, setTip] = useState(''), [anonymous, setAnonymous] = useState(true), [done, setDone] = useState(false);
  if (!input.data) return <State error={input.error} retry={input.reload} />;
  return <div className="stack"><Link className="back" to={`${base.path}/review`}>← 진료 정리</Link><VisitContext path={base.api} />
    <PreviewNotice>방문 경험 입력 화면이에요. 서버 저장과 공개는 아직 연결되지 않았어요.</PreviewNotice>
    <Card className="ai-panel"><p>녹음과 문서에서 순서를 자동 추출하지 않아요. 경험한 순서와 대기를 직접 선택해 주세요.</p></Card>
    <form className="stack" onSubmit={e => { e.preventDefault(); setDone(true); }}>
      <Card><h2>오늘 다녀온 순서와 대기</h2>{places.map((place, index) => <fieldset className="experience-step" key={place}><legend><span className="step-number">{index + 1}</span> {place}</legend><div className="segmented">{waits.map(wait => <label key={wait}><input type="radio" name={place} checked={bands[place] === wait} onChange={() => { setBands({ ...bands, [place]: wait }); setDone(false); }} />{wait}</label>)}</div></fieldset>)}</Card>
      <Card><label>한 줄 팁 · 선택<input maxLength={200} value={tip} onChange={e => { setTip(e.target.value); setDone(false); }} placeholder="다음 이용자에게 전하고 싶은 팁" /></label><label className="choice"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />익명으로 공개 · 화면 시연</label><p className="footnote">이름·진료 내용은 팁에 적지 마세요. 지금 입력은 공개되지 않아요.</p></Card>
      {done && <Card testid="experience-preview"><p role="status">입력한 화면을 확인했어요. 서버에 저장하거나 공개하지 않았어요.</p><p>{places.map(p => `${p}: ${bands[p] ?? '선택 안 함'}`).join(' · ')}</p>{tip && <p>{tip}</p>}</Card>}
      <button className="primary" data-testid="experience-confirm">입력 내용 확인하기</button>
    </form><Link className="button" to={`${base.path}/review`}>건너뛰고 진료 정리로</Link>
  </div>;
}
