import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { pushSupport, pushStatus, enablePush, disablePush, savePushPrefs, testPush } from '../lib/push.js';

const KINDS = [
  ['messages', 'Messages to me', 'Conversations you\'re in, and replies to your requests'],
  ['boards', 'Boards', 'Whole troop, your patrol and your groups'],
  ['news', 'Announcements', 'New posts from the troop leaders'],
];

function usePush() {
  const [st, setSt] = useState({ loading: true, on: false, prefs: { messages: true, boards: true, news: true } });
  const support = pushSupport();
  useEffect(() => {
    let live = true;
    pushStatus().then(d => live && setSt({ loading: false, on: !!d.on, prefs: d.prefs || st.prefs })).catch(() => live && setSt(s => ({ ...s, loading: false })));
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [st, setSt, support];
}

// More → Notifications
export function NotificationsCard() {
  const [st, setSt, support] = usePush();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  async function run(fn, ok) {
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (ok) setMsg({ text: ok }); return r; } catch (e) { setMsg({ bad: true, text: e.message }); } finally { setBusy(false); }
  }
  const turnOn = () => run(async () => { const r = await enablePush(st.prefs); setSt({ loading: false, on: true, prefs: r.prefs }); await testPush(); }, 'Notifications are on. You should see a test one now.');
  const turnOff = () => run(async () => { await disablePush(); setSt(s => ({ ...s, on: false })); }, 'Notifications are off for this phone.');
  const toggle = k => run(async () => { const prefs = { ...st.prefs, [k]: !st.prefs[k] }; setSt(s => ({ ...s, prefs })); await savePushPrefs(prefs); });
  return (
    <section className="card notify-card" aria-labelledby="notify-h">
      <div className="notify-head">
        <span className="more-ico"><Icon name="bell" size={22} /></span>
        <span className="grow"><b id="notify-h">Notifications</b><span className="small muted">{st.on ? 'On for this phone' : 'Get a buzz for new messages and announcements'}</span></span>
        {support === 'ok' && !st.loading && (st.on
          ? <button className="link-btn small" onClick={turnOff} disabled={busy}>Turn off</button>
          : <button className="btn small" onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on'}</button>)}
      </div>
      {support === 'install' && <p className="small notify-note"><b>iPhone:</b> add Basecamp to your Home Screen first (Share → Add to Home Screen), open it from there, then turn notifications on here.</p>}
      {support === 'blocked' && <p className="small notify-note">Notifications are blocked for Basecamp. Turn them on in your phone's settings for this app, then come back.</p>}
      {support === 'unsupported' && <p className="small notify-note">This browser can't show notifications. Try Chrome on Android, or Safari on iPhone after adding Basecamp to your Home Screen.</p>}
      {st.on && (
        <ul className="notify-kinds">
          {KINDS.map(([k, l, sub]) => (
            <li key={k}><label className="switch-row">
              <span className="grow"><b>{l}</b><span className="small muted">{sub}</span></span>
              <input type="checkbox" role="switch" checked={!!st.prefs[k]} onChange={() => toggle(k)} disabled={busy} />
            </label></li>
          ))}
        </ul>
      )}
      {msg && <p className={`form-msg ${msg.bad ? '' : 'good'}`} role="status">{msg.text}</p>}
    </section>
  );
}

// A one-line nudge at the top of Chat until notifications are on (or dismissed).
export function NotifyNudge() {
  const [st, setSt, support] = usePush();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('t23-notify-nudge') === 'no'; } catch { return false; } });
  const [msg, setMsg] = useState('');
  if (hidden || st.loading || st.on || !['ok', 'install'].includes(support)) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem('t23-notify-nudge', 'no'); } catch { /* private mode */ } };
  return (
    <div className="notify-nudge">
      <Icon name="bell" size={18} />
      <span className="grow">{support === 'install' ? 'Add Basecamp to your Home Screen to get message notifications.' : msg || 'Get notified when someone messages you.'}</span>
      {support === 'ok' && <button className="btn small" onClick={async () => { try { const r = await enablePush(st.prefs); setSt({ loading: false, on: true, prefs: r.prefs }); } catch (e) { setMsg(e.message); } }}>Turn on</button>}
      <button className="icon-btn sm" onClick={dismiss} aria-label="Dismiss"><Icon name="x" size={16} /></button>
    </div>
  );
}
