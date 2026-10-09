import { createContext, useEffect, useState, type ReactNode } from 'react';
export type Display = { font: 'normal' | 'large' | 'extra-large'; contrast: boolean };
const defaults: Display = { font: 'normal', contrast: false };
export const DisplayContext = createContext<{ value: Display; set: (value: Display) => void }>({ value: defaults, set: () => {} });
function initialDisplay(): Display {
  try {
    const v = JSON.parse(localStorage.getItem('baton.display') ?? 'null');
    if (v && ['normal', 'large', 'extra-large'].includes(v.font) && typeof v.contrast === 'boolean') return { font: v.font, contrast: v.contrast };
  } catch { /* Storage is optional. */ }
  return defaults;
}
export function DisplayProvider({ children }: { children: ReactNode }) {
  const [value, set] = useState<Display>(initialDisplay);
  useEffect(() => {
    document.documentElement.dataset.font = value.font;
    document.documentElement.dataset.contrast = String(value.contrast);
    try { localStorage.setItem('baton.display', JSON.stringify(value)); } catch { /* Keep the current tab usable. */ }
  }, [value]);
  return <DisplayContext.Provider value={{ value, set }}>{children}</DisplayContext.Provider>;
}
