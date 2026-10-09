import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { z } from 'zod';
import type { hospitalResponseSchema } from '@baton/contracts';
import { useResource } from '../../app/session';
import { Card, State } from '../../components/ui';
type Hospital = z.infer<typeof hospitalResponseSchema>;
export function HospitalPage() {
  const { hid } = useParams();
  const r = useResource<Hospital>(`/hospitals/${hid}`);
  const [tab, setTab] = useState<'map' | 'floor'>('map'), [copy, setCopy] = useState('');
  if (!r.data) return <State error={r.error} retry={r.reload} />;
  const h = r.data;
  async function copyAddress() {
    try { await navigator.clipboard.writeText(h.address); setCopy('주소를 복사했어요.'); }
    catch { setCopy('복사하지 못했어요. 아래 주소를 선택해 복사해 주세요.'); }
  }
  return <div className="stack"><h2>{h.name}</h2><p className="warning card">{h.notice}</p>
    <div className="chips depts" aria-label="병원 안내 화면"><button aria-pressed={tab === 'map'} onClick={() => setTab('map')}>병원 위치</button><button aria-pressed={tab === 'floor'} onClick={() => setTab('floor')}>원내 약도</button></div>
    {tab === 'map' ? <Card><img className="hospital-image" data-testid="hospital-map" src={h.mapImage} alt={`${h.name} 가상 위치 그림. 바통로의 병원 표시이며 실제 지도나 길찾기가 아닙니다.`} /><h3>가상 주소</h3><p>{h.address}</p><button onClick={() => void copyAddress()}>주소 복사</button>{copy && <p role="status">{copy}</p>}<h3>가상 전화</h3><a className="button" href={`tel:${h.phone.split(' ')[0]}`}>{h.phone}</a></Card>
      : <><Card><img className="hospital-image" data-testid="hospital-floor" src={h.floorImage} alt="정적 약도: 1층 접수, 2층 채혈, 3층 내과, 1층 수납, 건물 밖 약국. 계산된 경로가 아닙니다." /><h3>안내 순서</h3><ol data-testid="guide-steps">{h.guideSteps.map(s => <li key={s.order}>{s.place} · {s.floor}</li>)}</ol><p className="footnote">시드의 가상 안내 순서입니다. 실제 검사·방문 순서는 병원에 확인해 주세요.</p></Card><Card><h3>다른 이용자의 참고 경험</h3><p>가상 경험이며 공식 안내가 아닙니다.</p>{h.experiences.map(e => <div className="inner-card" key={e.id}><p>{e.order.join(' → ')}</p><p>대기 경험: {e.waitBand}</p><p>{e.tip}</p></div>)}</Card></>}
  </div>;
}
