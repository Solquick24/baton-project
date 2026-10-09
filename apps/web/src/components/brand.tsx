// Mascots accompany visible copy; they never convey a status or permission alone.
export function BatonMascot({ pose }: { pose: 'prepare' | 'handoff' | 'welcome' }) {
  const images = { prepare: 'a2-prepare', handoff: 'a3-handoff', welcome: 'a4-welcome' };
  return <img className="baton-mascot" src={`/brand/${images[pose]}.webp`} width="84" height="84" alt="" aria-hidden="true" decoding="async" />;
}

export function BatonIcon() {
  return <img className="baton-icon" src="/brand/a1-icon-192.png" width="58" height="58" alt="" aria-hidden="true" decoding="async" />;
}
