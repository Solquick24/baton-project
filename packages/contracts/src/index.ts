import { z } from 'zod';

// Phase 1 connectivity only. Patient/block contracts are implemented in T008.
export const healthResponseSchema = z.object({ status: z.literal('ok') }).strict();
export type HealthResponse = z.infer<typeof healthResponseSchema>;

// Read DTOs from schemas.md. Runtime validation and write contracts remain T008.
export type Mode = 'live' | 'fixture';
export type Role = 'patient' | 'lead' | 'guardian';
export interface Item { id: string; text: string | null; needsCheck: boolean }
export interface SourceRef {
  itemId: string;
  source: { type: 'transcript'; segmentId: string } | { type: 'note'; noteId: string }
    | { type: 'prescription'; prescriptionId: string } | { type: 'observation'; observationId: string }
    | { type: 'question'; questionId: string } | { type: 'record'; visitId: string; version: number; itemId: string };
  quote: string | null;
}
export interface VisitMeta {
  id: string; patientId: string; date: string; time: string | null; dept: string;
  hospital: { id: string; name: string }; companion: { userId: string; name: string } | null;
  status: 'upcoming' | 'done';
}
export interface VisitView {
  meta: VisitMeta;
  record?: {
    view: 'published'; version: number; mode: Mode;
    blocks: {
      schedule?: { nextSchedule: Array<{ id: string; date: string | null; time: string | null; dept: string | null; hospital: string | null; needsCheck: boolean }> };
      companion?: {
        medChanges: Array<{ id: string; drug: string; change: 'start' | 'stop' | 'dose' | 'timing' | 'keep'; from: string | null; to: string | null; caution: string | null; needsCheck: boolean }>;
        easySummary: Item[];
      };
      full?: {
        diagnosis: Item[]; labResults: Array<{ id: string; name: string; value: string | null; unit: string | null; needsCheck: boolean }>;
        doctorExplanation: Item[]; medReasons: Array<Item & { medChangeId: string }>;
        answers: Array<Item & { questionId: string }>; sourceRefs: SourceRef[];
      };
    };
  };
}
export interface HomeRes {
  patient: { id: string; name: string }; me: { role: Role; canManageScopes: boolean }; depts: string[];
  nextVisit: null | { meta: VisitMeta; questionCount?: number; briefingReady?: boolean };
  openAlertCount?: number; recent: VisitView[];
}
export interface LoginRes { accessToken: string; user: { id: string; name: string } }
export interface MePatientsRes { self: { patientId: string | null }; linked: Array<{ patientId: string; name: string }> }
export interface MergedQuestion extends Item { text: string; fromQuestionIds: string[]; addedByAI: boolean }
export interface QuestionsRes {
  originals: Array<{ id: string; text: string; author: { userId: string; name: string }; createdAt: string }>;
  questionsInputVersion: number;
  merged?: { version: number; mode: Mode; stale: boolean; state?: 'ready' | 'blocked'; blocks: { companion?: { mergedQuestions: MergedQuestion[] }; full?: { basisRefs: SourceRef[] } } };
}
export interface BriefingRes {
  version: number; mode: Mode; stale: boolean; state?: 'ready' | 'blocked';
  blocks: {
    companion?: { briefing: { changes: Item[]; questions: string[] } };
    full?: { briefing: { changeReasons: Array<Item & { changeId: string }>; watch: Item[]; tests: Item[]; prep: Array<Item & { label: string }> }; sourceRefs: SourceRef[] };
  };
  questions: MergedQuestion[];
}
export interface Job {
  id: string; kind: 'transcribe' | 'merge_questions' | 'briefing' | 'structure'; visitId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed'; attempt: number; mode: Mode | null;
  resultVersion: number | null; resultState: 'generating' | 'ready' | 'blocked' | 'failed' | null;
  errorCode: 'ai_unavailable' | 'stt_unavailable' | 'validation_failed' | 'stale_input' | 'internal' | null;
  createdAt: string; updatedAt: string;
}
