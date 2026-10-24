import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Mark, Seg } from '../components/ui.jsx';
import { api, setTroopCode, troopCode, useApi } from '../lib/api.js';
import { useMe } from '../lib/store.js';
import { troop } from '../lib/config.js';

// Step 1: troop code (keeps everything private to the troop).
// Step 2: who's using this phone (used for sign-ups, gear and photos).
export default function Gate() {
  const [hasCode, setHasCode] = useState(!!troopCode());
  return (
    <div className="gate">
      <div className="gate-hills" aria-hidden="true">
        <svg viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 120 L0 70 L55 30 L105 66 L170 12 L235 74 L290 38 L345 70 L400 44 L400 120Z" /></svg>
      </div>
      <div className="gate-card">
        <Mark size={troop.logo ? 120 : 112} dark className="gate-mark" />
        <h1>{troop.appName}</h1>
        <p className="gate-tag">{troop.tagline}</p>
        {hasCode ? <WhoAmI /> : <CodeForm onOk={() => setHasCode(true)} />}
        <p className="gate-note"><Icon name="lock" size={16} /> Private to {troop.unit} · {troop.place}</p>
      </div>
    </div>
  );
}

function CodeForm({ onOk }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function join(e) {
    e.preventDefault();
    const c = code.trim(); if (!c) return;
    setBusy(true); setMsg('');
    try { await api('join', { method: 'POST', body: { code: c } }); setTroopCode(c); onOk(); }
    catch (err) { setMsg(err.message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={join} className="gate-form">
      <label className="field"><span>Troop code</span>
        <input value={code} onChange={e => setCode(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck="false" placeholder="From your Scoutmaster" enterKeyHint="go" />
      </label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn accent big" disabled={busy || !code.trim()}>{busy ? 'Checking…' : <>Head to basecamp <Icon name="chevronR" size={20} /></>}</button>
    </form>
  );
}

function WhoAmI() {
  const [me, setMe] = useMe();
  const [f, setF] = useState({ name: me.name, role: me.role || 'scout', patrol: me.patrol || '' });
  const s = useApi('settings');
  const patrols = s.data?.patrols || troop.patrols;
  return (
    <form className="gate-form" onSubmit={e => { e.preventDefault(); if (f.name.trim()) { setMe(f); location.hash = '#/'; } }}>
      <p className="gate-step">Who's using this phone?</p>
      <label className="field"><span>Your name</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="name" placeholder="First and last name" required /></label>
      <div className="field"><span>I'm a…</span><Seg label="Role" value={f.role} onChange={role => setF({ ...f, role })} options={[['scout', 'Scout'], ['parent', 'Parent'], ['leader', 'Leader']]} /></div>
      <label className="field"><span>Patrol</span>
        <select value={f.patrol} onChange={e => setF({ ...f, patrol: e.target.value })}>
          <option value="">{f.role === 'scout' ? 'Choose your patrol' : 'None / not sure'}</option>
          {patrols.map(p => <option key={p}>{p}</option>)}
        </select>
      </label>
      <button className="btn accent big" disabled={!f.name.trim()}>Let's go <Icon name="chevronR" size={20} /></button>
      <p className="small muted center">Only shown inside the troop app. You can change this later under More.</p>
    </form>
  );
}
