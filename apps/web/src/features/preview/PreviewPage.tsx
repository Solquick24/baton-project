import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui';
import { PreviewNotice } from '../visit/Workflow';

export function PreviewPage() {
  const { kind } = useParams(); const [checked, setChecked] = useState(false), [done, setDone] = useState(false);
  return <div className="stack"><Link className="back" to="/settings">← 설정</Link><PreviewNotice>입력 흐름만 확인해요. 실제 동의·초대·일정 등록은 처리하지 않아요.</PreviewNotice>
    <form className="stack" onSubmit={e => { e.preventDefault(); setDone(true); }}>
      {kind === 'consent' ? <Card><h2>민감정보 별도 동의 · 시연</h2><p>진료 기록·가족 공유의 고지 화면을 확인해요.</p><p>실제 정보 처리 조건·보관 기간은 아직 확정되지 않았어요.</p><label className="choice"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />시연용 고지 확인</label><p className="footnote">미성년자·보호자 동의 경로는 준비 중이에요.</p></Card> : kind === 'invite' ? <Card><h2>가족 연결·초대</h2><label>가상 가족 이메일<input type="email" placeholder="family@baton.demo" required /></label><label className="choice"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />시연용 초대 내용 확인</label><p className="footnote">실제 초대 메시지는 보내지 않아요.</p></Card> : <Card><h2>진료 일정 등록</h2><label>날짜<input type="date" required /></label><label>시간<input type="time" required /></label><label>진료과<input placeholder="시연할 진료과" required /></label><label className="choice"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />시연용 일정 내용 확인</label></Card>}
      <button className="primary" disabled={!checked}>화면 확인하기</button>{done && <p role="status">입력 화면을 확인했어요. 실제 등록·연결·동의는 처리하지 않았어요.</p>}
    </form>
  </div>;
}
