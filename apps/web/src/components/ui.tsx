import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Item, Mode, SourceRef, VisitMeta, VisitView } from '@baton/contracts';
import { ApiError, request } from '../lib/api';
import { SessionContext, useResource } from '../app/session';

export function State({ error, retry }: { error?: Error | undefined; retry: () => void }) {
  return <section className="card state" aria-live="polite"><h2>{error ? error instanceof ApiError && error.status === 404 ? '찾을 수 없어요' : '불러오지 못했어요' : '불러오는 중…'}</h2>
    {error && <><p>{error.message}</p><button onClick={retry}>다시 시도</button><Link className="text-link" to="/me">홈으로</Link></>}
  </section>;
}

export function Card({ children, className = '', testid }: { children: ReactNode; className?: string; testid?: string }) { return <section className={`card ${className}`} data-testid={testid}>{children}</section>; }

export function Check({ yes }: { yes: boolean }) { return yes ? <span className="badge warning">! 확인 필요</span> : null; }

export function Saved({ mode }: { mode: Mode }) { return <span className="badge">{mode === 'fixture' ? '저장된 결과' : '실시간 AI'}</span>; }

export function Sources({ refs, itemId, testid }: { refs: SourceRef[]; itemId: string; testid?: string }) {
  const matching = refs.filter(ref => ref.itemId === itemId);
  if (!matching.length) return null;
  return <details className="sources" data-testid={testid ?? `source-button-${itemId}`}><summary>원문 보기</summary>{matching.map((ref, i) => <blockquote key={i}>{ref.quote ?? '기록에 없어요'}</blockquote>)}</details>;
}

export function Meta({ value }: { value: VisitMeta }) { return <p className="meta">{value.date.replaceAll('-', '.')} {value.time} · {value.dept}<br />{value.hospital.name} · 동행 {value.companion?.name ?? '미정'}</p>; }

export function RecordCard({ value, testid }: { value: VisitView; testid: string }) {
  const blocks = value.record?.blocks;
  const { pid } = useParams();
  return <Card testid={testid}><h2>{value.meta.dept} 진료</h2><Meta value={value.meta} />{value.record && <Saved mode={value.record.mode} />}
    {blocks?.companion && <><h3>약의 바뀐 점</h3>{blocks.companion.medChanges.map(m => <p key={m.id}><strong>{m.drug}</strong><br />{m.from ?? '기록에 없어요'} → {m.to ?? '기록에 없어요'} <Check yes={m.needsCheck} />{m.caution && <small>{m.caution}</small>}</p>)}<details><summary>쉬운 말 요약 보기</summary><Items values={blocks.companion.easySummary} /></details></>}
    {blocks?.schedule?.nextSchedule.map(s => <p key={s.id} className="schedule">다음 일정 · {s.date ?? '기록에 없어요'} {s.time} <Check yes={s.needsCheck} /></p>)}
    {blocks?.full && <details data-testid={value.record?.view === 'draft' ? 'draft-full-section' : undefined}><summary>진료 내용과 근거 보기</summary><span className="badge warning">민감 정보</span><h3>진단</h3><Items values={blocks.full.diagnosis} /><h3>검사</h3>{blocks.full.labResults.map(l => <p key={l.id}>{l.name} · {l.value ?? '기록에 없어요'}{l.unit} <Check yes={l.needsCheck} /></p>)}<h3>주요 설명</h3><Items values={blocks.full.doctorExplanation} /><h3>약 변경 이유</h3><Items values={blocks.full.medReasons} /><h3>질문 답변</h3><Items values={blocks.full.answers} />{blocks.full.sourceRefs.map((ref, i) => <blockquote key={i}>{ref.quote ?? '기록에 없어요'}</blockquote>)}
      {blocks.full.transcript && <><h3>전사 원문</h3><Saved mode={blocks.full.transcript.mode} />{blocks.full.transcript.segments.map(s => <p key={s.id}>{s.text}</p>)}{pid && blocks.full.transcript.uploadId && <SourceFile pid={pid} uploadId={blocks.full.transcript.uploadId} />}</>}
    </details>}
  </Card>;
}

export function SourceFile({ pid, uploadId }: { pid: string; uploadId: string }) {
  const { session, revision, invalidate } = useContext(SessionContext);
  const [blobUrl, setBlobUrl] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [revision]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);
  return <div><button data-testid="source-file" disabled={busy} onClick={async () => {
    if (!session) return;
    controller.current?.abort(); const c = new AbortController(); controller.current = c; setError(''); setBusy(true);
    try {
      const blob = await request<Blob>(`/patients/${encodeURIComponent(pid)}/sources/${encodeURIComponent(uploadId)}`, session.accessToken, c.signal, undefined, { responseType: 'blob' });
      setBlobUrl(URL.createObjectURL(blob));
    } catch (err) { if (!c.signal.aborted) { setError(err instanceof Error ? err.message : '원문을 불러오지 못했어요.'); if (err instanceof ApiError && [403, 404].includes(err.status)) invalidate(); } }
    finally { if (!c.signal.aborted) setBusy(false); }
  }}>{busy ? '원문 불러오는 중…' : '음성 원본 열기'}</button>{blobUrl && <a className="button" data-testid="source-download" href={blobUrl} download="baton-audio">음성 원본 내려받기</a>}{error && <p role="alert" className="error">{error}</p>}</div>;
}

export function Items({ values }: { values: Item[] }) { return <ul className="item-list">{values.map(item => <li key={item.id}>{item.text ?? '기록에 없어요'} <Check yes={item.needsCheck} /></li>)}</ul>; }

export function useVisitBase() { const { pid, vid } = useParams(); return { api: `/patients/${pid}/visits/${vid}`, path: `/p/${pid}/visits/${vid}`, pid }; }

export function VisitContext({ path }: { path: string }) {
  const r = useResource<VisitView>(path);
  return r.data ? <p className="visit-context">{r.data.meta.date} {r.data.meta.time} · {r.data.meta.dept}<br />{r.data.meta.hospital.name} · 동행 {r.data.meta.companion?.name ?? '미정'}</p> : null;
}
