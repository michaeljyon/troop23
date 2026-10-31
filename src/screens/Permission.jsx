import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section } from '../components/ui.jsx';
import { troop, t, level } from '../lib/config.js';
import { useLocal, useMe } from '../lib/store.js';
import { api, usePatrols } from '../lib/api.js';

// Family photo permission: one form per family, one choice per scout.
// Replaces the conference app's attendee photo release with a parent or
// guardian consent that leaders check photos against.
const blankScout = () => ({ first: '', lastInitial: '', patrol: '', level: '' });

export default function Permission() {
  const [me, setMe] = useMe();
  const [family, setFamily] = useLocal('family', null);   // { id, scouts, parent, updated }
  const [editing, setEditing] = useState(!family);
  const [form, setForm] = useState(() => toForm(family, me));
  const [busy, setBusy] = useState(false);
  const patrols = usePatrols() || troop.patrols;
  const [msg, setMsg] = useState(null);

  // Refresh from the server (a leader may have changed it).
  useEffect(() => {
    if (!family?.id) return;
    api(`consent/${family.id}`).then(d => { setFamily(d.record); if (!editing) setForm(toForm(d.record, me)); })
      .catch(e => { if (e.status === 404) { setFamily(null); setEditing(true); } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setScout = (i, patch) => setForm(f => ({ ...f, scouts: f.scouts.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const d = await api('consent', { method: 'POST', body: { familyId: family?.id, parent: form.parent, scouts: form.scouts.filter(s => s.first.trim()), signature: form.signature, agreed: form.agreed } });
      setFamily(d.record);
      if (!me.name.trim()) setMe({ ...me, name: form.parent.name });
      setForm(toForm(d.record, me));
      setEditing(false);
      setMsg({ text: 'Saved! Thank you. Leaders will follow your choices.' });
      window.scrollTo(0, 0);
    } catch (err) { setMsg({ bad: true, text: err.message }); }
    finally { setBusy(false); }
  }

  return (
    <div className="content">
      <PageHead backTo="more" eyebrow="For parents & guardians" title="Photo permission" sub={`You decide who can see photos of your scout. Leaders check every photo against your choice before families see it.`} />
      {msg && <p className={`form-msg ${msg.bad ? '' : 'good'}`} role={msg.bad ? 'alert' : 'status'}>{msg.text}</p>}

      {!editing && family ? (
        <Section title="On file for your family">
          <div className="card onfile">
            <ul className="onfile-list">
              {family.scouts.map(s => {
                const l = level(s.level);
                return (
                  <li key={s.id}>
                    <span className="onfile-name"><b>{s.first} {s.lastInitial && `${s.lastInitial}.`}</b>{s.patrol && <span className="muted"> · {s.patrol}</span>}</span>
                    <span className={`lvl lvl-${s.level}`}>{l?.short}</span>
                  </li>
                );
              })}
            </ul>
            <p className="small muted">Signed by {family.signature} · updated {new Date(family.updated).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <button className="btn secondary" onClick={() => { setForm(toForm(family, me)); setEditing(true); setMsg(null); }}><Icon name="edit" size={18} />Change choices or add a scout</button>
          </div>
        </Section>
      ) : (
        <form onSubmit={submit}>
          <Section title="The three choices">
            <ul className="levels-explain">
              {troop.consentLevels.map(l => <li key={l.id} className={`lvl-card lvl-${l.id}`}><b>{l.label}</b><span>{t(l.text)}</span></li>)}
            </ul>
          </Section>

          <Section title="Your scouts">
            {form.scouts.map((s, i) => (
              <fieldset className="card scout" key={i}>
                <legend>Scout {form.scouts.length > 1 ? i + 1 : ''}</legend>
                {form.scouts.length > 1 && <button type="button" className="icon-btn scout-x" onClick={() => setForm(f => ({ ...f, scouts: f.scouts.filter((_, j) => j !== i) }))} aria-label={`Remove scout ${i + 1}`}><Icon name="x" size={18} /></button>}
                <div className="name-row">
                  <label className="field"><span>First name</span><input value={s.first} onChange={e => setScout(i, { first: e.target.value })} autoComplete="off" required={i === 0} /></label>
                  <label className="field initial"><span>Last initial</span><input value={s.lastInitial} onChange={e => setScout(i, { lastInitial: e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() })} maxLength={1} autoComplete="off" /></label>
                </div>
                <label className="field"><span>Patrol</span>
                  <select value={s.patrol} onChange={e => setScout(i, { patrol: e.target.value })}>
                    <option value="">Choose a patrol</option>
                    {patrols.filter(d => !/adult|leader/i.test(d)).map(d => <option key={d}>{d}</option>)}
                  </select>
                </label>
                <div className="field" role="radiogroup" aria-label={`Photo choice for ${s.first || `scout ${i + 1}`}`}>
                  <span>Photo choice</span>
                  <div className="lvl-pick">
                    {troop.consentLevels.map(l => (
                      <button type="button" key={l.id} role="radio" aria-checked={s.level === l.id} className={`lvl-opt lvl-${l.id} ${s.level === l.id ? 'on' : ''}`} onClick={() => setScout(i, { level: l.id })}>
                        <span className="dot" aria-hidden="true">{s.level === l.id && <Icon name="check" size={14} strokeWidth={3} />}</span>{l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </fieldset>
            ))}
            {form.scouts.length < 8 && <button type="button" className="btn secondary small" onClick={() => setForm(f => ({ ...f, scouts: [...f.scouts, blankScout()] }))}><Icon name="plus" size={16} />Add another scout</button>}
          </Section>

          <Section title="Parent or guardian">
            <div className="card">
              <label className="field"><span>Your name</span><input value={form.parent.name} onChange={e => setForm(f => ({ ...f, parent: { ...f.parent, name: e.target.value } }))} autoComplete="name" required /></label>
              <div className="two-col">
                <label className="field"><span>Email <i className="opt">optional</i></span><input type="email" value={form.parent.email} onChange={e => setForm(f => ({ ...f, parent: { ...f.parent, email: e.target.value } }))} autoComplete="email" /></label>
                <label className="field"><span>Phone <i className="opt">optional</i></span><input type="tel" value={form.parent.phone} onChange={e => setForm(f => ({ ...f, parent: { ...f.parent, phone: e.target.value } }))} autoComplete="tel" /></label>
              </div>
              <p className="small muted">Only leaders see your contact info, in case they have a question about a photo.</p>
            </div>
          </Section>

          <Section title="Sign">
            <div className="card">
              <ul className="terms">{troop.consentTerms.map((x, i) => <li key={i}>{t(x)}</li>)}</ul>
              <label className="field"><span>Type your full name to sign</span><input className="sig" value={form.signature} onChange={e => setForm(f => ({ ...f, signature: e.target.value }))} autoComplete="name" required /></label>
              <label className="check"><input type="checkbox" checked={form.agreed} onChange={e => setForm(f => ({ ...f, agreed: e.target.checked }))} /> I'm the parent or legal guardian, and these are my choices.</label>
              <div className="btn-row">
                <button className="btn big" disabled={busy}>{busy ? 'Saving…' : family ? 'Save changes' : 'Save my choices'}</button>
                {family && <button type="button" className="btn secondary" onClick={() => { setEditing(false); setMsg(null); }}>Cancel</button>}
              </div>
              <p className="small muted">{troop.contactEmail ? <>Questions? Email <a href={`mailto:${troop.contactEmail}`}>{troop.contactEmail}</a>.</> : 'Questions? Ask your Scoutmaster.'} You can change these choices at any time.</p>
            </div>
          </Section>
        </form>
      )}
    </div>
  );
}

function toForm(fam, me) {
  return {
    parent: fam?.parent ? { name: fam.parent.name || '', email: fam.parent.email || '', phone: fam.parent.phone || '' } : { name: me?.name || '', email: '', phone: '' },
    scouts: fam?.scouts?.length ? fam.scouts.map(s => ({ ...s })) : [blankScout()],
    signature: '', agreed: false,
  };
}
