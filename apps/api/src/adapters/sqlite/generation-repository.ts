import { briefingBlocksSchema, questionsBlocksSchema, recordBlocksSchema, sectionSchema, type Section } from '@baton/contracts';
import type { BatonDatabase } from './database.js';
import { requireMembership, assertAction } from '../../auth/permissions.js';
import { ApiError } from '../../shared/errors.js';

const storedSchemas = { record: recordBlocksSchema, questions: questionsBlocksSchema, briefing: briefingBlocksSchema };
function readInternalSet(db: BatonDatabase, patientId: string, visitId: string, section: Section, version: number) {
  const rows = db.prepare(`SELECT vb.kind,vb.payload FROM visit_blocks vb JOIN block_sets bs ON bs.id=vb.blockSetId
    WHERE bs.patientId=? AND bs.visitId=? AND bs.section=? AND bs.version=? AND bs.state='ready'`).all(patientId, visitId, section, version) as Array<{ kind: string; payload: string }>;
  const blocks = Object.fromEntries(rows.map((r) => [r.kind, JSON.parse(r.payload)]));
  return storedSchemas[section].parse(blocks);
}
/** Internal generation input only. Never called by external read handlers/repository. */
export function loadGenerationInput(db: BatonDatabase, userId: string, patientId: string, visitId: string, purpose: Section) {
  if (!sectionSchema.safeParse(purpose).success) throw new ApiError('bad_request');
  assertAction(requireMembership(db, userId, patientId), 'generate');
  const v = db.prepare('SELECT id,dept,date,questionsVersion FROM visits WHERE id=? AND patientId=?').get(visitId, patientId) as { id: string; dept: string; date: string; questionsVersion: number | null } | undefined;
  if (!v || !v.dept.trim()) throw new ApiError('not_found');
  const common = { patientId, visitId, dept: v.dept, purpose };
  const questions = db.prepare('SELECT id,text,authorId,visibility FROM questions WHERE patientId=? AND visitId=? ORDER BY createdAt,id').all(patientId, visitId) as Array<{ id: string; text: string; authorId: string; visibility: 'companion' | 'full' }>;
  if (purpose === 'record') {
    const notes = db.prepare('SELECT id,text FROM notes WHERE patientId=? AND visitId=? ORDER BY createdAt,id').all(patientId, visitId) as Array<{ id: string; text: string }>;
    const transcript = db.prepare('SELECT id,uploadId,mode,segments FROM transcripts WHERE patientId=? AND visitId=? ORDER BY createdAt DESC,id DESC LIMIT 1').get(patientId, visitId) as { id: string; uploadId: string | null; mode: string; segments: string } | undefined;
    const prescriptions = db.prepare('SELECT id,text,items FROM prescriptions WHERE patientId=? AND visitId=?').all(patientId, visitId) as Array<{ id: string; text: string; items: string }>;
    return { ...common, questions, notes, transcript: transcript ? { ...transcript, segments: JSON.parse(transcript.segments) } : null,
      prescriptions: prescriptions.map((p) => ({ ...p, items: JSON.parse(p.items) })),
      merged: v.questionsVersion ? readInternalSet(db, patientId, visitId, 'questions', v.questionsVersion) : null,
    };
  }
  const past = db.prepare(`SELECT id,recordPublishedVersion FROM visits WHERE patientId=? AND dept=? AND date<? AND id<>? AND recordPublishedVersion IS NOT NULL ORDER BY date,id`).all(patientId, v.dept, v.date, visitId) as Array<{ id: string; recordPublishedVersion: number }>;
  const records = past.map((p) => ({ visitId: p.id, version: p.recordPublishedVersion, blocks: readInternalSet(db, patientId, p.id, 'record', p.recordPublishedVersion) }));
  const alerts = db.prepare(`SELECT a.id,a.visitId,a."references",a.differences,a.summary,a.status FROM alerts a JOIN visits v ON v.id=a.visitId AND v.patientId=a.patientId
    WHERE a.patientId=? AND a.dept=? AND v.dept=? AND v.date<=? AND a.status<>'resolved'`).all(patientId, v.dept, v.dept, v.date) as Array<{ id: string; visitId: string; references: string; differences: string; summary: string; status: string }>;
  const safeAlerts = alerts.map((a) => ({ ...a, references: JSON.parse(a.references), differences: JSON.parse(a.differences) }));
  if (purpose === 'questions') return { ...common, questions, records, alerts: safeAlerts };
  if (!v.questionsVersion) throw new ApiError('conflict', 'not_ready');
  const observations = db.prepare(`SELECT o.id,o.text,o.fact,o.date FROM observations o WHERE o.patientId=? AND o.dept=? AND o.date<=?
    AND NOT EXISTS (SELECT 1 FROM observations n WHERE n.supersedesId=o.id AND n.patientId=o.patientId AND n.date<=?) ORDER BY o.date,o.id`).all(patientId, v.dept, v.date, v.date) as Array<{ id: string; text: string; fact: string | null; date: string }>;
  return { ...common, questions, records, alerts: safeAlerts, observations: observations.map((o) => ({ ...o, fact: o.fact ? JSON.parse(o.fact) : null })),
    merged: readInternalSet(db, patientId, visitId, 'questions', v.questionsVersion),
  };
}
export type GenerationInput = ReturnType<typeof loadGenerationInput>;
