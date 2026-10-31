import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Seg, Pill, BackButton } from '../components/ui.jsx';
import { api, useAccount, useApi, useCol, useLeaderMode, photoUrl } from '../lib/api.js';
import { go } from '../lib/router.js';
import { readLocal, writeLocal } from '../lib/store.js';
import { today } from '../lib/dates.js';
import { dist, liveStats, fmtMiles, fmtFeet, fmtTime, fmtDur, fmtPace } from '../lib/geo.js';
import MapBox, { ElevationChart, MapThumb, Sparkline, HikesOverview } from '../components/HikeMap.jsx';   // Leaflet itself loads only when a map shows
import { LocationCheck, LocationGuide, useGeoPermission } from '../components/LocationHelp.jsx';
const niceDate = d => (d ? new Date(`${d}T12:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: d.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' }) : '');

function SignInFirst({ title = 'Hikes' }) {
  return <div className="content"><PageHead backTo="more" title={title} /><Empty icon="map" title="Sign in with your personal code">Hikes keep distance, time and climbing for each person, so they need your own code. Ask a leader for it.</Empty></div>;
}

// ------------------------------------------------------------------ list
export default function Hikes({ route }) {
  const acct = useAccount();
  const leader = useLeaderMode();
  const id = route.args[0];
  if (id) return <HikeDetail id={id} />;
  if (!acct && !leader) return <SignInFirst />;
  return <HikeList route={route} />;
}

function HikeList({ route }) {
  const acct = useAccount();
  const [tab, setTab] = useState(route.query.tab || 'troop');
  const [logOpen, setLogOpen] = useState(false);
  const list = useApi(tab === 'mine' ? 'hikes?mine=1' : 'hikes');
  const changeTab = t => { setTab(t); go(`hikes${t === 'troop' ? '' : `?tab=${t}`}`); };
  const hikes = list.data?.hikes || [];
  const rec = readLocal('hike-rec', null);
  const [perm] = useGeoPermission();
  const [askLoc, setAskLoc] = useState(false);   // once shown, keep the card (it turns green when fixed)
  useEffect(() => { if (perm === 'prompt' || perm === 'denied') setAskLoc(true); }, [perm]);
  return (
    <div className="content">
      <PageHead backTo="more" title="Hikes" sub="Track hikes like Strava: distance, time and climbing for everyone in your group.">
        {acct && <a className="btn small head-btn" href="#/track"><Icon name="play" size={15} />Record a hike</a>}
      </PageHead>
      {rec && rec.phase && rec.phase !== 'setup' && <a className="alert-card warm" href="#/track"><span className="alert-ico"><Icon name="map" size={22} /></span><span className="grow"><b>A hike is still recording</b><span>{rec.title || 'Hike'} · tap to go back to it</span></span><Icon name="chevronR" /></a>}
      {acct && askLoc && <LocationCheck compact />}
      <Seg value={tab} onChange={changeTab} label="Show" options={[['troop', 'Troop'], ['mine', 'Mine'], ['map', 'Map'], ['board', 'Stats']]} />
      {tab === 'board' ? <Board /> : tab === 'map' ? (
        <div className="mt"><HikesOverview hikes={hikes} onOpen={id => go(`hikes/${id}`)} />
          <p className="small muted mt">Every recorded hike, one color each. Hikes logged by hand have no map.</p></div>
      ) : (
        <>
          {acct && <div className="btn-row tight"><button className="btn small secondary" onClick={() => setLogOpen(true)}><Icon name="edit" size={15} />Log a hike by hand</button></div>}
          {list.loading && !list.data ? <p className="muted mt">Loading…</p> : hikes.length === 0 ? (
            <Empty icon="map" title={tab === 'mine' ? 'No hikes yet' : 'No hikes recorded yet'}>Tap Record at the trailhead. Basecamp tracks your distance, time and climbing, and credits everyone in your group.</Empty>
          ) : <ul className="hike-feed2">{hikes.map(h => <HikeCard key={h.id} h={h} />)}</ul>}
        </>
      )}
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} onSaved={h => { setLogOpen(false); go(`hikes/${h.id}`); }} />
    </div>
  );
}

function HikeCard({ h }) {
  const initials = (h.byName || '?').split(' ').map(x => x[0]).slice(0, 2).join('');
  return (
    <li><a className="hike-card2" href={`#/hikes/${h.id}`}>
      <div className="hc-head">
        <span className="hc-av">{initials}</span>
        <span className="grow"><b>{h.byName}</b><span>{niceDate(h.date)}{h.outingTitle ? ` · ${h.outingTitle}` : ''}</span></span>
        {h.kudos.length > 0 && <span className="hc-kudos">👏 {h.kudos.length}</span>}
      </div>
      <h3 className="hc-title">{h.title}</h3>
      <div className="hc-stats">
        <span><i>Distance</i><b>{fmtMiles(h.distance)} mi</b></span>
        <span><i>Climb</i><b>{fmtFeet(h.gain)} ft</b></span>
        <span><i>Time</i><b>{fmtDur(h.moving)}</b></span>
        {h.spark?.length > 1 && <span className="hc-spark"><i>Elevation</i><Sparkline values={h.spark} /></span>}
      </div>
      {h.preview?.length > 1 ? <MapThumb pts={h.preview} /> : <div className="hc-manual"><Icon name="edit" size={16} />Logged by hand · no map</div>}
      <div className="hc-foot"><Icon name="users" size={15} />{h.groupNames.slice(0, 4).map(n => n.split(' ')[0]).join(', ')}{h.groupNames.length > 4 ? ` +${h.groupNames.length - 4}` : ''}</div>
    </a></li>
  );
}

function Board() {
  const [year, setYear] = useState(today().slice(0, 4));
  const s = useApi(`hikes/stats?year=${year}`);
  const d = s.data;
  const all = useApi('hikes').data?.hikes || [];
  const years = [...new Set([today().slice(0, 4), ...(d?.years || [])])].sort().reverse();
  return (
    <>
      <div className="chip-scroll mt">{years.map(y => <button key={y} className={`chip ${year === y ? 'on' : ''}`} onClick={() => setYear(y)}>{y}</button>)}<button className={`chip ${year === '' ? 'on' : ''}`} onClick={() => setYear('')}>All time</button></div>
      {!d ? <p className="muted">Loading…</p> : (
        <>
          {d.me && (
            <div className="stat-row four mt">
              <div className="stat"><b>{fmtMiles(d.me.distance)}</b><span>miles</span></div>
              <div className="stat"><b>{fmtFeet(d.me.gain)}</b><span>feet climbed</span></div>
              <div className="stat"><b>{d.me.count}</b><span>hikes</span></div>
              <div className="stat"><b>{fmtMiles(d.me.longest)}</b><span>longest (mi)</span></div>
            </div>
          )}
          <MonthChart hikes={all} year={year} />
          <Section title="Top hikers">
            {d.members.length === 0 ? <Empty icon="map" title="No hikes this year yet" /> : (
              <ol className="board">{d.members.slice(0, 25).map((m, i) => <li key={m.id}><span className="board-n">{i + 1}</span><span className="grow"><b>{m.name}</b><span className="small muted">{m.patrol || (m.role === 'scout' ? 'Scout' : 'Adult')} · {m.count} hike{m.count > 1 ? 's' : ''} · {fmtFeet(m.gain)} ft</span></span><b className="board-v">{fmtMiles(m.distance)} mi</b></li>)}</ol>
            )}
          </Section>
          {d.patrols.length > 0 && (
            <Section title="Patrols">
              <ol className="board">{d.patrols.map((p, i) => <li key={p.patrol}><span className="board-n">{i + 1}</span><span className="grow"><b>{p.patrol}</b><span className="small muted">{p.hikers} hiker{p.hikers > 1 ? 's' : ''} · {fmtFeet(p.gain)} ft</span></span><b className="board-v">{fmtMiles(p.distance)} mi</b></li>)}</ol>
            </Section>
          )}
        </>
      )}
    </>
  );
}

// troop miles by month (or by year for "All time")
function MonthChart({ hikes, year }) {
  const byYear = !year;
  const keys = byYear ? [...new Set(hikes.map(h => String(h.date).slice(0, 4)))].sort() : Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const vals = keys.map(k => hikes.filter(h => String(h.date).startsWith(k)).reduce((a, h) => a + (h.distance || 0), 0) / 1609.344);
  const max = Math.max(...vals, 1);
  if (!vals.some(v => v > 0)) return null;
  const nowKey = today().slice(0, 7);
  return (
    <Section title={byYear ? 'Troop miles by year' : `Troop miles in ${year}`}>
      <div className="mchart" role="img" aria-label={`Miles hiked: ${keys.map((k, i) => `${k} ${vals[i].toFixed(1)}`).join(', ')}`}>
        {keys.map((k, i) => (
          <div key={k} className={`mc-col ${k === nowKey ? 'now' : ''}`}>
            <span className="mc-v">{vals[i] ? vals[i].toFixed(vals[i] < 10 ? 1 : 0) : ''}</span>
            <i style={{ height: `${Math.max(vals[i] ? 4 : 0, (vals[i] / max) * 100)}%` }} />
            <span className="mc-k">{byYear ? k : new Date(`${k}-15T12:00`).toLocaleDateString([], { month: 'narrow' })}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// split a recorded track into miles: time and climb for each
function splitsOf(points, offset = 0) {
  if (points.length < 3 || points.every(p => !p[3])) return [];
  const out = []; let cum = offset, mileStart = { cum: offset, t: points[0][3], ele: points[0][2] }, gain = 0, lastEle = points[0][2];
  let next = Math.ceil((offset + 1) / 1609.344) * 1609.344;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if ((a[4] || 0) !== (b[4] || 0)) { mileStart.t += b[3] - a[3]; continue; }   // pause: don't count the gap
    cum += dist(a, b);
    if (b[2] != null && lastEle != null && b[2] > lastEle) gain += b[2] - lastEle;
    if (b[2] != null) lastEle = b[2];
    if (cum >= next || i === points.length - 1) {
      const len = cum - mileStart.cum;
      if (len > 250) out.push({ n: out.length + 1, len, sec: b[3] - mileStart.t, gain, ele: b[2] != null && mileStart.ele != null ? b[2] - mileStart.ele : null, partial: cum < next });
      mileStart = { cum, t: b[3], ele: b[2] }; gain = 0; next += 1609.344;
    }
  }
  return out;
}
function Splits({ points, offset }) {
  const sp = splitsOf(points, offset);
  if (sp.length < 2) return null;
  const paces = sp.map(x => x.sec / (x.len / 1609.344));
  const slow = Math.max(...paces), fast = Math.min(...paces);
  return (
    <Section title="Mile by mile">
      <ul className="splits">{sp.map((x, i) => (
        <li key={x.n}>
          <span className="sp-n">{x.partial ? `${(x.len / 1609.344).toFixed(1)}` : x.n}</span>
          <span className="sp-bar"><i style={{ width: `${40 + 60 * (slow - paces[i]) / Math.max(1, slow - fast)}%` }} className={paces[i] === fast ? 'best' : ''} /><b>{fmtPace(x.len, x.sec)} /mi</b></span>
          <span className={`sp-ele ${x.ele > 0 ? 'up' : x.ele < 0 ? 'down' : ''}`}>{x.ele == null ? '' : `${x.ele > 0 ? '▲' : x.ele < 0 ? '▼' : ''} ${Math.abs(Math.round(x.ele * 3.28084))} ft`}</span>
        </li>
      ))}</ul>
      <p className="tiny muted">The longer the bar, the faster that mile. Arrows show the climb or drop across each mile.</p>
    </Section>
  );
}

// photos shared from the same outing
function HikePhotos({ outingId }) {
  const photos = useApi('photos').data?.photos || [];
  const mine = photos.filter(p => p.album === outingId).slice(0, 9);
  if (!outingId || !mine.length) return null;
  return (
    <Section title="Photos from this outing" action={<a className="link-btn" href={`#/gallery?album=${outingId}`}>See all</a>}>
      <ul className="strip">{mine.map(p => <li key={p.id}><a href={`#/gallery?album=${outingId}&photo=${p.id}`}><img src={photoUrl(p.id, true)} alt={p.caption || 'Hike photo'} loading="lazy" /></a></li>)}</ul>
    </Section>
  );
}

// ------------------------------------------------------------------ detail
function HikeDetail({ id }) {
  const acct = useAccount();
  const leader = useLeaderMode();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [focus, setFocus] = useState(null);
  const load = () => api(`hikes/${id}`).then(setD).catch(setError);
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!acct && !leader) return <SignInFirst title="Hike" />;
  if (error) return <div className="content"><PageHead backTo="hikes" /><Empty icon="alert" title="Can't show this hike">{error.message}</Empty></div>;
  if (!d) return <div className="content"><PageHead backTo="hikes" /><div className="hike-map skeleton" style={{ height: 420 }} /></div>;
  const h = d.hike;
  const mine = acct && h.kudos.includes(acct.member.id);
  async function kudos() { const r = await api(`hikes/${h.id}/kudos`, { method: 'POST', body: {} }); setD({ ...d, hike: { ...h, kudos: r.kudos } }); }
  async function remove() { if (!confirm('Delete this hike for everyone in the group?')) return; await api(`hikes/${h.id}`, { method: 'DELETE' }); go('hikes', { replace: true }); }
  const hasMap = d.points.length > 1;
  const title = (
    <div className="ho-top">
      <p className="ho-date">{niceDate(h.date)}{h.manual ? ' · logged by hand' : ''}</p>
      <h1>{h.title}</h1>
      <p className="ho-by">{h.byName}{h.groupNames.length > 1 ? ` + ${h.groupNames.length - 1}` : ''}{h.outingTitle && <> · <a href={`#/outing/${h.outingId}`}>{h.outingTitle}</a></>}</p>
    </div>
  );
  const stats = (
    <div className="ho-stats">
      <div className="ho-main"><span><b>{fmtMiles(h.distance, 2)}</b><i>mi</i></span><span><b>{fmtFeet(h.gain)}</b><i>ft up</i></span><span><b>{fmtDur(h.moving)}</b><i>moving</i></span></div>
      <div className="ho-sub"><span>{fmtPace(h.distance, h.moving)} /mi</span>{h.maxEle != null && <span>High {fmtFeet(h.maxEle)} ft</span>}{h.loss != null && <span>Down {fmtFeet(h.loss)} ft</span>}{!h.manual && <span>{fmtDur(h.elapsed)} total</span>}</div>
    </div>
  );
  return (
    <div className="content hike-page">
      <PageHead backTo="hikes">{d.canEdit && <button className="btn small secondary head-btn" onClick={() => setEditing(true)}><Icon name="edit" size={15} />Edit</button>}</PageHead>
      {hasMap ? (
        <MapBox points={d.points} offset={d.offset} focus={focus} height={520} tall className="hero-map" overlay={<>{title}{stats}</>} />
      ) : (
        <section className="hike-banner">{title}{stats}</section>
      )}
      {hasMap && h.hideEnds && <p className="small muted map-note"><Icon name="lock" size={13} /> The first and last 200 m are left off the map for privacy. Distance includes them.</p>}
      <ElevationChart profile={d.profile} onFocus={hasMap ? setFocus : undefined} />
      {h.eleSource === 'map' && <p className="tiny muted">Elevation: Copernicus DEM (GLO-90) via Open-Meteo.</p>}
      {h.eleSource === 'gps' && <p className="tiny muted">Elevation from the phone's GPS, which can be off by several feet.</p>}
      {hasMap && <Splits points={d.points} offset={d.offset} />}
      {h.notes && <p className="hike-notes">{h.notes}</p>}
      <HikePhotos outingId={h.outingId} />
      <Section title={`Group · ${h.groupNames.length}`}>
        <div className="chip-wrap">{h.groupNames.map((n, i) => <span key={h.group[i]} className="chip sm">{n}</span>)}</div>
      </Section>
      <div className="btn-row">
        {acct && <button className={`btn ${mine ? '' : 'secondary'}`} onClick={kudos}>👏 {mine ? 'High-fived' : 'High five'}{h.kudos.length ? ` · ${h.kudos.length}` : ''}</button>}
        {d.canEdit && <button className="link-btn danger" onClick={remove}><Icon name="trash" size={16} />Delete hike</button>}
      </div>
      {editing && <EditSheet h={h} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </div>
  );
}

function EditSheet({ h, onClose, onSaved }) {
  const [title, setTitle] = useState(h.title);
  const [notes, setNotes] = useState(h.notes);
  const [group, setGroup] = useState(h.group);
  const [outingId, setOutingId] = useState(h.outingId);
  const [msg, setMsg] = useState('');
  async function save() { try { await api(`hikes/${h.id}`, { method: 'PUT', body: { title, notes, group, outingId } }); onSaved(); } catch (e) { setMsg(e.message); } }
  return (
    <Sheet open onClose={onClose} title="Edit hike">
      <label className="field"><span>Name</span><input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} /></label>
      <OutingPick value={outingId} onChange={setOutingId} />
      <GroupPicker value={group} onChange={setGroup} lock={h.by} />
      <label className="field"><span>Notes</span><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} maxLength={600} /></label>
      {msg && <p className="form-msg">{msg}</p>}
      <div className="sheet-foot"><button className="btn big" onClick={save}>Save</button></div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ pickers
function OutingPick({ value, onChange }) {
  const outings = useCol('outings');
  const t = today();
  const near = outings.items.filter(o => !o.cancelled && (o.end || o.start) >= addDays(t, -45) && o.start <= addDays(t, 30))
    .sort((a, b) => Math.abs(Date.parse(a.start) - Date.parse(t)) - Math.abs(Date.parse(b.start) - Date.parse(t)));
  return (
    <label className="field"><span>Outing <em className="opt">optional</em></span>
      <select value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">Not part of a troop outing</option>
        {near.map(o => <option key={o.id} value={o.id}>{o.title} · {o.start}</option>)}
      </select>
    </label>
  );
}
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };

export function GroupPicker({ value, onChange, lock }) {
  const acct = useAccount();
  const members = useApi('members');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const all = members.data?.members || [];
  const byId = new Map(all.map(m => [m.id, m]));
  const sel = new Set(value);
  const toggle = id => { if (id === lock) return; const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); onChange([...n]); };
  const ql = q.trim().toLowerCase();
  const shown = all.filter(m => !ql || m.name.toLowerCase().includes(ql) || (m.patrol || '').toLowerCase().includes(ql));
  const me = acct?.member;
  const addMany = ids => onChange([...new Set([...value, ...ids])]);
  return (
    <div className="field">
      <span className="field-label">Who's hiking? <em className="opt">everyone here gets credit for the miles</em></span>
      <div className="chip-wrap">
        {value.map(id => <button type="button" key={id} className="chip sm on" onClick={() => toggle(id)} aria-label={`Remove ${byId.get(id)?.name || 'person'}`}>{byId.get(id)?.name || 'Me'}{id !== lock && <Icon name="x" size={13} />}</button>)}
        <button type="button" className="chip sm" onClick={() => setOpen(true)}><Icon name="plus" size={14} />Add people</button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Who's hiking?">
        <div className="btn-row tight">
          {me?.patrol && <button className="chip sm" onClick={() => addMany(all.filter(m => m.patrol === me.patrol).map(m => m.id))}>My patrol ({me.patrol})</button>}
          {acct?.scouts?.length > 0 && <button className="chip sm" onClick={() => addMany(acct.scouts.map(s => s.id))}>My scouts</button>}
        </div>
        <div className="search-row mt"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search names or patrols" aria-label="Search people" /></div>
        {members.loading && !members.data ? <p className="muted">Loading…</p> : (
          <ul className="pick-list">{shown.map(m => (
            <li key={m.id}><label className="check"><input type="checkbox" checked={sel.has(m.id)} disabled={m.id === lock} onChange={() => toggle(m.id)} /><span className="grow">{m.name}<span className="small muted"> · {m.patrol || (m.role === 'scout' ? 'Scout' : 'Adult')}</span></span></label></li>
          ))}</ul>
        )}
        <div className="sheet-foot"><button className="btn big" onClick={() => setOpen(false)}>Done · {value.length} hiking</button></div>
      </Sheet>
    </div>
  );
}

// ------------------------------------------------------------------ log by hand
function LogSheet({ open, onClose, onSaved }) {
  const acct = useAccount();
  const [f, setF] = useState({ title: '', date: today(), miles: '', gainFt: '', hours: '', mins: '', outingId: '', notes: '' });
  const [group, setGroup] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && acct) setGroup(g => (g.length ? g : [acct.member.id])); }, [open, acct]);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true); setMsg('');
    try {
      const r = await api('hikes', { method: 'POST', body: { manual: true, title: f.title, date: f.date, miles: Number(f.miles), gainFt: Number(f.gainFt) || 0, minutes: (Number(f.hours) || 0) * 60 + (Number(f.mins) || 0), outingId: f.outingId, notes: f.notes, group } });
      onSaved(r.hike);
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Log a hike">
      <label className="field"><span>Name</span><input value={f.title} onChange={set('title')} placeholder="e.g. Leon Sinks loop" maxLength={80} /></label>
      <div className="two-col">
        <label className="field"><span>Date</span><input type="date" value={f.date} max={today()} onChange={set('date')} /></label>
        <label className="field"><span>Miles</span><input type="number" inputMode="decimal" min="0" step="0.1" value={f.miles} onChange={set('miles')} placeholder="5.2" /></label>
        <label className="field"><span>Feet climbed <em className="opt">optional</em></span><input type="number" inputMode="numeric" min="0" value={f.gainFt} onChange={set('gainFt')} placeholder="300" /></label>
        <label className="field"><span>Time <em className="opt">hours · minutes</em></span><span className="row-input"><input type="number" inputMode="numeric" min="0" value={f.hours} onChange={set('hours')} placeholder="2" aria-label="Hours" /><input type="number" inputMode="numeric" min="0" max="59" value={f.mins} onChange={set('mins')} placeholder="30" aria-label="Minutes" /></span></label>
      </div>
      <OutingPick value={f.outingId} onChange={v => setF({ ...f, outingId: v })} />
      {acct && <GroupPicker value={group} onChange={setGroup} lock={acct.member.id} />}
      <label className="field"><span>Notes <em className="opt">optional</em></span><textarea rows={2} value={f.notes} onChange={set('notes')} maxLength={600} /></label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="sheet-foot"><button className="btn big" disabled={busy || !f.miles} onClick={save}>{busy ? 'Saving…' : 'Save hike'}</button></div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ recorder
// Phases: setup → rec ⇄ paused → done. Everything is kept on the phone as it
// goes, so closing or reloading the app doesn't lose the hike.
const blank = () => ({ phase: 'setup', title: '', outingId: '', group: [], hideEnds: true, notes: '', startAt: 0, pts: [], seg: 0 });

export function Track({ route }) {
  const acct = useAccount();
  const [s, setS] = useState(() => readLocal('hike-rec', null) || blank());
  const [fix, setFix] = useState(null);          // latest GPS reading
  const [gpsErr, setGpsErr] = useState('');
  const [gpsCode, setGpsCode] = useState(0);
  const [watchKey, setWatchKey] = useState(0);
  const [guide, setGuide] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [lockOn, setLockOn] = useState(false);
  const outings = useCol('outings');
  const sRef = useRef(s); sRef.current = s;
  const save = next => { setS(next); writeLocal('hike-rec', next); };
  const update = fn => { const next = fn(sRef.current); sRef.current = next; save(next); };

  // first visit: name it after the outing in the link, or today's hike/campout
  useEffect(() => {
    if (s.phase !== 'setup' || s.title || !outings.data) return;
    const t = today();
    const o = outings.items.find(x => x.id === route.query.outing) || outings.items.find(x => !x.cancelled && x.start <= t && (x.end || x.start) >= t && ['hike', 'campout', 'camp', 'paddle', 'trip'].includes(x.type));
    save({ ...s, title: o?.title || '', outingId: o?.id || '', group: s.group.length ? s.group : acct ? [acct.member.id] : [] });
  }, [outings.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (acct && !s.group.length) save({ ...s, group: [acct.member.id] }); }, [acct]); // eslint-disable-line react-hooks/exhaustive-deps

  // GPS: on the whole time this screen is open (setup shows signal strength)
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGpsErr('This browser can\'t share location.'); return undefined; }
    const id = navigator.geolocation.watchPosition(p => {
      setGpsErr(''); setGpsCode(0);
      const c = p.coords, f = { lat: c.latitude, lng: c.longitude, acc: c.accuracy, alt: c.altitude, at: p.timestamp || Date.now() };
      setFix(f);
      const cur = sRef.current;
      if (cur.phase !== 'rec' || f.acc > 40) return;
      const t = Math.max(0, Math.round((f.at - cur.startAt) / 1000));
      const last = cur.pts[cur.pts.length - 1];
      if (last && (last[4] || 0) === cur.seg) {
        const d = dist(last, [f.lat, f.lng]);
        if (d < Math.max(4, f.acc * 0.4) && t - last[3] < 30) return;          // not moved enough yet
      }
      update(x => ({ ...x, pts: [...x.pts, [+f.lat.toFixed(6), +f.lng.toFixed(6), f.alt == null ? null : +f.alt.toFixed(1), t, x.seg]] }));
    }, e => { setGpsCode(e.code); setGpsErr(e.code === 1 ? 'Location is blocked for Basecamp.' : e.code === 2 ? 'Your phone\'s location is off.' : 'Looking for GPS… step outside or away from buildings.'); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [watchKey]);

  // keep the screen on while recording (tracking pauses when the screen locks)
  useEffect(() => {
    let lock = null, gone = false;
    const get = async () => { try { if (sRef.current.phase === 'rec' && 'wakeLock' in navigator && document.visibilityState === 'visible') { lock = await navigator.wakeLock.request('screen'); if (gone) lock.release(); setLockOn(true); lock.addEventListener?.('release', () => setLockOn(false)); } } catch { setLockOn(false); } };
    get();
    const vis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); lock?.release?.(); };
  }, [s.phase]);
  useEffect(() => { if (s.phase !== 'rec') return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [s.phase]);

  const stats = useMemo(() => liveStats(s.pts), [s.pts]);
  if (!acct) return <SignInFirst title="Record a hike" />;

  const start = () => update(x => ({ ...x, phase: 'rec', startAt: Date.now(), pts: fix && fix.acc <= 40 ? [[+fix.lat.toFixed(6), +fix.lng.toFixed(6), fix.alt == null ? null : +fix.alt.toFixed(1), 0, 0]] : [], seg: 0 }));
  const pause = () => update(x => ({ ...x, phase: 'paused' }));
  const resume = () => update(x => ({ ...x, phase: 'rec', seg: x.seg + 1 }));
  const finish = () => update(x => ({ ...x, phase: 'done' }));
  const discard = () => { if (confirm('Throw away this hike? This can\'t be undone.')) { writeLocal('hike-rec', null); go('hikes', { replace: true }); } };
  async function upload() {
    setBusy(true); setMsg('');
    try {
      const r = await api('hikes', { method: 'POST', body: { points: s.pts, title: s.title, outingId: s.outingId, group: s.group, hideEnds: s.hideEnds, notes: s.notes, startAt: s.startAt } });
      writeLocal('hike-rec', null); go(`hikes/${r.hike.id}`, { replace: true });
    } catch (e) { setMsg(e.offline ? 'No signal right now. Your hike is saved on this phone — try again when you have service.' : e.message); } finally { setBusy(false); }
  }
  const signal = !fix ? { t: 'Finding GPS…', c: 'weak' } : fix.acc <= 15 ? { t: `GPS strong · ±${Math.round(fix.acc * 3.28)} ft`, c: 'good' } : fix.acc <= 40 ? { t: `GPS OK · ±${Math.round(fix.acc * 3.28)} ft`, c: 'ok' } : { t: `GPS weak · ±${Math.round(fix.acc * 3.28)} ft`, c: 'weak' };
  const elapsed = s.phase === 'rec' ? (now - s.startAt) / 1000 : stats.elapsed;
  const here = fix ? [fix.lat, fix.lng] : null;
  const livePts = s.phase === 'setup' ? [] : s.pts;

  return (
    <div className="track">
      <header className="track-top">
        <BackButton to="hikes" className="icon-btn on-dark" dark />
        <b className="grow">{s.phase === 'setup' ? 'Record a hike' : s.title || 'Hike'}</b>
        <span className={`gps-pill ${signal.c}`}>{signal.t}</span>
      </header>

      {s.phase === 'setup' && (
        <div className="track-body">
          <MapBox points={[]} here={here} height={240} live />
          <div className="card">
            <label className="field"><span>Name</span><input value={s.title} onChange={e => save({ ...s, title: e.target.value })} placeholder="e.g. Leon Sinks loop" maxLength={80} /></label>
            <OutingPick value={s.outingId} onChange={v => save({ ...s, outingId: v, title: s.title || outings.items.find(o => o.id === v)?.title || '' })} />
            <GroupPicker value={s.group} onChange={g => save({ ...s, group: g })} lock={acct.member.id} />
            <label className="check"><input type="checkbox" checked={s.hideEnds} onChange={e => save({ ...s, hideEnds: e.target.checked })} /><span>Hide the start and finish on the map <span className="small muted">(first and last 200 m, so a hike from home doesn't show your house)</span></span></label>
          </div>
          {(gpsCode === 1 || gpsCode === 2 || !fix) && <LocationCheck onReady={() => setWatchKey(k => k + 1)} />}
          <div className="tip-box"><Icon name="info" size={18} /><span>Keep Basecamp open while you hike. The screen stays on, and tracking pauses if the phone locks. One person can record for the whole group.</span></div>
          <button className="btn accent big" disabled={!fix || fix.acc > 60} onClick={start}><Icon name="play" size={20} />{gpsCode === 1 ? 'Turn on location first' : !fix ? 'Waiting for GPS…' : 'Start'}</button>
        </div>
      )}

      {(s.phase === 'rec' || s.phase === 'paused') && (
        <div className="track-live">
          <MapBox points={livePts} here={here} height="100%" live className="live-map" overlay={
            <div className={`live-panel ${s.phase}`}>
              {s.phase === 'paused' && <p className="paused-note"><Icon name="pause" size={15} /> Paused · distance isn't counted until you resume</p>}
              {gpsErr && <p className="live-err" role="alert">{gpsErr} {(gpsCode === 1 || gpsCode === 2) && <button type="button" className="fix-btn" onClick={() => setGuide(true)}>Fix it</button>}</p>}
              <div className="lp-big"><b>{fmtMiles(stats.distance, 2)}</b><i>miles</i></div>
              <div className="lp-row">
                <span><b>{fmtTime(elapsed)}</b><i>time</i></span>
                <span><b>{fmtFeet(stats.gain)}</b><i>ft up</i></span>
                <span><b>{fmtPace(stats.distance, stats.moving)}</b><i>/ mile</i></span>
                <span><b>{stats.ele == null ? '–' : fmtFeet(stats.ele)}</b><i>elev ft</i></span>
              </div>
              <div className="track-btns">
                {s.phase === 'rec' ? <button className="btn ghost big" onClick={pause}><Icon name="pause" size={20} />Pause</button> : <button className="btn big" onClick={resume}><Icon name="play" size={20} />Resume</button>}
                <button className="btn accent big" onClick={finish}><Icon name="check" size={20} />Finish</button>
              </div>
              <p className="lp-foot">{s.group.length} hiking{lockOn ? ' · screen stays on' : ' · keep Basecamp open'}</p>
            </div>
          } />
        </div>
      )}

      <LocationGuide open={guide} problem={gpsCode === 2 ? 'off' : 'blocked'} onClose={() => setGuide(false)} onFixed={() => setWatchKey(k => k + 1)} />
      {s.phase === 'done' && (
        <div className="track-body">
          <div className="hike-stats">
            <div><b>{fmtMiles(stats.distance, 2)}</b><span>miles</span></div>
            <div><b>{fmtFeet(stats.gain)}</b><span>ft climbed (GPS)</span></div>
            <div><b>{fmtDur(stats.moving)}</b><span>moving time</span></div>
            <div><b>{fmtPace(stats.distance, stats.moving)}</b><span>min / mile</span></div>
          </div>
          {s.pts.length > 1 && <MapBox points={s.pts} height={260} />}
          <div className="card">
            <label className="field"><span>Name</span><input value={s.title} onChange={e => save({ ...s, title: e.target.value })} maxLength={80} /></label>
            <OutingPick value={s.outingId} onChange={v => save({ ...s, outingId: v })} />
            <GroupPicker value={s.group} onChange={g => save({ ...s, group: g })} lock={acct.member.id} />
            <label className="field"><span>Notes <em className="opt">optional</em></span><textarea rows={2} value={s.notes} onChange={e => save({ ...s, notes: e.target.value })} maxLength={600} placeholder="Trail conditions, wildlife, who carried the first-aid kit…" /></label>
          </div>
          <p className="small muted">When you save, Basecamp checks the climbing against map elevation data, which is usually more accurate than the phone.</p>
          {msg && <p className="form-msg" role="alert">{msg}</p>}
          <div className="track-btns">
            <button className="btn secondary big" onClick={() => update(x => ({ ...x, phase: 'paused' }))}>Keep going</button>
            <button className="btn big" disabled={busy || s.pts.length < 2} onClick={upload}>{busy ? 'Saving…' : 'Save hike'}</button>
          </div>
          <button className="link-btn danger center-btn" onClick={discard}><Icon name="trash" size={16} />Discard</button>
          {s.pts.length < 2 && <p className="small muted center">Not enough GPS points were recorded to save a track. You can log this hike by hand from the Hikes page instead.</p>}
        </div>
      )}
    </div>
  );
}
