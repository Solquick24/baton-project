import { useContext, useEffect, useRef, useState } from 'react';
import { SessionContext } from '../app/session';
import { ApiError } from './api';

// A screen owns its mutations and polling. Leaving it aborts both immediately.
export function useAction() {
  const { session, invalidate, notify } = useContext(SessionContext);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => () => controller.current?.abort(), []);
  async function run(action: (token: string, signal: AbortSignal) => Promise<void>) {
    if (!session || busy) return;
    controller.current?.abort(); const c = new AbortController(); controller.current = c;
    setBusy(true); setError(''); notify('');
    try { await action(session.accessToken, c.signal); }
    catch (err) {
      if (!c.signal.aborted) {
        setError(err instanceof Error ? err.message : '처리하지 못했어요. 다시 시도해 주세요.');
        if (err instanceof ApiError && [403, 404].includes(err.status)) invalidate();
      }
    } finally { if (!c.signal.aborted) setBusy(false); }
  }
  return { busy, error, run };
}
