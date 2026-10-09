import type { LoginRes, Job } from '@baton/contracts';
const sessionKey = 'baton.session';
export function readSession(): LoginRes | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null');
    if (value && typeof value === 'object' && 'accessToken' in value && typeof value.accessToken === 'string'
      && 'user' in value && value.user && typeof value.user === 'object' && 'name' in value.user && typeof value.user.name === 'string'
      && 'id' in value.user && typeof value.user.id === 'string') return value as LoginRes;
  } catch { /* unavailable browser storage */ }
  return null;
}
export function saveSession(value: LoginRes | null) {
  try { value ? sessionStorage.setItem(sessionKey, JSON.stringify(value)) : sessionStorage.removeItem(sessionKey); } catch { /* in-memory session still works */ }
}
export class ApiError extends Error {
  constructor(public status: number, message: string, public reason?: string) { super(message); }
}
export async function request<T>(path: string, token: string | undefined, signal: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST', signal,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      saveSession(null); window.dispatchEvent(new Event('baton:unauthorized'));
    }
    throw new ApiError(response.status, payload.error?.message ?? '불러오지 못했어요. 다시 시도해 주세요.', payload.error?.reason);
  }
  return payload as T;
}
export async function waitForJob(jobId: string, token: string, signal: AbortSignal): Promise<Job> {
  for (;;) {
    const job = await request<Job>(`/jobs/${encodeURIComponent(jobId)}`, token, signal);
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed') throw new Error(job.errorCode === 'ai_unavailable'
      ? '이 입력에 맞는 저장된 결과가 없어요. 질문은 저장됐어요.' : '정리하지 못했어요. 다시 시도해 주세요.');
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2000);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
}
