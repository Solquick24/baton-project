import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { HomeRes, TimelineResponse, VisitView } from '@baton/contracts';
import { useResource } from '../../app/session';
import { Card, Check, Items, RecordCard, State, useVisitBase } from '../../components/ui';

export function EasySummaryPage() {
  const base = useVisitBase(), r = useResource<VisitView>(`${base.api}?view=published`);
  if (!r.data) return <State error={r.error} retry={r.reload} />;
  const blocks = r.data.record?.blocks;
  return <div className="stack"><Link className="back" to={`/p/${base.pid}/timeline`}>← 타임라인</Link><p className="footnote">공유된 진료 정리의 저장된 내용을 보여줘요.</p>
    {blocks?.companion ? <><Card><h2>쉬운 말 진료 요약</h2><Items values={blocks.companion.easySummary} /></Card><Card><h2>약의 바뀐 점</h2>{blocks.companion.medChanges.map(m => <p key={m.id}>{m.drug}<br />{m.from ?? '기록에 없어요'} → {m.to ?? '기록에 없어요'} <Check yes={m.needsCheck} /></p>)}</Card></> : <Card><p>보여줄 쉬운 요약이 없어요.</p></Card>}
    {blocks?.schedule && <Card><h2>다음 일정</h2>{blocks.schedule.nextSchedule.map(s => <p key={s.id}>{s.date ?? '기록에 없어요'} {s.time} <Check yes={s.needsCheck} /></p>)}</Card>}
  </div>;
}
export function FlowPage() {
  const { pid } = useParams(), [params] = useSearchParams();
  const home = useResource<HomeRes>(`/patients/${pid}/home`), dept = params.get('dept') ?? home.data?.depts[0];
  const r = useResource<TimelineResponse>(dept ? `/patients/${pid}/timeline?dept=${encodeURIComponent(dept)}` : null);
  if (!home.data) return <State error={home.error} retry={home.reload} />;
  if (!r.data) return <State error={r.error} retry={r.reload} />;
  return <div className="stack"><Link className="back" to={`/p/${pid}/timeline`}>← 타임라인</Link><h2>{dept} 진료 흐름</h2><p className="footnote">같은 진료과의 공유된 기록을 날짜순으로 모았어요. 새 AI 해석을 만들지 않아요.</p>
    <div className="timeline stack">{[...r.data.items].reverse().map(v => <RecordCard key={v.meta.id} value={v} testid={`flow-card-${v.meta.id}`} />)}</div>{!r.data.items.length && <Card><p>공유된 기록이 없어요.</p></Card>}
  </div>;
}
