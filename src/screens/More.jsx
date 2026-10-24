import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Sheet, Seg } from '../components/ui.jsx';
import { setTroopCode, usePatrols, useLeaderMode } from '../lib/api.js';
import { useMe } from '../lib/store.js';
import { troop } from '../lib/config.js';

export default function More() {
  const [me, setMe] = useMe();
  const leader = useLeaderMode();
  const [editing, setEditing] = useState(false);
  const links = [
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
      <button className="card me-card" onClick={() => setEditing(true)}>
        <span className="me-ini">{me.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
        <span className="grow"><b>{me.name}</b><span className="small muted">{me.role === 'scout' ? 'Scout' : me.role === 'leader' ? 'Leader' : 'Parent'}{me.patrol ? ` · ${me.patrol}` : ''}</span></span>
        <span className="link-btn small">Edit</span>
      </button>
      <ul className="more-list">
        {links.map(([to, ic, l, sub]) => <li key={to}><a href={`#/${to}`}><span className="more-ico"><Icon name={ic} size={22} /></span><span className="grow"><b>{l}</b><span>{sub}</span></span><Icon name="chevronR" size={18} /></a></li>)}
      </ul>
      <div className="card tip"><Icon name="share" size={20} /><span><b>Add Basecamp to your home screen.</b> iPhone: Share → Add to Home Screen. Android: menu ⋮ → Add to Home screen.</span></div>
      <p className="center"><button className="link-btn" onClick={() => { if (confirm('Sign out on this phone? You\'ll need the troop code to get back in.')) { setTroopCode(''); location.hash = '#/'; } }}><Icon name="logout" size={16} />Sign out</button></p>
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
