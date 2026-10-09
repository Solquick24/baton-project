import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import './onboarding.css';

const STORAGE_KEY = 'baton.onboarding';
const RETURN_AFTER = 30 * 24 * 60 * 60 * 1000;
type History = { version: 1; completedAt: number | null; lastVisitedAt: number };
const GuideContext = createContext(() => {});
function readHistory(): History | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (value?.version === 1 && Number.isFinite(value.lastVisitedAt) &&
        (value.completedAt === null || Number.isFinite(value.completedAt))) return value;
  } catch { /* The guide remains usable without storage. */ }
  return null;
}
function saveHistory(value: History) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Keep the current session usable. */ }
}

export function GuideButton() {
  const open = useContext(GuideContext);
  return <button data-testid="onboarding-reopen" onClick={open}>바통 사용법 다시 보기</button>;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [history] = useState(readHistory);
  const [open, setOpen] = useState(!history?.completedAt);
  const [returning, setReturning] = useState(Boolean(history?.completedAt && Date.now() - history.lastVisitedAt >= RETURN_AFTER));
  useEffect(() => {
    saveHistory({ version: 1, completedAt: history?.completedAt ?? null, lastVisitedAt: Date.now() });
  }, [history]);
  function finish() {
    saveHistory({ version: 1, completedAt: Date.now(), lastVisitedAt: Date.now() });
    setOpen(false); setReturning(false);
  }
  return <GuideContext.Provider value={() => { setReturning(false); setOpen(true); }}>
    {returning && <aside className="onboarding-reminder" aria-label="사용법 안내">
      <p>오랜만이에요. 바통 사용법을 다시 볼까요?</p>
      <div><GuideButton /><button onClick={() => setReturning(false)}>닫기</button></div>
    </aside>}
    {children}
    {open && <Onboarding onFinish={finish} />}
  </GuideContext.Provider>;
}

const steps = [
  { label: '마음을 잇는 바통', title: '동행하는 가족이 바뀌어도,', accent: '진료 이야기는 이어져요.', description: '지난 진료부터 다음 진료까지. 함께 돌보는 가족이 같은 흐름을 따라갈 수 있도록 바통이 도와드려요.', hint: '짧게 둘러보고, 편하게 시작해 보세요.' },
  { label: '진료 전에', title: '무엇이 달라졌는지,', accent: '무엇을 물어볼지 먼저 봐요.', description: '홈에서 다음 진료를 확인해요. 진료 전 브리핑에서는 바뀐 점과 가족이 모아 둔 질문을 살펴볼 수 있어요.', hint: '홈 → 진료 전 브리핑 보기' },
  { label: '진료 중에', title: '기억하고 싶은 이야기를', accent: '기록으로 남겨요.', description: '진료 기록 화면에서 음성을 올리거나 메모를 남겨요. 필요한 내용을 모은 뒤 정리하기를 눌러 주세요.', hint: '진료 기록 → 음성·메모 → 정리하기' },
  { label: '진료가 끝나면', title: '한 번 더 확인하고,', accent: '다음 가족에게 바통을 건네요.', description: '정리된 내용과 확인이 필요한 부분을 살펴보세요. 가족에게 공유하기를 누르고 확인해야 공유돼요.', hint: '자동으로 공유되지 않아요. 확인한 뒤 공유해 주세요.' },
];

function BatonPicture() {
  return <svg className="onboarding-picture" viewBox="0 0 340 240" fill="none" aria-hidden="true">
    <circle cx="170" cy="120" r="105" fill="var(--tint)" />
    <path d="M70 183c12-50 58-74 96-66m10-1c40-3 76 24 92 65" stroke="var(--teal)" strokeWidth="2" strokeDasharray="5 8" />
    <circle cx="89" cy="94" r="24" fill="var(--paper)" stroke="var(--teal)" strokeWidth="3" />
    <path d="M56 185v-35c0-28 65-28 65 0v35M76 91h1m25 0h1m-24 15q10 8 20 0" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
    <circle cx="253" cy="94" r="24" fill="var(--paper)" stroke="var(--teal)" strokeWidth="3" />
    <path d="M220 185v-35c0-28 65-28 65 0v35M240 91h1m25 0h1m-24 15q10 8 20 0M111 147l28 14m89-14-28 14" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
    <rect x="138" y="136" width="64" height="28" rx="14" transform="rotate(-12 138 136)" fill="var(--teal)" />
    <path d="m166 143 15-3m-7-5 7 5-5 7" stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="132" y="47" width="77" height="48" rx="14" fill="var(--paper)" stroke="var(--teal)" strokeWidth="2" />
    <path d="m165 63 6 6 6-6m-6 6v10" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

function ScreenExample({ step }: { step: number }) {
  return <div className="onboarding-example" aria-hidden="true">
    <div className="onboarding-example-top"><strong>바통</strong><span>화면 예시</span></div>
    <div className="onboarding-example-body">
      <p className="eyebrow">{step === 1 ? '다음 진료' : step === 2 ? '진료 기록' : '진료 후 정리'}</p>
      <div className="onboarding-example-lines"><span /><span /></div>
      {step === 1 ? <><div className="onboarding-example-card">가족과 함께 준비하는 진료</div><div className="onboarding-spotlight">진료 전 브리핑 보기 <span>→</span></div></> :
       step === 2 ? <><div className="onboarding-example-card">음성 올리기 · 메모 남기기</div><div className="onboarding-spotlight">정리하기 <span>→</span></div></> :
       <><div className="onboarding-example-card">정리된 내용 확인<br /><small>확인 필요 항목 살펴보기</small></div><div className="onboarding-spotlight">가족에게 공유하기 <span>→</span></div></>}
      <div className="onboarding-example-lines"><span /><span /></div>
    </div>
    <div className="onboarding-example-nav">홈 · 타임라인 · 설정</div>
  </div>;
}

function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = steps[step]!;
  function move(amount: number) { setStep(value => Math.max(0, Math.min(steps.length - 1, value + amount))); }
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => {
      element.close(); document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => { heading.current?.focus(); dialog.current?.scrollTo(0, 0); }, [step]);
  return <dialog ref={dialog} className="onboarding-dialog" data-testid="onboarding-dialog" aria-labelledby="onboarding-title" aria-describedby="onboarding-description" onCancel={event => { event.preventDefault(); onFinish(); }}
    onKeyDown={event => {
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
        const first = buttons[0]; const last = buttons.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } }}>
    <div className="onboarding-layout">
      <div className="onboarding-top"><span className="wordmark">바통</span><span className="badge">가상 데이터</span><button data-testid="onboarding-skip" onClick={onFinish}>건너뛰기</button></div>
      <div className="onboarding-slide" data-testid="onboarding-slide"
        onTouchStart={event => { const point = event.touches[0]; if (point) touch.current = { x: point.clientX, y: point.clientY }; }}
        onTouchEnd={event => { const point = event.changedTouches[0]; const start = touch.current; touch.current = null; if (point && start) { const dx = point.clientX - start.x; const dy = point.clientY - start.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1); } }}
        onTouchCancel={() => { touch.current = null; }}>
        <p className="onboarding-step">0{step + 1} <span>{current.label}</span></p>
        <h1 id="onboarding-title" ref={heading} tabIndex={-1}>{current.title}<br /><em>{current.accent}</em></h1>
        <p id="onboarding-description">{current.description}</p>
        <div className="onboarding-visual" key={step}>{step === 0 ? <BatonPicture /> : <ScreenExample step={step} />}</div>
        <p className="onboarding-hint">{current.hint}</p>
        {step > 0 && <p className="onboarding-example-note">사용법 예시예요. 사용할 수 있는 메뉴는 내 화면에서 확인해 주세요.</p>}
      </div>
      <footer className="onboarding-footer">
        <div className="onboarding-progress" aria-label="온보딩 단계">{steps.map((item, index) => <button key={item.label} aria-label={`${index + 1}단계: ${item.label}`} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span /></button>)}</div>
        <p className="onboarding-swipe">옆으로 넘기거나 다음 버튼을 눌러 주세요 · {step + 1}/{steps.length}</p>
        <div className="onboarding-actions">{step > 0 && <button onClick={() => move(-1)}>이전</button>}
          <button className="primary" data-testid={step === steps.length - 1 ? 'onboarding-start' : 'onboarding-next'} onClick={() => step === steps.length - 1 ? onFinish() : move(1)}>{step === steps.length - 1 ? '바통 시작하기!' : '다음'}<span aria-hidden="true">→</span></button>
        </div>
      </footer>
    </div>
  </dialog>;
}
