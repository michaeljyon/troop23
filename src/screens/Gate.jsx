import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Mark, Seg } from '../components/ui.jsx';
import { api, setTroopCode, troopCode, useApi, redeemCode } from '../lib/api.js';
import { useMe } from '../lib/store.js';
import { troop } from '../lib/config.js';

// Sign in with a personal code (your own account, synced across devices),
// or with the troop code as a guest.
export default function Gate({ route }) {
  const joinCode = route?.name === 'join' ? route.args[0] : '';
  const [mode, setMode] = useState(troopCode() ? 'who' : 'personal');
  return (
    <div className="gate">
      <div className="gate-hills" aria-hidden="true">
        <svg viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 120 L0 70 L55 30 L105 66 L170 12 L235 74 L290 38 L345 70 L400 44 L400 120Z" /></svg>
      </div>
      <div className="gate-card">
        <Mark size={troop.logo ? 120 : 104} dark className="gate-mark" />
        <h1>{troop.appName}</h1>
        <p className="gate-tag">{troop.tagline}</p>
        {mode === 'personal' && <PersonalCode initial={joinCode} onGuest={() => setMode('troop')} />}
        {mode === 'troop' && <CodeForm onOk={() => setMode('who')} onBack={() => setMode('personal')} />}
        {mode === 'who' && <WhoAmI onBack={() => { setTroopCode(''); setMode('personal'); }} />}
        <p className="gate-note"><Icon name="lock" size={16} /> Private to {troop.unit} · {troop.place}</p>
      </div>
    </div>
  );
}

function PersonalCode({ initial, onGuest }) {
  const [code, setCode] = useState(initial || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function go(c = code) {
    if (!c.trim()) return;
    setBusy(true); setMsg('');
    try { await redeemCode(c.trim()); location.hash = '#/'; }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { if (initial) go(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fmt = v => { const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s; };
  return (
    <form className="gate-form" onSubmit={e => { e.preventDefault(); go(); }}>
      <p className="gate-step">Sign in</p>
      <label className="field"><span>Your personal code</span>
        <input className="code-input" value={code} onChange={e => setCode(fmt(e.target.value))} autoCapitalize="characters" autoCorrect="off" autoComplete="one-time-code" spellCheck="false" placeholder="ABCD-EF23" inputMode="text" />
      </label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn accent big" disabled={busy || code.replace(/-/g, '').length < 8}>{busy ? 'Signing in…' : <>Sign in <Icon name="chevronR" size={20} /></>}</button>
      <p className="small muted center">Your leaders send each scout and parent their own code or sign-in link. It keeps your sign-ups, messages and advancement on every phone you use.</p>
      <button type="button" className="link-btn small center-btn" onClick={onGuest}>I only have the troop code</button>
    </form>
  );
}

function CodeForm({ onOk, onBack }) {
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
      <p className="gate-step">Guest access</p>
      <label className="field"><span>Troop code</span>
        <input value={code} onChange={e => setCode(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck="false" placeholder="From your Scoutmaster" enterKeyHint="go" />
      </label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn accent big" disabled={busy || !code.trim()}>{busy ? 'Checking…' : <>Continue <Icon name="chevronR" size={20} /></>}</button>
      <p className="small muted center">Guests can see outings, photos and the kitchen. Messages and advancement need a personal code.</p>
      <button type="button" className="link-btn small center-btn" onClick={onBack}>I have a personal code</button>
    </form>
  );
}

function WhoAmI({ onBack }) {
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
      <button type="button" className="link-btn small center-btn" onClick={onBack}>Use a personal code instead</button>
    </form>
  );
}
