import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Sheet, Seg } from '../components/ui.jsx';
import { setTroopCode, usePatrols, useLeaderMode, useAccount, signOut, redeemCode } from '../lib/api.js';
import { useMe } from '../lib/store.js';
import { troop } from '../lib/config.js';
import { NotificationsCard } from '../components/Notify.jsx';

export default function More() {
  const [me, setMe] = useMe();
  const leader = useLeaderMode();
  const [editing, setEditing] = useState(false);
  const acct = useAccount();
  const links = [
    ['advancement', 'trophy', 'Advancement', acct?.member?.leader ? 'The whole troop\'s trail to Eagle' : 'Ranks and merit badges'],
    ['counselors', 'people', 'Merit badge counselors', 'Who counsels which badge'],
    ['gear', 'box', 'Gear locker', 'Tents, stoves and the merit badge library'],
    ['kitchen', 'pot', 'Troop kitchen', 'Recipes and the pantry'],
    ['gallery', 'image', 'Photo gallery', 'Every outing, every patrol'],
    ['slideshow', 'play', 'Slideshow', 'For Courts of Honor and banquets'],
    ['packing', 'checklist', 'Packing list', 'Standard overnight list'],
    ['permission', 'shield', 'Photo permission', 'For parents and guardians'],
    ['leaders', 'settings', 'Leader tools', leader ? 'Signed in' : 'Photo review, bulletin, settings'],
  ];
  return (
    <div className="content">
      <PageHead title="More" />
      {acct ? (
        <div className="card me-card static">
          <span className="me-ini">{me.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
          <span className="grow"><b>{acct.member.name}</b><span className="small muted">{acct.member.role === 'scout' ? 'Scout' : acct.member.leader ? 'Leader' : 'Parent'}{acct.member.patrol ? ` · ${acct.member.patrol}` : ''}{acct.member.positions?.length ? ` · ${acct.member.positions[0]}` : ''}</span>
            {acct.scouts?.length > 0 && <span className="small muted">Linked: {acct.scouts.map(x => x.name).join(', ')}</span>}
            <span className="small good-text"><Icon name="check" size={13} strokeWidth={3} /> Signed in. Your data syncs to every phone you sign in on.</span>
          </span>
        </div>
      ) : (
        <GuestCard me={me} onEdit={() => setEditing(true)} />
      )}
      {acct && <NotificationsCard />}
      <ul className="more-list">
        {links.map(([to, ic, l, sub]) => <li key={to}><a href={`#/${to}`}><span className="more-ico"><Icon name={ic} size={22} /></span><span className="grow"><b>{l}</b><span>{sub}</span></span><Icon name="chevronR" size={18} /></a></li>)}
      </ul>
      <div className="card tip"><Icon name="share" size={20} /><span><b>Add Basecamp to your home screen.</b> iPhone: Share → Add to Home Screen. Android: menu ⋮ → Add to Home screen.</span></div>
      <p className="center"><button className="link-btn" onClick={async () => { if (confirm(acct ? 'Sign out on this phone? You\'ll need your personal code to sign back in.' : 'Sign out on this phone? You\'ll need the troop code to get back in.')) { if (acct) await signOut(); else setTroopCode(''); location.hash = '#/'; } }}><Icon name="logout" size={16} />Sign out</button></p>
      <p className="small muted center">{troop.appName} · {troop.place}</p>
      <Sheet open={editing} onClose={() => setEditing(false)} title="About you">{editing && <MeForm me={me} onSave={v => { setMe(v); setEditing(false); }} />}</Sheet>
    </div>
  );
}

function MeForm({ me, onSave }) {
  const [f, setF] = useState(me);
  const patrols = usePatrols() || troop.patrols;
  return (
    <form onSubmit={e => { e.preventDefault(); if (f.name.trim()) onSave(f); }}>
      <label className="field"><span>Your name</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></label>
      <div className="field"><span>I'm a…</span><Seg label="Role" value={f.role} onChange={role => setF({ ...f, role })} options={[['scout', 'Scout'], ['parent', 'Parent'], ['leader', 'Leader']]} /></div>
      <label className="field"><span>Patrol</span><select value={f.patrol} onChange={e => setF({ ...f, patrol: e.target.value })}><option value="">None</option>{patrols.map(p => <option key={p}>{p}</option>)}</select></label>
      <button className="btn">Save</button>
    </form>
  );
}

function GuestCard({ me, onEdit }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const fmt = v => { const x = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); return x.length > 4 ? `${x.slice(0, 4)}-${x.slice(4)}` : x; };
  return (
    <div className="card guest-card">
      <div className="me-card static">
        <span className="me-ini">{me.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}</span>
        <span className="grow"><b>{me.name || 'Guest'}</b><span className="small muted">Guest · {me.role === 'scout' ? 'Scout' : me.role === 'leader' ? 'Leader' : 'Parent'}{me.patrol ? ` · ${me.patrol}` : ''}</span></span>
        <button className="link-btn small" onClick={onEdit}>Edit</button>
      </div>
      <form className="guest-signin" onSubmit={async e => { e.preventDefault(); setMsg(''); try { await redeemCode(code); } catch (err) { setMsg(err.message); } }}>
        <p className="small"><b>Have a personal code?</b> Sign in to use chat, sign up your family, see advancement and keep everything synced across phones.</p>
        <div className="row-input"><input className="code-input" value={code} onChange={e => setCode(fmt(e.target.value))} placeholder="ABCD-EF23" aria-label="Personal code" autoCapitalize="characters" /><button className="btn small" disabled={code.replace(/-/g, '').length < 8}>Sign in</button></div>
        {msg && <p className="form-msg" role="alert">{msg}</p>}
      </form>
    </div>
  );
}
