import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { healthResponseSchema } from '@baton/contracts';

function Welcome() {
  const [connection, setConnection] = useState('서비스에 연결하는 중이에요.');
  useEffect(() => {
    const controller = new AbortController();
    const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
    fetch(`${baseUrl}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Connection failed');
        healthResponseSchema.parse(await response.json());
        setConnection('서비스에 연결했어요.');
      })
      .catch(() => { if (!controller.signal.aborted) setConnection('서비스에 연결하지 못했어요. 잠시 후 다시 열어 주세요.'); });
    return () => controller.abort();
  }, []);
  return <section className="welcome">
    <p className="eyebrow">진료 동행 노트</p>
    <h1>진료의 다음 이야기도,<br />함께 이어가요.</h1>
    <p>가족이 번갈아 동행해도<br />지난 진료의 맥락을 이어받을 수 있도록.</p>
    <p className="notice">로그인과 진료 기록 기능을 준비하고 있어요.</p>
    <p role="status" className="connection">{connection}</p>
  </section>;
}

export function App() {
  return <div className="app-shell">
    <header><Link to="/" className="brand" aria-label="바통 홈">바통<span>BATON</span></Link><span className="demo-badge">가상 데이터</span></header>
    <main><Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Welcome />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></main>
  </div>;
}
