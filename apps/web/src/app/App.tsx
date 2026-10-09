import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { BriefingRes, HomeRes, LoginRes, MePatientsRes, QuestionsRes, TimelineResponse } from '@baton/contracts';
import { request, waitForJob } from '../lib/api';
import { SessionContext as Auth, SessionProvider, useResource } from './session';
import { Card, Check, Saved, State, Sources, Items, RecordCard, useVisitBase, VisitContext } from '../components/ui';
import { SharingPage, SharingSettings } from '../features/settings/SharingPage';
import { VisitPage, ReviewPage } from '../features/visit/VisitPage';
import { AlertsPage } from '../features/alerts/AlertsPage';

type Display = { font: 'normal' | 'large' | 'extra-large'; contrast: boolean };
const DisplayContext = createContext<{ value: Display; set: (value: Display) => void }>({ value: { font: 'normal', contrast: false }, set: () => {} });
function initialDisplay(): Display {
  try { const v = JSON.parse(localStorage.getItem('baton.display') ?? 'null'); if (v && ['normal', 'large', 'extra-large'].includes(v.font) && typeof v.contrast === 'boolean') return v; } catch { /* defaults */ }
  return { font: 'normal', contrast: false };
}
export function App() {
  return <SessionProvider><Application /></SessionProvider>;
}
function Application() {
  const { session } = useContext(Auth);
  const [display, setDisplay] = useState<Display>(initialDisplay);
  const location = useLocation();
  useEffect(() => { document.documentElement.dataset.font = display.font; document.documentElement.dataset.contrast = String(display.contrast); try { localStorage.setItem('baton.display', JSON.stringify(display)); } catch { /* still usable */ } }, [display]);
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return <DisplayContext.Provider value={{ value: display, set: setDisplay }}>
    <a className="skip" href="#main">본문으로 이동</a>
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="*" element={session ? <Workspace key={session.accessToken} /> : <Navigate to="/login" replace />} />
    </Routes>
  </DisplayContext.Provider>;
}

function NavIcon({ kind }: { kind: 'home' | 'timeline' | 'settings' }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'home' ? <path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9" /> : kind === 'timeline' ? <><path d="M8 5h13M8 12h13M8 19h13" /><circle cx="3" cy="5" r="1" /><circle cx="3" cy="12" r="1" /><circle cx="3" cy="19" r="1" /></> : <><path d="M4 3v18M12 3v18M20 3v18" /><rect x="1" y="7" width="6" height="4" rx="1" fill="var(--paper)" /><rect x="9" y="14" width="6" height="4" rx="1" fill="var(--paper)" /><rect x="17" y="5" width="6" height="4" rx="1" fill="var(--paper)" /></>}
  </svg>;
}
function Login() {
  const { setSession } = useContext(Auth);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [demoPassword, setDemoPassword] = useState('');
  const [demoError, setDemoError] = useState(false); const [demoAttempt, setDemoAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const c = new AbortController();
    setDemoError(false);
    fetch('/__demo/accounts', { signal: c.signal, cache: 'no-store' }).then(async res => {
      if (!res.ok) throw new Error('Demo accounts unavailable');
      const value: unknown = await res.json();
      if (!value || typeof value !== 'object' || !('demoPassword' in value) || typeof value.demoPassword !== 'string' || !value.demoPassword) throw new Error('Invalid demo accounts');
      if (!c.signal.aborted) setDemoPassword(value.demoPassword);
    }).catch(() => { if (!c.signal.aborted) setDemoError(true); });
    return () => c.abort();
  }, [demoAttempt]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); controller.current = new AbortController();
    try { setSession(await request<LoginRes>('/auth/login', undefined, controller.current.signal, { email, password })); }
    catch (err) { if (!controller.current.signal.aborted) setError(err instanceof Error ? err.message : '로그인하지 못했어요.'); }
    finally { if (!controller.current.signal.aborted) setBusy(false); }
  }
  return <main id="main" className="login shell"><div className="brand"><span className="brand-icon" aria-hidden="true">▤</span><div>바통<small>진료 동행 노트</small></div></div><span className="badge">가상 데이터</span>
    <h1>로그인</h1><p className="muted">함께 돌보는 마음,<br />다음 진료까지 이어가요.</p>
    <form onSubmit={submit} className="stack"><label>이메일<input data-testid="login-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>비밀번호<input data-testid="login-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="error">{error}</p>}<button className="primary" data-testid="login-submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button></form>
    {import.meta.env.DEV && <Card className="demo"><h2>가상 계정으로 둘러보기</h2><p className="muted">계정을 선택하면 로그인 정보가 채워져요.</p>{demoError && <p role="status">가상 계정을 불러오지 못했어요. <button onClick={() => setDemoAttempt(v => v + 1)}>다시 불러오기</button></p>}<div className="quick-grid">{[
      ['patient', '박하늘 · 환자'], ['a', '박지원 · 지난 동행'], ['b', '박지후 · 이번 동행'], ['c', '정다온 · 가족'],
    ].map(([id, label]) => <button key={id} disabled={!demoPassword} data-testid={`quick-login-${id}`} onClick={() => { setEmail(`${id}@baton.demo`); setPassword(demoPassword); }}>{label}</button>)}</div></Card>}
    <p className="footnote">모든 인물과 진료 내용은 가상 자료입니다.</p>
  </main>;
}
function Workspace() {
  const { notice } = useContext(Auth);
  const patients = useResource<MePatientsRes>('/me/patients');
  const location = useLocation();
  const pid = /^\/p\/([^/]+)/.exec(location.pathname)?.[1] ?? patients.data?.self.patientId ?? patients.data?.linked[0]?.patientId;
  const title = location.pathname.endsWith('/questions') ? '가족 질문' : location.pathname.endsWith('/briefing') ? '진료 전 브리핑' : location.pathname.endsWith('/timeline') ? '타임라인' : location.pathname === '/settings' ? '설정' : '진료 동행 노트';
  return <div className="shell"><header><Link className="wordmark" to={pid ? `/p/${pid}` : '/me'}>바통</Link><span className="badge">가상 데이터</span></header><main id="main">
    <div className="page-heading"><h1>{title}</h1>{title === '진료 전 브리핑' && <span className="badge">30초 읽기</span>}</div>
    {notice && <p role="status" className="warning card">{notice}</p>}
    {patients.data ? <><div className="chips owners" aria-label="기록 주인">{patients.data.linked.map(p => <NavLink key={p.patientId} to={`/p/${p.patientId}`}>{p.name}</NavLink>)}{patients.data.self.patientId && <NavLink to={`/p/${patients.data.self.patientId}`}>내 기록</NavLink>}</div>
      <Routes key={location.pathname}><Route path="/" element={<Navigate replace to={pid ? `/p/${pid}` : '/me'} />} /><Route path="/me" element={patients.data.self.patientId ? <Navigate replace to={`/p/${patients.data.self.patientId}`} /> : <Card><h2>아직 내 진료 기록이 없어요</h2><p>가족 기록을 선택해 이번 진료를 준비해 보세요.</p>{patients.data.linked.map(p => <Link className="button primary" key={p.patientId} to={`/p/${p.patientId}`}>{p.name} 기록 보기</Link>)}</Card>} />
      <Route path="/p/:pid" element={<Home />} /><Route path="/p/:pid/timeline" element={<Timeline />} /><Route path="/p/:pid/visits/:vid/questions" element={<Questions />} /><Route path="/p/:pid/visits/:vid/briefing" element={<Briefing />} /><Route path="/settings" element={<Settings pid={pid} />} /><Route path="/p/:pid/sharing/:uid" element={<SharingPage />} /><Route path="/p/:pid/visits/:vid/record" element={<VisitPage />} /><Route path="/p/:pid/visits/:vid/review" element={<ReviewPage />} /><Route path="/p/:pid/alerts" element={<AlertsPage />} /><Route path="/p/:pid/alerts/:aid" element={<AlertsPage />} /><Route path="*" element={<Card><h2>찾을 수 없어요</h2><Link to="/me">홈으로</Link></Card>} /></Routes></> : <State error={patients.error} retry={patients.reload} />}
  </main><nav className="bottom-nav" aria-label="주요 메뉴"><NavLink end to={pid ? `/p/${pid}` : '/me'}><NavIcon kind="home" /><span>홈</span></NavLink><NavLink to={pid ? `/p/${pid}/timeline` : '/me'}><NavIcon kind="timeline" /><span>타임라인</span></NavLink><NavLink to="/settings"><NavIcon kind="settings" /><span>설정</span></NavLink></nav></div>;
}
function DeptChips({ depts, dept, set }: { depts: string[]; dept: string; set: (value: string) => void }) { return <div className="chips depts" aria-label="진료과">{depts.map(d => <button data-testid={`timeline-dept-${d}`} aria-pressed={dept === d} key={d} onClick={() => set(d)}>{d}</button>)}</div>; }
function Home() {
  const { pid } = useParams(); const [dept, setDept] = useState('');
  const r = useResource<HomeRes>(`/patients/${pid}/home${dept ? `?dept=${encodeURIComponent(dept)}` : ''}`);
  if (!r.data) return <State error={r.error} retry={r.reload} />;
  const d = r.data; const next = d.nextVisit; const base = `/p/${pid}/visits/${next?.meta.id}`;
  return <div className="stack"><DeptChips depts={d.depts} dept={dept || d.depts[0] || ''} set={setDept} /><h2>{d.patient.name}님의 기록</h2>
    {next ? <Card className="next" testid="next-visit-card"><span className="eyebrow">다음 진료 · {next.meta.dept}</span><h2>{next.meta.date.replaceAll('-', '.')} <span>{next.meta.time}</span></h2><p>{next.meta.hospital.name}<br />이번 동행 · {next.meta.companion?.name ?? '미정'}</p>
      {'briefingReady' in next && <><Link className="button light" data-testid="briefing-link" to={`${base}/briefing`}>진료 전 브리핑 보기 <span aria-hidden="true">→</span></Link><Link className="button light" data-testid="record-link" to={`${base}/record`}>진료 기록하기</Link></>}</Card> : <Card><p>예정된 진료가 없어요.</p></Card>}
    {typeof d.openAlertCount === 'number' && d.openAlertCount > 0 && <Card className="warning" testid="alert-card"><h2>! 확인이 필요한 기록 {d.openAlertCount}건</h2><Link className="button" data-testid="alerts-link" to={`/p/${pid}/alerts`}>서로 다른 기록 확인하기</Link></Card>}
    {next && typeof next.questionCount === 'number' && <Card><h2>가족이 남긴 질문 {next.questionCount}개</h2><p className="muted">함께 궁금한 내용을 모아 두었어요.</p><Link className="button" data-testid="questions-link" to={`${base}/questions`}>가족 질문 확인하기 →</Link></Card>}
    <div className="section-heading"><h2>지난 진료</h2><Link to={`/p/${pid}/timeline`}>모두 보기</Link></div>{d.recent.length ? d.recent.map(v => <RecordCard key={v.meta.id} value={v} testid={`recent-visit-${v.meta.id}`} />) : <Card><p>공유된 기록이 없어요.</p></Card>}
  </div>;
}

function Timeline() {
  const { pid } = useParams(); const [dept, setDept] = useState('');
  const home = useResource<HomeRes>(`/patients/${pid}/home${dept ? `?dept=${encodeURIComponent(dept)}` : ''}`);
  const r = useResource<TimelineResponse>(home.data?.depts.length ? `/patients/${pid}/timeline?dept=${encodeURIComponent(dept || home.data.depts[0]!)}` : null);
  if (!home.data) return <State error={home.error} retry={home.reload} />;
  if (!home.data.depts.length) return <Card><p>공유된 기록이 없어요.</p></Card>;
  return <div className="stack">{home.data && <DeptChips depts={home.data.depts} dept={dept || home.data.depts[0] || ''} set={setDept} />}{r.data ? r.data.items.length ? <div className="timeline stack">{r.data.items.map(v => <RecordCard key={v.meta.id} value={v} testid={`timeline-card-${v.meta.id}`} />)}</div> : <Card><p>공유된 기록이 없어요.</p></Card> : <State error={r.error} retry={r.reload} />}</div>;
}

function Questions() {
  const base = useVisitBase(); const r = useResource<QuestionsRes>(`${base.api}/questions`);
  const { session } = useContext(Auth); const navigate = useNavigate();
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function act(kind: 'add' | 'merge' | 'briefing') {
    if (!r.data || !session) return; controller.current?.abort(); const c = new AbortController(); controller.current = c;
    setBusy(true); setMessage('');
    try {
      if (kind === 'add') { await request(`${base.api}/questions`, session.accessToken, c.signal, { text: text.trim() }); if (!c.signal.aborted) { setText(''); r.reload(); } }
      else {
        const result = await request<{ jobId: string }>(`${base.api}/${kind === 'merge' ? 'questions/merge' : 'briefing'}`, session.accessToken, c.signal, kind === 'merge' ? { inputVersion: r.data.questionsInputVersion } : { questionsVersion: r.data.merged?.version });
        await waitForJob(result.jobId, session.accessToken, c.signal);
        if (!c.signal.aborted) { if (kind === 'briefing') navigate(`${base.path}/briefing`); else r.reload(); }
      }
    } catch (error) { if (!c.signal.aborted) setMessage(error instanceof Error ? error.message : '처리하지 못했어요.'); }
    finally { if (!c.signal.aborted) setBusy(false); }
  }
  if (!r.data) return <State error={r.error} retry={r.reload} />;
  const d = r.data; const merged = d.merged?.blocks.companion?.mergedQuestions;
  return <div className="stack"><Link className="back" to={`/p/${base.pid}`}>← 가족 기록</Link><VisitContext path={base.api} /><p className="muted">진료 때 함께 물어볼 내용을 모아요.</p>
    <Card><form onSubmit={e => { e.preventDefault(); void act('add'); }}><label>질문 남기기<textarea data-testid="question-input" maxLength={200} required value={text} onChange={e => setText(e.target.value)} placeholder="궁금한 내용을 적어 주세요" /></label><p className="footnote">{text.length}/200자</p><button data-testid="question-submit" disabled={busy || !text.trim()}>질문 등록</button></form></Card>
    <h2>가족이 남긴 질문 {d.originals.length}개</h2>{d.originals.map((q, i) => <Card key={q.id}><span className="badge">질문 {i + 1} · {q.author.name}</span><p>{q.text}</p><small>{q.createdAt}</small></Card>)}
    <button className="primary" data-testid="merge-button" disabled={busy} onClick={() => void act('merge')}>AI로 질문 정리하기</button>
    {busy && <p role="status" data-testid="job-status">정리하는 중…</p>}{message && <p role="alert" className="error">{message}</p>}
    {d.merged && <Card className="ai-panel"><div className="section-heading"><h2>한눈에 보는 질문</h2><Saved mode={d.merged.mode} /></div>{d.merged.state === 'blocked' && <p className="warning">질문을 다시 정리해 주세요.</p>}{d.merged.stale && <p className="warning">새 질문이 있어요. 다시 정리할까요?</p>}{merged && <p className="muted">통합 {merged.filter(q => !q.addedByAI).length}개 · AI 추가 {merged.filter(q => q.addedByAI).length}개</p>}
      {merged?.map(q => <div className="inner-card" key={q.id} data-testid={`merged-question-${q.id}`}>{q.addedByAI ? <span className="badge" data-testid="ai-added-badge">AI가 추가</span> : <small>{q.fromQuestionIds.map(id => d.originals.findIndex(o => o.id === id) + 1).join('·')}번 질문을 정리했어요</small>}<p>{q.text} <Check yes={q.needsCheck} /></p>{d.merged?.blocks.full && <Sources refs={d.merged.blocks.full.basisRefs} itemId={q.id} testid={`basis-${q.id}`} />}</div>)}
      <button className="primary" disabled={busy || d.merged.stale || d.merged.state === 'blocked'} onClick={() => void act('briefing')}>이 질문으로 브리핑 만들기</button>
    </Card>}
  </div>;
}

function Briefing() {
  const base = useVisitBase(); const r = useResource<BriefingRes>(`${base.api}/briefing`);
  if (!r.data) return <State error={r.error} retry={r.reload} />;
  const d = r.data; const full = d.blocks.full;
  return <div className="stack briefing"><div className="section-heading"><Link className="back" to={`/p/${base.pid}`}>← 가족 기록</Link><Saved mode={d.mode} /></div><VisitContext path={base.api} />
    {d.stale && <p className="warning">새 질문이 있어요. 가족 질문에서 다시 정리해 주세요.</p>}
    {d.state === 'blocked' && <p className="warning">브리핑을 다시 정리해 주세요.</p>}
    {d.blocks.companion && <><Card testid="briefing-changes"><h2>바뀐 점</h2>{d.blocks.companion.briefing.changes.map(c => <div className="change" key={c.id} data-testid={`change-${c.id}`}><p>{c.text} <Check yes={c.needsCheck} /></p>{full && <details><summary>이유와 원문 보기</summary>{full.briefing.changeReasons.filter(v => v.changeId === c.id).map(v => <p key={v.id}>{v.text ?? '기록에 없어요'} <Check yes={v.needsCheck} /></p>)}<Sources refs={full.sourceRefs} itemId={c.id} /></details>}</div>)}</Card>
    <Card testid="briefing-questions"><h2>오늘 물어볼 질문</h2><ol className="questions-list">{d.questions.map(q => <li key={q.id}><p>{q.text}</p>{q.addedByAI && <span className="badge">AI가 추가</span>}<Check yes={q.needsCheck} /></li>)}</ol></Card></>}
    {full && <><Card testid="briefing-watch"><h2>지켜볼 증상</h2><Items values={full.briefing.watch} /></Card><Card testid="briefing-tests"><h2>먼저 받을 검사</h2><Items values={full.briefing.tests} /></Card><Card testid="briefing-prep"><h2>준비사항</h2>{full.briefing.prep.map(p => <p key={p.id}><strong>{p.label}</strong><br />{p.text ?? '기록에 없어요'} <Check yes={p.needsCheck} /></p>)}</Card></>}
    <Link className="button" to={`${base.path}/questions`}>가족 질문 다시 보기</Link><Link className="button primary" data-testid="record-link" to={`${base.path}/record`}>진료 기록 시작</Link>
  </div>;
}
function Settings({ pid }: { pid: string | undefined }) {
  const display = useContext(DisplayContext); const { session, setSession } = useContext(Auth);
  return <div className="stack"><Card><h2>{session?.user.name}님</h2><p className="muted">내 화면 보기 설정</p></Card><Card><fieldset><legend>글씨 크기</legend>{[['normal', '보통'], ['large', '크게'], ['extra-large', '아주 크게']].map(([key, label]) => <label className="choice" key={key}><input data-testid={`font-size-${key}`} type="radio" name="font-size" checked={display.value.font === key} onChange={() => display.set({ ...display.value, font: key as Display['font'] })} />{label}</label>)}</fieldset><label className="choice"><input data-testid="high-contrast" type="checkbox" checked={display.value.contrast} onChange={e => display.set({ ...display.value, contrast: e.target.checked })} />고대비 화면</label></Card><SharingSettings pid={pid} /><Card><button data-testid="logout" onClick={() => setSession(null)}>로그아웃</button></Card></div>;
}
