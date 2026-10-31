import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Section, Sheet, Pill } from '../components/ui.jsx';
import { api, useApi, useAccount } from '../lib/api.js';
import { useFeatures } from '../lib/features.js';

// An outing's "Rides & forms" tab: carpool sign-up and the permission slip.

const LEG = { both: 'There and back', to: 'Going only', from: 'Coming home only' };
const when = t => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });

export default function Rides({ outing }) {
  const F = useFeatures();
  return <>{F.slips && <Slip outing={outing} />}{F.carpool && <Carpool outing={outing} />}</>;
}

function Carpool({ outing }) {
  const acct = useAccount();
  const d = useApi(`carpool/${outing.id}`);
  const [offer, setOffer] = useState(false);
  const [ride, setRide] = useState(null);
  const [msg, setMsg] = useState('');
  const act = async body => { setMsg(''); try { await api(`carpool/${outing.id}`, { method: 'POST', body }); d.refresh(); return true; } catch (e) { setMsg(e.message); return false; } };
  if (!d.data) return <Section title="Carpools"><p className="muted">{d.error?.message || 'Loading…'}</p></Section>;
  const { drivers, me, myRiders, isLeader, canDrive } = d.data;
  const mine = drivers.find(v => v.by === me);
  const riding = new Map(drivers.flatMap(v => v.riders.map(r => [r.id, v])));
  const left = (v, leg) => v.seats - v.riders.filter(r => r.leg === 'both' || r.leg === leg || leg === 'both').length;
  // Youth protection: a lone youth with an adult who isn't their parent
  const oneOnOne = v => ['to', 'from'].filter(l => v.leg === 'both' || v.leg === l).some(l => { const rs = v.riders.filter(r => r.leg === 'both' || r.leg === l); const youth = rs.filter(r => r.scout && !(v.kids || []).includes(r.id)); return youth.length === 1 && rs.length === 1; });
  return (
    <Section title="Carpools" action={acct && canDrive && !mine && <button className="link-btn small" onClick={() => setOffer(true)}><Icon name="plus" size={15} />I can drive</button>}>
      {drivers.length === 0 && <p className="small muted">No drivers yet. {canDrive ? 'Tap "I can drive" to offer seats.' : 'Parents and leaders can offer seats here.'}</p>}
      <ul className="cars">{drivers.map(v => (
        <li key={v.id} className="card car">
          <div className="car-head"><span aria-hidden="true" className="car-ico">🚙</span><span className="grow"><b>{v.name}</b><span className="small muted">{LEG[v.leg]}{v.leave ? ` · leaves ${v.leave}` : ''}{v.note ? ` · ${v.note}` : ''}</span></span>
            <span className={`car-seats ${left(v, 'both') <= 0 ? 'full' : ''}`}>{Math.max(0, left(v, 'both'))}<small>open</small></span></div>
          <div className="car-riders">{Array.from({ length: v.seats }).map((_, i) => { const r = v.riders[i]; return <span key={i} className={`seat ${r ? 'taken' : ''}`}>{r ? <>{r.name.split(' ')[0]}{r.leg !== 'both' && <small> ({r.leg === 'to' ? 'there' : 'home'})</small>}{(isLeader || myRiders.some(m => m.id === r.id) || v.by === me) && <button className="chip-x" onClick={() => act({ op: 'unride', driverId: v.id, riderId: r.id })} aria-label={`Take ${r.name} out of this car`}>×</button>}</> : 'Open seat'}</span>; })}</div>
          {oneOnOne(v) && <p className="small warn-text">⚠️ One adult with one scout who isn't their own child. Youth protection rules don't allow that; add another scout or adult to this car.</p>}
          <div className="btn-row tight">
            {acct && myRiders.some(m => !riding.has(m.id)) && left(v, 'both') > 0 && <button className="btn small" onClick={() => setRide(v)}>Ride in this car</button>}
            {(v.by === me || isLeader) && <button className="link-btn small danger" onClick={() => confirm('Take this car off the list?') && act({ op: 'stop', driverId: v.id })}>{v.by === me ? 'I can\'t drive anymore' : 'Remove car'}</button>}
            {v.by === me && <button className="link-btn small" onClick={() => setOffer(true)}>Change</button>}
          </div>
        </li>
      ))}</ul>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <p className="small muted">Drivers should follow the Guide to Safe Scouting: a seat belt for everyone, and no adult alone with a youth who isn't their own child.</p>
      <Sheet open={offer} onClose={() => setOffer(false)} title="Offer seats">{offer && <Offer mine={mine} onSave={async b => { if (await act({ op: 'drive', ...b })) setOffer(false); }} />}</Sheet>
      <Sheet open={!!ride} onClose={() => setRide(null)} title={ride ? `Ride with ${ride.name}` : ''}>{ride && <Ride v={ride} people={myRiders.filter(m => !riding.has(m.id))} onSave={async b => { if (await act({ op: 'ride', driverId: ride.id, ...b })) setRide(null); }} />}</Sheet>
    </Section>
  );
}
function Offer({ mine, onSave }) {
  const [f, setF] = useState({ seats: mine?.seats || 3, leg: mine?.leg || 'both', leave: mine?.leave || '', note: mine?.note || '' });
  return (
    <div>
      <label className="field"><span>Open seats (not counting you)</span><input type="number" min={1} max={14} value={f.seats} onChange={e => setF({ ...f, seats: e.target.value })} /></label>
      <div className="field"><span>Driving</span><div className="el-chips">{Object.entries(LEG).map(([k, l]) => <button key={k} className={`chip sm ${f.leg === k ? 'on' : ''}`} onClick={() => setF({ ...f, leg: k })}>{l}</button>)}</div></div>
      <label className="field"><span>Leaving from (optional)</span><input value={f.leave} onChange={e => setF({ ...f, leave: e.target.value })} placeholder="Church parking lot, 5:30" maxLength={60} /></label>
      <label className="field"><span>Note (optional)</span><input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Room for gear in the back" maxLength={140} /></label>
      <button className="btn" onClick={() => onSave(f)}>Save</button>
    </div>
  );
}
function Ride({ v, people, onSave }) {
  const [who, setWho] = useState(people[0]?.id || '');
  const [leg, setLeg] = useState(v.leg);
  return (
    <div>
      <div className="field"><span>Who's riding</span><div className="el-chips">{people.map(p => <button key={p.id} className={`chip ${who === p.id ? 'on' : ''}`} onClick={() => setWho(p.id)}>{p.name}</button>)}</div></div>
      {v.leg === 'both' && <div className="field"><span>Which way</span><div className="el-chips">{Object.entries(LEG).map(([k, l]) => <button key={k} className={`chip sm ${leg === k ? 'on' : ''}`} onClick={() => setLeg(k)}>{l}</button>)}</div></div>}
      <button className="btn" disabled={!who} onClick={() => onSave({ riderId: who, leg })}>Save my seat</button>
    </div>
  );
}

function Slip({ outing }) {
  const acct = useAccount();
  const d = useApi(`slip/${outing.id}`);
  const [signing, setSigning] = useState(null);
  const [setup, setSetup] = useState(false);
  if (!d.data) return null;
  const { cfg, mine, roster, isLeader, defaultText } = d.data;
  if (!cfg.on && !isLeader) return null;
  const sign = async body => { await api(`slip/${outing.id}/sign`, { method: 'POST', body }); d.refresh(); };
  const undo = async id => { if (confirm('Remove this signature?')) { await api(`slip/${outing.id}/sign/${id}`, { method: 'DELETE' }); d.refresh(); } };
  const signedN = roster?.filter(r => r.signed && !r.notGoing).length || 0;
  return (
    <Section title="Permission slip" action={isLeader && <button className="link-btn small" onClick={() => setSetup(true)}><Icon name="settings" size={15} />{cfg.on ? 'Change' : 'Set up'}</button>}>
      {!cfg.on ? <p className="small muted">This outing doesn't ask for a permission slip. Tap "Set up" to collect signatures from parents in the app.</p> : (
        <>
          {cfg.due && <p className="small"><b>Due {when(`${cfg.due}T12:00:00`)}</b></p>}
          {mine.length > 0 && <ul className="slip-mine">{mine.map(s => (
            <li key={s.id} className={`card ${s.signed ? 'ok' : ''}`}><span className="grow"><b>{s.name}</b><span className="small">{s.signed ? `✓ Signed by ${s.signed.paper ? 'paper form' : s.signed.typed} on ${when(s.signed.at)}` : 'Not signed yet'}</span></span>
              {!s.signed ? <button className="btn small" onClick={() => setSigning(s)}>Sign</button> : <button className="link-btn small" onClick={() => undo(s.id)}>Undo</button>}</li>
          ))}</ul>}
          {acct && !mine.length && !isLeader && <p className="small muted">Parents sign for their own scouts here.</p>}
          {roster && (
            <div className="card slip-roster"><b>{signedN} of {roster.filter(r => !r.notGoing).length} going scouts have a signed slip</b>
              <ul>{roster.map(r => <li key={r.id} className={r.signed ? 'ok' : ''}><span className="grow">{r.signed ? '✅' : '⬜'} {r.name}{r.notGoing && <Pill>not going</Pill>}{r.signed && <span className="small muted"> · {r.signed.paper ? 'paper' : r.signed.typed}</span>}</span>
                {!r.signed ? <button className="link-btn small" onClick={() => sign({ scoutId: r.id, paper: true })}>Paper form in hand</button> : <button className="link-btn small" onClick={() => undo(r.id)}>Undo</button>}</li>)}</ul></div>
          )}
        </>
      )}
      <Sheet open={!!signing} onClose={() => setSigning(null)} title={signing ? `Permission for ${signing.name}` : ''}>{signing && <SignForm text={cfg.text} name={acct?.member?.name || ''} onSign={async b => { await sign({ scoutId: signing.id, ...b }); setSigning(null); }} />}</Sheet>
      <Sheet open={setup} onClose={() => setSetup(false)} title="Permission slip">{setup && <SlipSetup cfg={cfg} def={defaultText} onSave={async b => { await api(`slip/${outing.id}/cfg`, { method: 'PUT', body: b }); setSetup(false); d.refresh(); }} />}</Sheet>
    </Section>
  );
}
function SignForm({ text, name, onSign }) {
  const [agree, setAgree] = useState(false);
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <div>
      <div className="card slip-text"><p className="pre">{text}</p></div>
      <label className="check-row"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>I'm this scout's parent or guardian and I agree.</span></label>
      <label className="field"><span>Type your full name to sign</span><input value={typed} onChange={e => setTyped(e.target.value)} placeholder={name} autoComplete="name" /></label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn" disabled={!agree || typed.trim().length < 3} onClick={async () => { try { await onSign({ agree, typed }); } catch (e) { setMsg(e.message); } }}>Sign</button>
    </div>
  );
}
function SlipSetup({ cfg, def, onSave }) {
  const [f, setF] = useState({ on: cfg.on || !cfg.text, text: cfg.text || def, due: cfg.due || '' });
  return (
    <div>
      <label className="switch-row"><span className="grow"><b>Ask parents to sign for this outing</b></span><input type="checkbox" role="switch" checked={f.on} onChange={e => setF({ ...f, on: e.target.checked })} aria-label="Ask for a permission slip" /></label>
      <label className="field"><span>What parents agree to</span><textarea rows={8} value={f.text} onChange={e => setF({ ...f, text: e.target.value })} /></label>
      <p className="small muted">This is a starting point. Have your committee check it against your council's permission form before you use it.</p>
      <label className="field"><span>Due date (optional)</span><input type="date" value={f.due} onChange={e => setF({ ...f, due: e.target.value })} /></label>
      <button className="btn" onClick={() => onSave(f)}>Save</button>
    </div>
  );
}
