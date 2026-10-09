import { createContext, useContext, useState, type ReactNode } from 'react';

export type DocumentPreview = { file: File; category: string; date: string; dept: string; text: string };
type PrivateNote = { id: string; text: string; include: boolean };
const WorkflowContext = createContext<{
  documents: Record<string, DocumentPreview | undefined>;
  setDocument: (key: string, value: DocumentPreview | undefined) => void;
  notes: Record<string, PrivateNote[]>;
  setNotes: (key: string, value: PrivateNote[]) => void;
  checks: Record<string, string[]>;
  setChecks: (key: string, value: string[]) => void;
}>({ documents: {}, setDocument: () => {}, notes: {}, setNotes: () => {}, checks: {}, setChecks: () => {} });

// Screen previews stay in memory for this login. They never enter AI requests or the database.
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [documents, updateDocuments] = useState<Record<string, DocumentPreview | undefined>>({});
  const [notes, updateNotes] = useState<Record<string, PrivateNote[]>>({});
  const [checks, updateChecks] = useState<Record<string, string[]>>({});
  return <WorkflowContext.Provider value={{ documents, setDocument: (key, value) => updateDocuments(previous => ({ ...previous, [key]: value })), notes,
    setNotes: (key, value) => updateNotes(previous => ({ ...previous, [key]: value })), checks,
    setChecks: (key, value) => updateChecks(previous => ({ ...previous, [key]: value })) }}>{children}</WorkflowContext.Provider>;
}
export const useWorkflow = () => useContext(WorkflowContext);

export function WorkflowSteps({ current }: { current: 1 | 2 | 3 }) {
  return <ol className="workflow-steps" aria-label="진료 기록 진행 단계">{['진료 기록', '문서 · 선택', '검토·공유'].map((label, index) => <li key={label} aria-current={current === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>;
}

export function PreviewNotice({ children }: { children: ReactNode }) {
  return <p className="preview-notice"><span className="badge">화면 시연</span> {children}</p>;
}
