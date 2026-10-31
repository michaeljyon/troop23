import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Section, Empty, Seg, Pill } from '../components/ui.jsx';
import { api, sessionToken, leaderPass, clearApiCache } from '../lib/api.js';
import { parseCSV, kindOf, KIND_LABEL, buildTwh, advancementRows, rosterRows } from '../lib/syncFiles.js';
import { troop } from '../lib/config.js';

// Sync center (Leader tools → Sync). Scoutbook Plus, TroopWebHost and Black Pug don't offer
// connections for other apps, so records move as the files each one already exports.
// Files are read on this device; only names, patrols, positions and advancement are sent.

const ago = t => { if (!t) return 'never'; const d = Math.floor((Date.now() - t) / 86400000); return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
const freshness = t => (!t ? 'none' : Date.now() - t < 31 * 86400000 ? 'good' : Date.now() - t < 92 * 86400000 ? 'warn' : 'old');
const SOURCES = [
  ['twh', 'TroopWebHost', 'Roster, advancement, outings, gear'],
  ['scoutbook', 'Scoutbook advancement', 'Compared with TroopWebHost'],
  ['scoutbook-roster', 'Scoutbook roster', 'Who is registered'],
  ['camp', 'Summer camp (Black Pug)', 'Camp merit badges and partials'],
];

const STEPS = {
  advancement: [
    ['Send new awards to Scoutbook', 'TroopWebHost: Advancement → Recognize Recent Achievements → Export to Scoutbook Plus. Upload that file in Scoutbook Plus (Internet Advancement). Up to 500 items per file.', null],
    ['Check Scoutbook and TroopWebHost agree', 'Scoutbook Plus: Reports → Quick Export → Advancement → Export. Drop that file below to see anything that is in one system but not the other. Then upload the same file in TroopWebHost: Advancement → Upload Advancement → Upload ScoutBook Advancement.', 'drop'],
    ['After summer camp', 'Black Pug (Scouting Event): Reports → "Scoutbook Export". Import it in Scoutbook (Scoutbook Legacy → Administration → Import Merit Badge Advancements), and drop it below so scouts see their camp results in Basecamp.', 'drop'],
  ],
  chair: [
    ['Keep the roster matched', 'After recharter or new members: Scoutbook Plus roster report → TroopWebHost: Membership → Upload Members → Upload ScoutbookPlus Roster Report. Drop the same roster report below to see who is missing from Basecamp or not registered.', 'drop'],
    ['After troop elections', 'Update positions in Basecamp with one tap (below), then enter the new positions in Scoutbook and TroopWebHost using the election results download.', 'positions'],
    ['Clean up people who left', 'When you bring in TroopWebHost files, Basecamp lists anyone no longer on the TroopWebHost roster so you can switch them off.', null],
  ],
  webmaster: [
    ['Bring TroopWebHost into Basecamp', 'In TroopWebHost, export these to Excel/CSV and drop them below together: Active Roster, Events, Event Participation, Rank Advancement History, Merit Badge History, Merit Badges In Progress, Rank Requirements Earned, Inventory Items, Checked Out Items, E-Mail Groups, Event Locations, User Permissions, Leadership Positions. About once a month.', 'drop'],
    ['Calendar', 'Families subscribe once from Outings → Troop calendar. The same link works in Apple Calendar, Google Calendar and Outlook, and updates on its own.', 'calendar'],
    ['Hikes recorded only in Basecamp', 'Download the activity log (below) and enter hiking miles in TroopWebHost and Scoutbook.', 'activity'],
  ],
  scoutmaster: [
    ['See how fresh everything is', 'The status board below shows when each system was last brought in, and by whom.', null],
    ['Review differences', 'When the Advancement Chair compares Scoutbook with TroopWebHost, the list below shows what needs fixing before a Court of Honor.', null],
    ['Scouts ready for a conference', 'Advancement → Troop planning shows who has finished their next rank\'s merit badges and time.', 'planning'],
  ],
};
const ROLE_ORDER = ['advancement', 'chair', 'webmaster', 'scoutmaster'];

export default function SyncCenter({ pass }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [role, setRole] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [advSource, setAdvSource] = useState('scoutbook');
  const [campNote, setCampNote] = useState('');
  const [result, setResult] = useState(null);
  const [drop, setDrop] = useState(false);
  const input = useRef(null);
  const load = () => api('sync', { leader: pass }).then(x => { setD(x); setError(''); setRole(r => r || x.mine[0] || 'advancement'); }).catch(e => setError(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <Empty icon="alert" title="Can't open the Sync center">{error}</Empty>;
  if (!d) return <p className="muted">Loading…</p>;
  const auth = sessionToken() ? `s=${encodeURIComponent(sessionToken())}` : `lk=${encodeURIComponent(pass || leaderPass())}`;

  async function pick(list) {
    setMsg(null); setResult(null);
    const out = [];
    for (const f of [...list].slice(0, 30)) {
      if (!/\.(csv|txt)$/i.test(f.name)) { out.push({ name: f.name, kind: 'unknown', rows: [], note: 'Save it as CSV first' }); continue; }
      const rows = parseCSV(await f.text());
      out.push({ name: f.name, kind: kindOf(f.name, rows), rows });
    }
    setFiles(out.map(f => (f.kind === 'blocked' ? { ...f, rows: [] } : f)));   // never keep password files in memory
    if (out.some(f => f.kind === 'sb-advancement')) {
      const camp = out.some(f => /black ?pug|scoutingevent|camp/i.test(f.name));
      setAdvSource(camp ? 'camp' : 'scoutbook');
    }
  }
  const has = k => files.some(f => f.kind === k);
  const twhFiles = files.filter(f => f.kind.startsWith('twh-'));
  async function run(kind) {
    setBusy(kind); setMsg(null); setResult(null);
    try {
      if (kind === 'twh') {
        const { payload } = await buildTwh(twhFiles);
        const r = await api('sync/twh', { method: 'POST', body: { ...payload, files: twhFiles.map(f => KIND_LABEL[f.kind]) }, leader: pass });
        setResult({ kind, ...r }); clearApiCache();
      } else if (kind === 'adv') {
        const rows = files.filter(f => f.kind === 'sb-advancement').flatMap(f => advancementRows(f.rows)).map(({ first, last, type, name, version, completed, approved, awarded }) => ({ first, last, type, name, version, completed, approved, awarded }));
        const r = await api(`sync/${advSource}`, { method: 'POST', body: { rows, note: campNote }, leader: pass });
        setResult({ kind: advSource, ...r });
      } else if (kind === 'roster') {
        const rows = files.filter(f => f.kind === 'sb-roster').flatMap(f => rosterRows(f.rows)).map(({ first, last, patrol, position, youth }) => ({ first, last, patrol, position, youth }));
        const r = await api('sync/roster', { method: 'POST', body: { rows }, leader: pass });
        setResult({ kind, ...r });
      }
      setFiles([]); load();
    } catch (e) { setMsg({ bad: true, text: e.message }); } finally { setBusy(''); }
  }

  if (!d.can) return (
    <div className="sync">
      <Empty icon="lock" title="Sync is for the Scoutmaster, Committee Chair, Advancement Chair and Webmaster">
        Leaders can change who runs syncs in Settings → Sync center. Right now: {d.allowed.map(r => d.roles[r] || 'any leader').join(', ')}.
      </Empty>
      <StatusBoard status={d.status} />
    </div>
  );

  return (
    <div className="sync">
      <div className="sync-intro card">
        <b>Keep Scoutbook, TroopWebHost and Basecamp in step</b>
        <p className="small muted">Scoutbook Plus, TroopWebHost and Black Pug don't let other apps connect to them, so records move as the files each one already exports. Files you drop here are read on this device; only names, patrols, positions and advancement are sent. BSA IDs, contact details, birthdays, medical and money never leave your device.</p>
        <details className="sync-how"><summary>Which system is in charge of what?</summary>
          <table className="sync-table"><tbody>
            <tr><th>Official advancement</th><td>Scoutbook Plus (it's what the council uses)</td></tr>
            <tr><th>Day-to-day troop records</th><td>TroopWebHost: roster, events, attendance, gear, positions</td></tr>
            <tr><th>Summer camp</th><td>Black Pug (Scouting Event) → Scoutbook → TroopWebHost</td></tr>
            <tr><th>Communication and activity</th><td>Basecamp: chat, sign-ups, photos, hikes, inspections, elections, notes</td></tr>
          </tbody></table>
          <p className="small muted">Basecamp reads from the other two, so a change made in Scoutbook or TroopWebHost shows up here after the next sync. Things Basecamp records first (hikes, elections) go out as downloads.</p>
        </details>
      </div>

      <StatusBoard status={d.status} />

      <Section title="Your checklist">
        <div className="chip-scroll" role="tablist" aria-label="Role">{ROLE_ORDER.map(k => <button key={k} role="tab" aria-selected={role === k} className={`chip ${role === k ? 'on' : ''}`} onClick={() => setRole(k)}>{d.roles[k]}{d.mine.includes(k) ? ' · you' : ''}</button>)}</div>
        <p className="small muted mt">{d.holders[role]?.length ? `In Basecamp: ${d.holders[role].join(', ')}` : `Nobody in Basecamp has the ${d.roles[role]} position yet.`}</p>
        <ol className="sync-steps">{STEPS[role].map(([t, how, act], i) => (
          <li key={t}><span className="sync-n">{i + 1}</span><span className="grow"><b>{t}</b><span className="small muted">{how}</span>
            {act === 'drop' && <button className="link-btn small" onClick={() => input.current?.click()}><Icon name="arrowIn" size={15} />Choose files</button>}
            {act === 'positions' && <a className="link-btn small" href="#sync-out">Update positions <Icon name="chevronR" size={14} /></a>}
            {act === 'calendar' && <a className="link-btn small" href="#/outings?view=calendar">Open the troop calendar <Icon name="chevronR" size={14} /></a>}
            {act === 'activity' && <a className="link-btn small" href={`/api/leader/export/activity?${auth}`} download>Download activity log <Icon name="download" size={14} /></a>}
            {act === 'planning' && <a className="link-btn small" href="#/advancement">Troop planning <Icon name="chevronR" size={14} /></a>}
          </span></li>
        ))}</ol>
      </Section>

      <Section title="Bring files in">
        <label className={`sync-drop ${drop ? 'over' : ''}`} onDragOver={e => { e.preventDefault(); setDrop(true); }} onDragLeave={() => setDrop(false)} onDrop={e => { e.preventDefault(); setDrop(false); pick(e.dataTransfer.files); }}>
          <Icon name="arrowIn" size={26} />
          <b>Drop CSV files here, or tap to choose</b>
          <span className="small muted">TroopWebHost exports (several at once is fine), a Scoutbook Plus advancement or roster export, or Black Pug's Scoutbook Export</span>
          <input ref={input} type="file" accept=".csv,.CSV,text/csv" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
        </label>
        {files.length > 0 && (
          <div className="card sync-files">
            <ul>{files.map(f => <li key={f.name} className={`k-${f.kind}`}><Icon name={f.kind === 'unknown' || f.kind === 'blocked' ? 'x' : 'check'} size={16} /><span className="grow"><b>{KIND_LABEL[f.kind]}</b><span className="small muted">{f.name}{f.rows.length ? ` · ${f.rows.length} rows` : ''}{f.note ? ` · ${f.note}` : ''}</span></span></li>)}</ul>
            {twhFiles.length > 0 && (
              <div className="sync-act">
                <p className="small">{has('twh-roster') ? 'Updates people, patrols and positions, advancement, attendance, gear, chat groups, outings, counselors and places. Outings you edited in Basecamp are left as they are.' : 'Add the Active Roster export too, so Basecamp can match everything to the right people.'}</p>
                <button className="btn accent" disabled={!!busy || !has('twh-roster')} onClick={() => run('twh')}>{busy === 'twh' ? 'Updating…' : 'Update Basecamp from TroopWebHost'}</button>
              </div>
            )}
            {has('sb-advancement') && (
              <div className="sync-act">
                <Seg label="Where is this advancement file from?" value={advSource} onChange={setAdvSource} options={[['scoutbook', 'Scoutbook Plus'], ['camp', 'Summer camp (Black Pug)']]} />
                {advSource === 'camp' && <label className="field mt"><span>Camp and week</span><input value={campNote} onChange={e => setCampNote(e.target.value)} placeholder="e.g. Wallwood, week 2" /></label>}
                <p className="small">{advSource === 'scoutbook' ? 'Compares Scoutbook with TroopWebHost and lists anything in one but not the other. Nothing is changed.' : 'Shows each scout what they finished or started at camp. Still import the same file in Scoutbook to make it official.'}</p>
                <button className="btn accent" disabled={!!busy} onClick={() => run('adv')}>{busy === 'adv' ? 'Reading…' : advSource === 'scoutbook' ? 'Compare with TroopWebHost' : 'Save camp results'}</button>
              </div>
            )}
            {has('sb-roster') && (
              <div className="sync-act">
                <p className="small">Checks who is registered in Scoutbook against Basecamp, and patrol differences. Nothing is changed.</p>
                <button className="btn accent" disabled={!!busy} onClick={() => run('roster')}>{busy === 'roster' ? 'Checking…' : 'Check the roster'}</button>
              </div>
            )}
            <button className="link-btn small" onClick={() => setFiles([])}>Clear files</button>
          </div>
        )}
        {msg && <p className={`form-msg ${msg.bad ? '' : 'good'}`}>{msg.text}</p>}
        {result?.kind === 'twh' && <TwhResult r={result} pass={pass} onDone={load} />}
      </Section>

      {d.compare && <CompareResult key={d.compare.at} c={d.compare} fresh={result?.kind === "scoutbook"} />}
      {d.roster && <RosterResult r={d.roster} fresh={result?.kind === 'roster'} />}
      {d.camp?.length > 0 && <CampResults camp={d.camp} />}

      <Section title="Send records out">
        <div id="sync-out" />
        <ul className="more-list">
          <li><a href={`/api/leader/export/activity?${auth}`} download><span className="more-ico"><Icon name="map" size={22} /></span><span className="grow"><b>Activity log</b><span>Outings each scout went on and hikes recorded in Basecamp, with camping nights and hiking miles, to enter in Scoutbook or TroopWebHost</span></span><Icon name="download" size={18} /></a></li>
          <li><a href={`/api/leader/export/winners?${auth}`} download><span className="more-ico"><Icon name="users" size={22} /></span><span className="grow"><b>Election results</b><span>Who was elected to each position, to enter in Scoutbook and TroopWebHost</span></span><Icon name="download" size={18} /></a></li>
          <li><a href={`/api/leader/export/members?${auth}`} download><span className="more-ico"><Icon name="people" size={22} /></span><span className="grow"><b>Basecamp roster</b><span>Names, patrols and positions as Basecamp has them</span></span><Icon name="download" size={18} /></a></li>
        </ul>
        <Positions pass={pass} onDone={load} />
      </Section>

      {d.log.length > 0 && (
        <Section title="Sync history">
          <ul className="sync-log">{d.log.map((l, i) => <li key={i}><span className="small muted">{new Date(l.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span><span className="grow"><b>{(SOURCES.find(s => s[0] === l.source) || [0, l.source === 'positions' ? 'Positions' : l.source === 'roster-cleanup' ? 'Roster cleanup' : l.source])[1]}</b> · {l.summary}<span className="small muted"> · {l.by}</span></span></li>)}</ul>
        </Section>
      )}
    </div>
  );
}

function StatusBoard({ status }) {
  return (
    <div className="sync-status">{SOURCES.map(([k, l, sub]) => {
      const s = status?.[k];
      return <div key={k} className={`ss f-${freshness(s?.at)}`}><b>{l}</b><span className="ss-when">{s ? `Synced ${ago(s.at)}` : 'Not synced yet'}</span><span className="small muted">{s ? `${s.by}` : sub}</span></div>;
    })}</div>
  );
}

function TwhResult({ r, pass, onDone }) {
  const [sel, setSel] = useState(() => new Set());
  const [done, setDone] = useState(0);
  return (
    <div className="card sync-result">
      <p className="good-text"><Icon name="check" size={16} /> {r.summary}</p>
      {r.missing?.length > 0 && !done && (
        <>
          <p className="small"><b>{r.missing.length} people are in Basecamp but not on the TroopWebHost roster.</b> Tick anyone who has left the troop. They'll stop showing up and can't sign in; nothing they shared is deleted.</p>
          <ul className="pick-list">{r.missing.map(m => <li key={m.id}><label className="check"><input type="checkbox" checked={sel.has(m.id)} onChange={e => { const n = new Set(sel); if (e.target.checked) n.add(m.id); else n.delete(m.id); setSel(n); }} /><span>{m.name} <span className="small muted">· {m.role}</span></span></label></li>)}</ul>
          <button className="btn small secondary" disabled={!sel.size} onClick={async () => { const x = await api('sync/deactivate', { method: 'POST', body: { ids: [...sel] }, leader: pass }); setDone(x.deactivated); onDone(); }}>Mark {sel.size || ''} as no longer in the troop</button>
        </>
      )}
      {done > 0 && <p className="small">{done} people marked as no longer in the troop.</p>}
    </div>
  );
}

function CompareResult({ c, fresh }) {
  const [open, setOpen] = useState(fresh);
  const onlySb = c.diff.reduce((t, x) => t + x.onlyScoutbook.length, 0), onlyTw = c.diff.reduce((t, x) => t + x.onlyTwh.length, 0), na = c.diff.reduce((t, x) => t + x.notAwarded.length, 0);
  return (
    <Section title="Scoutbook vs TroopWebHost">
      <details className="set-group" open={open} onToggle={e => setOpen(e.target.open)}>
        <summary><Icon name="list" size={18} /><span className="grow"><b>{c.diff.length ? `${c.diff.length} scouts have differences` : 'Everything matches'}</b><span>{c.scouts} scouts compared {ago(c.at)} by {c.by}</span></span></summary>
        <div className="card">
          <div className="sync-sum"><span><b>{onlySb}</b>only in Scoutbook<i>Upload Scoutbook's file in TroopWebHost</i></span><span><b>{onlyTw}</b>only in TroopWebHost<i>Use TroopWebHost's Export to Scoutbook Plus</i></span><span><b>{na}</b>done but not awarded<i>Present at the next Court of Honor</i></span></div>
          {c.diff.length > 0 && <ul className="sync-diff">{c.diff.map(x => (
            <li key={x.id}><b>{x.name}</b>
              {x.onlyScoutbook.length > 0 && <span><Pill tone="warn">Only Scoutbook</Pill> {x.onlyScoutbook.join(', ')}</span>}
              {x.onlyTwh.length > 0 && <span><Pill tone="neutral">Only TroopWebHost</Pill> {x.onlyTwh.join(', ')}</span>}
              {x.notAwarded.length > 0 && <span><Pill tone="good">Not awarded yet</Pill> {x.notAwarded.join(', ')}</span>}
            </li>
          ))}</ul>}
          {c.unmatched?.length > 0 && <p className="small muted">Names in the Scoutbook file that don't match anyone in Basecamp: {c.unmatched.join(', ')}.</p>}
        </div>
      </details>
    </Section>
  );
}

function RosterResult({ r, fresh }) {
  return (
    <Section title="Scoutbook roster vs Basecamp">
      <details className="set-group" open={fresh}>
        <summary><Icon name="people" size={18} /><span className="grow"><b>{r.notInBasecamp.length + r.notRegistered.length + r.diffs.length ? 'Some differences to check' : 'The roster matches'}</b><span>Checked {ago(r.at)} by {r.by}</span></span></summary>
        <div className="card">
          {r.notInBasecamp.length > 0 && <p><b>Registered but not in Basecamp ({r.notInBasecamp.length}):</b> {r.notInBasecamp.map(x => x.name).join(', ')}. Bring them in with the next TroopWebHost sync, or add them in Members.</p>}
          {r.notRegistered.length > 0 && <p><b>In Basecamp but not on the Scoutbook roster ({r.notRegistered.length}):</b> {r.notRegistered.map(x => x.name).join(', ')}. They may be new, unregistered parents, or have left.</p>}
          {r.diffs.length > 0 && <p><b>Different patrols:</b> {r.diffs.map(x => `${x.name} (Basecamp ${x.basecamp}, Scoutbook ${x.scoutbook})`).join('; ')}.</p>}
          {!(r.notInBasecamp.length + r.notRegistered.length + r.diffs.length) && <p className="good-text">Everyone matches.</p>}
        </div>
      </details>
    </Section>
  );
}

function CampResults({ camp }) {
  return (
    <Section title="Summer camp results">
      {camp.map(c => (
        <details key={c.id} className="set-group">
          <summary><Icon name="tent" size={18} /><span className="grow"><b>{c.note}</b><span>{c.scouts.length} scouts · added {ago(c.at)} by {c.by}</span></span></summary>
          <div className="card"><ul className="sync-diff">{c.scouts.map(s => <li key={s.id}><b>{s.name}</b>{s.badges.length > 0 && <span><Pill tone="good">Finished</Pill> {s.badges.join(', ')}</span>}{s.partial.length > 0 && <span><Pill tone="warn">Partial</Pill> {s.partial.join(', ')}</span>}</li>)}</ul>
            {c.unmatched?.length > 0 && <p className="small muted">Not matched to anyone in Basecamp: {c.unmatched.join(', ')}.</p>}</div>
        </details>
      ))}
    </Section>
  );
}

function Positions({ pass, onDone }) {
  const [list, setList] = useState(null);
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('elect', { leader: pass }).then(x => setList(x.elections.filter(e => e.status === 'closed'))).catch(() => setList([])); }, [pass]);
  if (!list?.length) return null;
  const e = list[0];
  return (
    <div className="card sync-pos">
      <b>After elections: update positions in Basecamp</b>
      <p className="small muted">Gives the winners of “{e.title}” their new positions, and takes them off the previous holders (for patrol positions, only within that patrol). Ties are skipped for leaders to decide.</p>
      {r ? <ul className="small">{r.changes.map((c, i) => <li key={i}>{c.position}{c.patrol ? ` (${c.patrol})` : ''}: {c.name || (c.skipped === 'tie' ? 'tie — not changed' : 'no votes')}</li>)}</ul>
        : <button className="btn small" disabled={busy} onClick={async () => { if (!confirm(`Update positions from ${e.title}?`)) return; setBusy(true); try { setR(await api('sync/positions', { method: 'POST', body: { election: e.id }, leader: pass })); onDone(); } catch (er) { alert(er.message); } finally { setBusy(false); } }}>Update positions from {e.title}</button>}
    </div>
  );
}

export const SYNC_ROLE_LABELS = { scoutmaster: 'Scoutmaster', chair: 'Committee Chair', advancement: 'Advancement Chair', webmaster: 'Webmaster', any: 'Any leader' };
export { troop };
