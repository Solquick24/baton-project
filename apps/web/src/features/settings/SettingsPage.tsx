import { useContext } from 'react';
import { DisplayContext, type Display } from '../../app/display-settings';
import { SessionContext } from '../../app/session';
import { Card } from '../../components/ui';
import { SharingSettings } from './SharingPage';
export function SettingsPage({ pid }: { pid: string | undefined }) {
  const display = useContext(DisplayContext), { session, setSession } = useContext(SessionContext);
  return <div className="stack"><Card><h2>{session?.user.name}님</h2><p className="muted">내 화면 보기 설정</p></Card><Card><fieldset><legend>글씨 크기</legend>{([['normal', '보통'], ['large', '크게'], ['extra-large', '아주 크게']] as const).map(([key, label]) => <label className="choice" key={key}><input data-testid={`font-size-${key}`} type="radio" name="font-size" checked={display.value.font === key} onChange={() => display.set({ ...display.value, font: key as Display['font'] })} />{label}</label>)}</fieldset><label className="choice"><input data-testid="high-contrast" type="checkbox" checked={display.value.contrast} onChange={e => display.set({ ...display.value, contrast: e.target.checked })} />고대비 화면</label></Card><SharingSettings pid={pid} /><Card><button data-testid="logout" onClick={() => setSession(null)}>로그아웃</button></Card></div>;
}
