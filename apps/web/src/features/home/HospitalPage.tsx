import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { hospitalResponseSchema } from '@baton/contracts';
import { Card, State } from '../../components/ui';

type Hospital = ReturnType<typeof hospitalResponseSchema.parse>;
export function useHospital(hid: string | undefined) {
  const [result, setResult] = useState<{ hid: string | undefined; data?: Hospital; error?: Error }>({ hid: undefined });
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const c = new AbortController(); setResult({ hid });
    if (!hid) return () => c.abort();
    fetch('/hospital/guide.json', { signal: c.signal }).then(async response => {
      if (!response.ok) throw new Error('병원 안내를 불러오지 못했어요.');
      const data = hospitalResponseSchema.parse(await response.json());
      if (data.id !== hid) throw new Error('병원 안내가 없어요.');
      if (!c.signal.aborted) setResult({ hid, data });
    }).catch(error => { if (!c.signal.aborted) setResult({ hid, error }); });
    return () => c.abort();
  }, [hid, attempt]);
  return { ...(result.hid === hid ? result : {}), reload: () => retry(v => v + 1) };
}

export function HospitalPreview({ hid, returnTo }: { hid: string; returnTo: string }) {
  const hospital = useHospital(hid);
  if (!hospital.data) return <State error={hospital.error} retry={hospital.reload} />;
  return <Card testid="hospital-preview"><div className="section-heading"><h2>병원 위치·원내 안내</h2><span className="badge">정적 안내</span></div>
    <img className="hospital-image" src={hospital.data.floorImage} alt={`${hospital.data.name} 층별 약도`} />
    <p className="footnote">{hospital.data.guideSteps.map(step => step.place).join(' → ')}</p>
    <p className="footnote">검사 필요 여부와 순서는 병원에서 확인해 주세요.</p>
    <Link className="button" data-testid="hospital-link" to={`/hospital/${hid}?tab=floor`} state={{ returnTo }}>병원 위치·약도 보기</Link>
  </Card>;
}

export function HospitalPage() {
  const { hid } = useParams(); const hospital = useHospital(hid);
  const [params, setParams] = useSearchParams(); const location = useLocation();
  const floor = params.get('tab') === 'floor'; const [copied, setCopied] = useState('');
  const returnTo = typeof location.state?.returnTo === 'string' && location.state.returnTo.startsWith('/p/') ? location.state.returnTo : '/';
  if (!hospital.data) return <State error={hospital.error} retry={hospital.reload} />;
  const d = hospital.data;
  return <div className="stack"><Link className="back" to={returnTo}>{returnTo.endsWith('/briefing') ? '진료 전 브리핑으로' : '가족 기록으로'}</Link>
    <h2>{d.name}</h2><p className="footnote">{d.notice}</p>
    <div className="segmented" role="tablist" aria-label="병원 안내"><button role="tab" aria-selected={!floor} aria-controls="hospital-panel" onClick={() => setParams({ tab: 'map' }, { state: location.state })}>병원 위치</button><button role="tab" aria-selected={floor} aria-controls="hospital-panel" onClick={() => setParams({ tab: 'floor' }, { state: location.state })}>원내 약도</button></div>
    <div className="stack" role="tabpanel" id="hospital-panel" aria-label={floor ? '원내 약도' : '병원 위치'}>
      <Card><img className="hospital-image" data-testid={floor ? 'hospital-floor' : 'hospital-map'} src={floor ? d.floorImage : d.mapImage} alt={`${d.name} ${floor ? '층별 안내 약도' : '가상 위치 지도'}`} /></Card>
      {floor ? <><Card><h2>안내 순서</h2><ol className="guide-steps" data-testid="guide-steps">{d.guideSteps.map(s => <li key={s.order}><span className="step-number">{s.order}</span><div>{s.place}<small>{s.floor}</small></div></li>)}</ol><p className="footnote">정적 안내예요. 실제 검사 여부·순서는 병원에서 확인해 주세요.</p></Card>
        <Card><h2>다른 이용자의 가상 경험</h2><p className="footnote">참고용이며 공식 안내가 아니에요.</p>{d.experiences.map(e => <div className="inner-card" key={e.id}><p>{e.order.join(' → ')}</p><span className="badge">대기 {e.waitBand}</span><p>{e.tip}</p></div>)}</Card></> : <Card><h2>주소</h2><p>{d.address}</p><button onClick={async () => {
          try { await navigator.clipboard.writeText(d.address); setCopied('주소를 복사했어요.'); } catch { setCopied('복사하지 못했어요. 위 주소를 직접 선택해 주세요.'); }
        }}>주소 복사</button>{copied && <p role="status">{copied}</p>}<h3>전화</h3><p>{d.phone}</p><p className="footnote">가상 번호이므로 전화 연결은 제공하지 않아요.</p></Card>}
    </div>
  </div>;
}
