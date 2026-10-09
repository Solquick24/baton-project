// Development-only adapter. Not a replacement for the API's JWT, SQLite or validators.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';
import type { BriefingRes, HomeRes, Job, QuestionsRes, Role, VisitMeta, VisitView } from '@baton/contracts';

const read = <T>(file: string): T => JSON.parse(readFileSync(new URL(`../../../fixtures/${file}`, import.meta.url), 'utf8')) as T;
type User = { id: string; email: string; name: string; testOnly: boolean };
type Member = { patientId: string; userId: string; role: Role; scope: 'schedule' | 'companion' | 'full'; active: boolean };
type SeedVisit = { id: string; patientId: string; date: string; time: string | null; dept: string; hospitalId: string; companionUserId: string; status: 'done' | 'upcoming'; recordPublishedVersion: number | null };
type SeedQuestion = { id: string; patientId: string; visitId: string; authorId: string; text: string; createdAt: string; visibility: 'companion' | 'full' };
class Failure extends Error { constructor(public status: number, public code: string, message: string, public reason?: string) { super(message); } }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let text = '';
  for await (const chunk of req) { text += String(chunk); if (text.length > 4096) throw new Failure(400, 'bad_request', '입력이 너무 길어요.'); }
  try { const value: unknown = JSON.parse(text); if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>; } catch { /* standardized error below */ }
  throw new Failure(400, 'bad_request', '입력을 확인해 주세요.');
}
export function previewApi(): Plugin {
  const accounts = read<{ demoPassword: string; users: User[] }>('seed/accounts.json');
  const patientData = read<{ patients: Array<{ id: string; name: string; userId: string }>; members: Member[] }>('seed/patient.json');
  const patient = patientData.patients[0]!;
  const visits = read<{ visits: SeedVisit[] }>('seed/visits.json').visits;
  const records = read<{ blockSets: Array<{ visitId: string; version: number; mode: 'fixture'; blocks: NonNullable<VisitView['record']>['blocks']; publishedAt: string | null }> }>('seed/records.json').blockSets;
  const questions = read<{ questions: SeedQuestion[] }>('seed/questions.json').questions;
  const merged = read<NonNullable<QuestionsRes['merged']>['blocks']>('expected/merge-questions/v_im_03.json');
  const briefing = read<BriefingRes['blocks']>('expected/briefing/v_im_03.json');
  const tokens = new Map<string, User>();
  const jobs = new Map<string, { userId: string; inputVersion: number; job: Job; polls: number }>();
  let inputVersion = 3;
  const meta = (visit: SeedVisit): VisitMeta => ({
    id: visit.id, patientId: visit.patientId, date: visit.date, time: visit.time, dept: visit.dept,
    hospital: { id: visit.hospitalId, name: '한빛가상병원' },
    companion: { userId: visit.companionUserId, name: accounts.users.find(u => u.id === visit.companionUserId)!.name }, status: visit.status,
  });
  const view = (visit: SeedVisit, member: Member): VisitView => {
    const set = records.find(r => r.visitId === visit.id && r.version === visit.recordPublishedVersion && r.publishedAt);
    return { meta: meta(visit), ...(set ? { record: { view: 'published' as const, version: set.version, mode: set.mode,
      blocks: { schedule: set.blocks.schedule!, ...(member.scope !== 'schedule' ? { companion: set.blocks.companion! } : {}), ...(member.scope === 'full' ? { full: set.blocks.full! } : {}) } } } : {}) };
  };
  return {
    name: 'baton-development-preview',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        const send = (status: number, value: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value)); };
        try {
          if (url.pathname === '/api/auth/login' && req.method === 'POST') {
            const data = await body(req);
            const user = accounts.users.find(u => u.email === data.email);
            if (!user || data.password !== accounts.demoPassword) throw new Failure(401, 'unauthorized', '이메일 또는 비밀번호를 확인해 주세요.');
            const token = randomUUID(); tokens.set(token, user);
            return send(200, { accessToken: token, user: { id: user.id, name: user.name } });
          }
          const token = req.headers.authorization?.replace(/^Bearer /, '');
          const user = token ? tokens.get(token) : undefined;
          if (!user) throw new Failure(401, 'unauthorized', '다시 로그인해 주세요.');
          const member = patientData.members.find(m => m.userId === user.id && m.active);
          if (url.pathname === '/api/me/patients' && req.method === 'GET') return send(200, {
            self: { patientId: user.id === patient.userId ? patient.id : null },
            linked: member && user.id !== patient.userId ? [{ patientId: patient.id, name: patient.name }] : [],
          });
          if (url.pathname.startsWith('/api/jobs/') && req.method === 'GET') {
            const entry = jobs.get(url.pathname.slice('/api/jobs/'.length));
            if (!entry || !member || (entry.userId !== user.id && member.scope !== 'full')) throw new Failure(404, 'not_found', '찾을 수 없어요.');
            if (entry.job.status === 'queued') { entry.job.status = 'running'; entry.job.updatedAt = new Date().toISOString(); }
            else if (entry.job.status === 'running' && entry.polls > 0) {
              const matching = entry.inputVersion === 3 && inputVersion === 3;
              entry.job.status = matching ? 'succeeded' : 'failed';
              entry.job.errorCode = matching ? null : 'ai_unavailable';
              entry.job.resultVersion = matching ? 1 : null; entry.job.resultState = matching ? 'ready' : null;
              entry.job.updatedAt = new Date().toISOString();
            }
            entry.polls++;
            return send(200, entry.job);
          }
          const match = /^\/api\/patients\/([^/]+)\/(.+)$/.exec(url.pathname);
          if (!match || match[1] !== patient.id) throw new Failure(404, 'not_found', '찾을 수 없어요.');
          if (!member) throw new Failure(403, 'forbidden', '요청을 처리할 수 없어요.');
          const route = match[2]!;
          const depts = [...new Set(visits.map(v => v.dept))].sort();
          const dept = url.searchParams.get('dept') ?? depts[0]!;
          if ((route === 'home' || route === 'timeline') && (!depts.includes(dept) || (route === 'timeline' && !url.searchParams.get('dept')))) throw new Failure(400, 'bad_request', '진료과를 선택해 주세요.');
          const selected = visits.filter(v => v.dept === dept);
          const recent = selected.filter(v => v.status === 'done').sort((a, b) => b.date.localeCompare(a.date)).map(v => view(v, member));
          if (route === 'home' && req.method === 'GET') {
            const upcoming = selected.find(v => v.status === 'upcoming');
            const home: HomeRes = { patient: { id: patient.id, name: patient.name }, me: { role: member.role, canManageScopes: member.role === 'patient' },
              depts, nextVisit: upcoming ? { meta: meta(upcoming), ...(member.scope !== 'schedule' ? { questionCount: questions.filter(q => q.visitId === upcoming.id && (q.visibility === 'companion' || member.scope === 'full')).length, briefingReady: true } : {}) } : null,
              ...(member.scope === 'full' ? { openAlertCount: dept === '내과' ? 1 : 0 } : {}), recent: recent.slice(0, 5) };
            return send(200, home);
          }
          if (route === 'timeline' && req.method === 'GET') return send(200, { items: recent });
          const visitRoute = /^visits\/([^/]+)(?:\/(.*))?$/.exec(route);
          const visit = visits.find(v => v.id === visitRoute?.[1]);
          if (!visit || !visitRoute) throw new Failure(404, 'not_found', '찾을 수 없어요.');
          const section = visitRoute[2];
          if (!section && req.method === 'GET') {
            if (url.searchParams.get('view') === 'draft') throw new Failure(404, 'not_found', '찾을 수 없어요.');
            return send(200, view(visit, member));
          }
          if (member.scope === 'schedule' || visit.id !== 'v_im_03') throw new Failure(404, 'not_found', '찾을 수 없어요.');
          if (section === 'questions' && req.method === 'GET') {
            const response: QuestionsRes = { originals: questions.filter(q => q.visitId === visit.id && (q.visibility === 'companion' || member.scope === 'full')).map(q => ({ id: q.id, text: q.text, author: { userId: q.authorId, name: accounts.users.find(u => u.id === q.authorId)!.name }, createdAt: q.createdAt })),
              questionsInputVersion: inputVersion, merged: { version: 1, mode: 'fixture', stale: inputVersion !== 3, ...(member.scope === 'full' ? { state: 'ready' as const } : {}), blocks: { companion: merged.companion!, ...(member.scope === 'full' ? { full: merged.full! } : {}) } } };
            return send(200, response);
          }
          if (section === 'questions' && req.method === 'POST') {
            const data = await body(req);
            if (typeof data.text !== 'string' || !data.text.trim() || data.text.trim().length > 200) throw new Failure(400, 'bad_request', '질문은 1~200자로 적어 주세요.');
            const text = data.text.trim();
            // Newly submitted preview questions stay full-only until the real validator is connected.
            if (member.scope !== 'full') throw new Failure(403, 'forbidden', '질문 등록은 준비 중이에요. 지금은 저장된 질문을 확인해 주세요.');
            const id = randomUUID();
            questions.push({ id, patientId: patient.id, visitId: visit.id, authorId: user.id, text, visibility: 'full', createdAt: new Date().toISOString() }); inputVersion++;
            return send(201, { id, questionsInputVersion: inputVersion });
          }
          if (section === 'briefing' && req.method === 'GET') return send(200, {
            version: 1, mode: 'fixture', stale: inputVersion !== 3, ...(member.scope === 'full' ? { state: 'ready' as const } : {}),
            blocks: { companion: briefing.companion!, ...(member.scope === 'full' ? { full: briefing.full! } : {}) }, questions: merged.companion!.mergedQuestions,
          } satisfies BriefingRes);
          if ((section === 'questions/merge' || section === 'briefing') && req.method === 'POST') {
            const data = await body(req);
            if (section === 'questions/merge' && data.inputVersion !== inputVersion) throw new Failure(409, 'conflict', '새 질문이 있어요. 목록을 다시 확인해 주세요.', 'stale_input');
            if (section === 'briefing' && (data.questionsVersion !== 1 || inputVersion !== 3)) throw new Failure(409, 'conflict', '질문을 다시 정리해 주세요.', 'not_ready');
            const kind = section === 'questions/merge' ? 'merge_questions' : 'briefing';
            const existing = [...jobs.values()].find(j => j.userId === user.id && j.job.kind === kind && j.inputVersion === inputVersion && j.job.status !== 'failed');
            if (existing) return send(202, { jobId: existing.job.id });
            const id = randomUUID(); const now = new Date().toISOString();
            jobs.set(id, { userId: user.id, inputVersion, polls: 0, job: { id, kind, visitId: visit.id, status: 'queued', attempt: [...jobs.values()].filter(j => j.userId === user.id && j.job.kind === kind && j.inputVersion === inputVersion).length + 1, mode: 'fixture', resultVersion: null, resultState: null, errorCode: null, createdAt: now, updatedAt: now } });
            return send(202, { jobId: id });
          }
          throw new Failure(404, 'not_found', '찾을 수 없어요.');
        } catch (error) {
          const failure = error instanceof Failure ? error : new Failure(500, 'internal_error', '요청을 처리하지 못했어요.');
          send(failure.status, { error: { code: failure.code, message: failure.message, ...(failure.reason ? { reason: failure.reason } : {}), requestId: randomUUID() } });
        }
      });
    },
  };
}
