import { scopeSchema, type BlockKind } from '@baton/contracts';

export const ALLOWED_KINDS = {
  schedule: ['schedule'], companion: ['schedule', 'companion'], full: ['schedule', 'companion', 'full'],
} as const;
export function allowedKinds(scope: unknown): readonly BlockKind[] {
  const result = scopeSchema.safeParse(scope);
  return result.success ? ALLOWED_KINDS[result.data] : [];
}
/** Unlisted content remains full-only; schemas still reject unrecognized fields. */
export function minimumKind(field: string): BlockKind {
  if (field === 'meta' || field === 'nextSchedule') return 'schedule';
  if (['medChanges', 'easySummary', 'mergedQuestions', 'changes', 'questions', 'questionCount', 'briefingReady'].includes(field)) return 'companion';
  return 'full';
}
