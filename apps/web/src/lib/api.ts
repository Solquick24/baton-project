import { loginResponseSchema, type LoginRes, type Job } from '@baton/contracts';
const sessionKey = 'baton.session';
const pending = new Set<AbortController>();
export function readSession(): LoginRes | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null');
    const parsed = loginResponseSchema.safeParse(value);
    if (parsed.success) return parsed.data;
  } catch { /* unavailable browser storage */ }
  return null;
}
let activeToken = readSession()?.accessToken;
export function cancelPendingRequests() {
  for (const controller of pending) controller.abort();
  pending.clear();
}
export function saveSession(value: LoginRes | null) {
  cancelPendingRequests();
  activeToken = value?.accessToken;
  try { value ? sessionStorage.setItem(sessionKey, JSON.stringify(value)) : sessionStorage.removeItem(sessionKey); } catch { /* in-memory session still works */ }
}
export class ApiError extends Error {
  constructor(public status: number, message: string, public reason?: string) { super(message); }
}
export async function request<T>(path: string, token: string | undefined, signal: AbortSignal, body?: unknown,
  options: { method?: 'POST' | 'PUT'; responseType?: 'blob' } = {}): Promise<T> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  pending.add(controller);
  const fallback = '불러오지 못했어요. 다시 시도해 주세요.';
  try {
    const multipart = body instanceof FormData;
    const response = await fetch(`/api${path}`, {
      method: options.method ?? (body === undefined ? 'GET' : 'POST'), signal: controller.signal, cache: 'no-store',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
    });
    // A late response from an old session must never expire the current session.
    controller.signal.throwIfAborted();
    if (response.status === 401 && path !== '/auth/login' && token === activeToken) {
      saveSession(null); window.dispatchEvent(new Event('baton:unauthorized'));
      throw new ApiError(401, '다시 로그인해 주세요.');
    }
    if (response.ok && options.responseType === 'blob') {
      const blob = await response.blob(); controller.signal.throwIfAborted(); return blob as T;
    }
    const payload = await response.json().catch(() => { throw new ApiError(response.status, fallback); });
    controller.signal.throwIfAborted();
    if (!response.ok) {
      throw new ApiError(response.status, payload?.error?.reason === 'stale_input' ? '입력이 바뀌었어요. 최신 내용을 확인하고 다시 시도해 주세요.' : typeof payload?.error?.message === 'string' ? payload.error.message : fallback,
        typeof payload?.error?.reason === 'string' ? payload.error.reason : undefined);
    }
    return payload as T;
  } catch (error) {
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    throw error instanceof ApiError ? error : new ApiError(0, fallback);
  } finally {
    signal.removeEventListener('abort', abort);
    pending.delete(controller);
  }
}
export async function waitForJob(jobId: string, token: string, signal: AbortSignal): Promise<Job> {
  for (;;) {
    const job = await request<Job>(`/jobs/${encodeURIComponent(jobId)}`, token, signal);
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' && job.errorCode === 'ai_unavailable' && import.meta.env.MODE === 'preview') {
      throw new ApiError(0, '이 입력에 맞는 저장된 결과가 없어요. 질문은 저장됐어요.', job.errorCode);
    }
    if (job.status === 'failed') throw new ApiError(0, job.errorCode === 'stale_input'
      ? '입력이 바뀌었어요. 최신 내용을 확인하고 다시 시도해 주세요.'
      : job.errorCode === 'validation_failed' ? 'AI 응답 검증에 실패했어요. 입력은 유지했어요. 다시 정리하거나 내용을 확인해 주세요.'
      : job.errorCode === 'ai_unavailable' ? 'AI 연결에 실패했어요. 잠시 후 다시 시도해 주세요.'
      : job.errorCode === 'stt_unavailable' ? '글자로 바꾸지 못했어요. 다시 시도해 주세요.'
      : '정리하지 못했어요. 이 입력에 맞는 결과를 확인하고 다시 시도해 주세요.', job.errorCode ?? undefined);
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2000);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
}
