import { recordScheduleSchema, recordCompanionSchema, recordFullSchema, visitMetaSchema, visitViewSchema, validationIssueSchema, type BlockKind, type VisitView } from '@baton/contracts';
import type { z } from 'zod';

function stored<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error('저장된 자료 형식을 확인해 주세요.');
  return result.data;
}

const recordSchemas = { schedule: recordScheduleSchema, companion: recordCompanionSchema, full: recordFullSchema };
/** Only rows already limited by SQL. Strict nested parsing rejects any extra field. */
export function assembleRecordBlocks(rows: Array<{ kind: BlockKind; payload: string }>): NonNullable<VisitView['record']>['blocks'] {
  const result: NonNullable<VisitView['record']>['blocks'] = {};
  for (const row of rows) {
    switch (row.kind) {
      case 'schedule': result.schedule = stored(recordSchemas.schedule, JSON.parse(row.payload)); break;
      case 'companion': result.companion = stored(recordSchemas.companion, JSON.parse(row.payload)); break;
      case 'full': result.full = stored(recordSchemas.full, JSON.parse(row.payload)); break;
      default: throw new Error('Unrecognized block kind');
    }
  }
  return result;
}
export function assembleVisit(meta: unknown, record?: NonNullable<VisitView['record']>): VisitView {
  return stored(visitViewSchema, { meta: stored(visitMetaSchema, meta), ...(record ? { record } : {}) });
}
export const parseIssues = (rows: Array<{ value: string }>) => rows.map((row) => validationIssueSchema.parse(JSON.parse(row.value)));
