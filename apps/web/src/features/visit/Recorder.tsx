import { useEffect, useRef, useState } from 'react';
import { Card } from '../../components/ui';

export function Recorder({ allowed, busy, onFinish, onRecordingChange }: { allowed: boolean; busy: boolean; onFinish: (file: File) => void; onRecordingChange: (value: boolean) => void }) {
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const active = useRef(true), startedAt = useRef(0), keep = useRef(false);
  const [state, setState] = useState<'idle' | 'requesting' | 'recording' | 'stopping'>('idle');
  const [seconds, setSeconds] = useState(0), [error, setError] = useState('');
  const enabled = useRef(allowed); enabled.current = allowed;
  useEffect(() => { onRecordingChange(state !== 'idle'); }, [state, onRecordingChange]);
  function release() { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; }
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; keep.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); release(); };
  }, []);
  useEffect(() => {
    if (!allowed) { keep.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); release(); setState('idle'); }
  }, [allowed]);
  useEffect(() => {
    if (state !== 'recording') return;
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [state]);
  async function start() {
    if (!allowed || busy || state !== 'idle') return;
    setError(''); setState('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('이 브라우저에서는 직접 녹음을 지원하지 않아요. 아래에서 음성 파일을 선택해 주세요.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current || !enabled.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('지원하는 녹음 형식이 없어요. 음성 파일을 선택해 주세요.');
      const chunks: Blob[] = []; let bytes = 0;
      const recording = new MediaRecorder(media, { mimeType }); recorder.current = recording; keep.current = true;
      recording.ondataavailable = event => {
        if (!active.current || !keep.current) return;
        bytes += event.data.size;
        if (bytes > 20 * 1024 * 1024) {
          keep.current = false; setError('녹음이 20MB를 넘었어요. 짧게 다시 녹음하거나 파일을 선택해 주세요.');
          if (recording.state === 'recording') recording.stop(); return;
        }
        if (event.data.size) chunks.push(event.data);
      };
      recording.onerror = () => { keep.current = false; release(); if (active.current) { setState('idle'); setError('녹음하지 못했어요. 음성 파일을 선택해 주세요.'); } };
      recording.onstop = () => {
        release(); if (!active.current) return; setState('idle');
        if (keep.current && chunks.length && enabled.current) onFinish(new File(chunks, `virtual-visit.${mimeType === 'audio/mp4' ? 'm4a' : 'webm'}`, { type: mimeType }));
        else if (keep.current) setError('녹음된 음성이 없어요. 다시 시도해 주세요.');
      };
      recording.start(1000); startedAt.current = Date.now(); setSeconds(0); setState('recording');
    } catch (err) {
      release(); if (!active.current) return;
      setState('idle'); setError(err instanceof DOMException && err.name === 'NotAllowedError'
        ? '마이크 사용을 허용하지 않았어요. 브라우저 권한을 바꾸거나 음성 파일을 선택해 주세요.'
        : err instanceof Error ? err.message : '녹음을 시작하지 못했어요.');
    }
  }
  return <Card className={`recorder ${state === 'recording' ? 'is-recording' : ''}`} testid="recorder">
    <div className="section-heading"><h2>진료 녹음</h2><span className="badge">가상 음성만</span></div>
    <div className="recording-orb" aria-hidden="true"><span /></div>
    <p className="recording-time" data-testid="recording-time">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</p>
    <p role={state === 'idle' ? undefined : 'status'}>{state === 'recording' ? '진료 내용을 녹음하고 있어요.' : state === 'requesting' ? '마이크 사용 허용을 기다리고 있어요.' : state === 'stopping' ? '녹음을 마무리하고 있어요.' : '가상 진료 음성을 녹음해 보세요.'}</p>
    <p className="footnote">실시간 자막은 제공하지 않아요. 녹음 종료 후 글자로 바꿔요.</p>
    {!allowed && <p className="warning">현재 녹음이 허용되지 않았어요.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {state === 'recording' ? <button className="record-button" data-testid="recorder-stop" onClick={() => { setState('stopping'); recorder.current?.stop(); }}>녹음 멈추고 다음으로</button>
      : <button className="record-button" data-testid="recorder-start" disabled={!allowed || busy || state !== 'idle'} onClick={() => void start()}>{state === 'requesting' ? '마이크 연결 중…' : '녹음 시작'}</button>}
  </Card>;
}
