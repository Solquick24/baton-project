import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginRes } from '@baton/contracts';
import { readSession, request, saveSession } from '../lib/api';

export const SessionContext = createContext<{
  session: LoginRes | null;
  revision: number;
  setSession: (value: LoginRes | null) => void;
  invalidate: () => void;
  notice: string;
  notify: (message: string) => void;
}>({ session: null, revision: 0, setSession: () => {}, invalidate: () => {}, notice: '', notify: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, updateSession] = useState<LoginRes | null>(readSession);
  const [revision, setRevision] = useState(0);
  const [notice, notify] = useState('');
  const invalidate = useCallback(() => setRevision(value => value + 1), []);
  const setSession = useCallback((value: LoginRes | null) => {
    saveSession(value); updateSession(value); notify(''); invalidate();
  }, [invalidate]);
  useEffect(() => {
    const expire = () => { updateSession(null); notify(''); invalidate(); };
    const storage = (event: StorageEvent) => { if (event.key === 'baton.permissions-revision') invalidate(); };
    const visible = () => { if (document.visibilityState === 'visible') invalidate(); };
    window.addEventListener('baton:unauthorized', expire);
    window.addEventListener('baton:invalidate', invalidate);
    window.addEventListener('focus', invalidate);
    window.addEventListener('pageshow', invalidate);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('baton:unauthorized', expire);
      window.removeEventListener('baton:invalidate', invalidate);
      window.removeEventListener('focus', invalidate);
      window.removeEventListener('pageshow', invalidate);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [invalidate]);
  return <SessionContext.Provider value={{ session, revision, setSession, invalidate, notice, notify }}>{children}</SessionContext.Provider>;
}

// Responses exist only inside their mounted resource: there is no persistent patient/block cache.
export function useResource<T>(path: string | null) {
  const { session, revision } = useContext(SessionContext);
  const token = session?.accessToken;
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([path, token, revision, version]);
  const [result, setResult] = useState<{ key: string; data?: T; error?: Error }>({ key });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ key });
    if (path === null) return () => controller.abort();
    request<T>(path, token, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error : new Error('불러오지 못했어요.') });
    });
    return () => controller.abort();
  }, [key, path, token]);
  return { ...(result.key === key ? result : {}), reload: () => setVersion(value => value + 1) };
}
