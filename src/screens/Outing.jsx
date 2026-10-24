import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Pill } from '../components/ui.jsx';
import Rsvp from '../components/Rsvp.jsx';
import Meals from './Meals.jsx';
import { PackingList } from './Packing.jsx';
import { GearPicker, CheckinAll } from './Gear.jsx';
import { useApi, useCol, useLeaderMode, photoUrl, usePatrols } from '../lib/api.js';
import { outingType } from '../lib/config.js';
import { rangeLabel, whenLabel } from '../lib/dates.js';
import { go } from '../lib/router.js';
import { OutingForm } from './Outings.jsx';

const TABS = [['overview', 'Overview', 'info'], ['meals', 'Meals', 'pot'], ['gear', 'Gear', 'box'], ['pack', 'Packing', 'checklist'], ['photos', 'Photos', 'image']];

export default function Outing({ route }) {
  const id = route.args[0];
  const tab = route.query.tab || 'overview';
  const o = useApi(`c/outings/${id}`);
  const rsvps = useCol('rsvps', { outing: id });
  const leader = useLeaderMode();
  const [editing, setEditing] = useState(null);
  const outing = o.data?.item;

  if (o.error) return <div className="content"><PageHead backTo="outings" /><Empty icon="alert" title="Outing not found">{o.error.message}</Empty></div>;
  if (!outing) return <div className="content"><PageHead backTo="outings" /><p className="muted">Loading…</p></div>;
  const t = outingType(outing.type);

  return (
    <div className="content">
      <PageHead backTo="outings">
        {leader && <button className="btn small secondary head-btn" onClick={() => setEditing(outing)}><Icon name="edit" size={16} />Edit</button>}
      </PageHead>
      <section className={`outing-hero type-${outing.type}`}>
        <p className="outing-kicker">{t.emoji} {t.label} · {outing.cancelled ? 'Cancelled' : whenLabel(outing.start, outing.end)}</p>
        <h1>{outing.title}</h1>
        <p className="outing-when"><Icon name="calendar" size={17} />{rangeLabel(outing.start, outing.end)}</p>
        {outing.location && <a className="outing-where" href={`https://maps.google.com/?q=${encodeURIComponent(outing.mapQ || outing.address || outing.location)}`} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={17} /><span>{outing.location}{outing.address && <span className="outing-addr">{outing.address}</span>}</span><Icon name="external" size={14} /></a>}
        {(outing.placePhone || /^https?:\/\//.test(outing.placeWeb || '')) && <p className="outing-links">
          {outing.placePhone && <a href={`tel:${outing.placePhone.replace(/[^0-9+]/g, '')}`}><Icon name="phone" size={14} />Call</a>}
          {/^https?:\/\//.test(outing.placeWeb || '') && <a href={outing.placeWeb} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14} />Website</a>}
        </p>}
      </section>

      <div className="tabs scroll" role="tablist">
        {TABS.map(([k, l, ic]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(`outing/${id}${k === 'overview' ? '' : `?tab=${k}`}`)}><Icon name={ic} size={17} />{l}</button>)}
      </div>

      {tab === 'overview' && <Overview outing={outing} rsvps={rsvps} />}
      {tab === 'meals' && <Meals outing={outing} rsvps={rsvps.items} />}
      {tab === 'gear' && <OutingGear outing={outing} />}
      {tab === 'pack' && <PackingList storeKey={`pack-${outing.id}`} extras={outing.extras} title={outing.title} />}
      {tab === 'photos' && <OutingPhotos outing={outing} />}

      <OutingForm outing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); o.refresh(); }} />
    </div>
  );
}

function Overview({ outing, rsvps }) {
  const patrols = usePatrols() || [];
  const yes = rsvps.items.filter(r => r.status === 'yes');
  const maybe = rsvps.items.filter(r => r.status === 'maybe');
  const groups = [...new Set([...patrols, ...rsvps.items.map(r => r.patrol || 'No patrol')])]
    .map(p => ({ p, people: rsvps.items.filter(r => (r.patrol || 'No patrol') === p && r.status !== 'no') }))
    .filter(g => g.people.length);
  return (
    <>
      <Section title="Are you going?">
        <Rsvp outing={outing} rsvps={rsvps.items} onChange={rsvps.refresh} />
        <p className="small muted">{yes.length} going{maybe.length ? ` · ${maybe.length} maybe` : ''} · {plural(yes.filter(r => r.role === 'scout').length, 'scout')}, {plural(yes.filter(r => r.role === 'adult').length, 'adult')}</p>
      </Section>

      {(outing.meetTime || outing.returnTime || outing.cost) && (
        <div className="facts">
          {outing.meetTime && <div><span>Meet</span><b>{outing.meetTime}</b>{outing.meetPlace && <em>{outing.meetPlace}</em>}</div>}
          {outing.returnTime && <div><span>Back</span><b>{outing.returnTime}</b></div>}
          {outing.cost && <div><span>Cost</span><b>{outing.cost}</b></div>}
        </div>
      )}
      {outing.details && <Section title="The plan"><div className="card prose">{outing.details.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div></Section>}

      <Section title="Who's coming">
        {groups.length === 0 ? <p className="muted">No sign-ups yet. Be the first!</p> : (
          <div className="patrol-groups">
            {groups.map(g => (
              <div key={g.p} className="card patrol-group">
                <p className="pg-head"><b>{g.p}</b><span>{g.people.filter(x => x.status === 'yes').length} going</span></p>
                <ul>{g.people.map(r => <li key={r.id}><span>{shortName(r.name)}</span>{r.role === 'adult' && <Pill>Adult</Pill>}{r.status === 'maybe' && <Pill tone="warn">Maybe</Pill>}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const shortName = n => { const w = n.trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : w[0]; };

function OutingGear({ outing }) {
  const gear = useCol('gear');
  const [picking, setPicking] = useState(false);
  const [returning, setReturning] = useState(false);
  const out = gear.items.filter(g => g.checkout?.outingId === outing.id);
  const byPatrol = [...new Set(out.map(g => g.checkout.patrol || 'Troop'))].map(p => ({ p, items: out.filter(g => (g.checkout.patrol || 'Troop') === p) }));
  return (
    <>
      <div className="btn-row">
        <button className="btn" onClick={() => setPicking(true)}><Icon name="arrowOut" size={18} />Check out gear for this trip</button>
        {out.length > 0 && <button className="btn secondary" onClick={() => setReturning(true)}><Icon name="arrowIn" size={18} />Check gear back in</button>}
      </div>
      {gear.loading && !gear.data ? <p className="muted">Loading…</p> : out.length === 0 ? <Empty icon="box" title="No gear checked out for this trip yet">Quartermasters: check out tents, stoves and patrol boxes here so everyone knows what's packed.</Empty> : (
        byPatrol.map(g => (
          <Section key={g.p} title={`${g.p} · ${g.items.length}`}>
            <ul className="gear-list">{g.items.map(i => <li key={i.id} className="gear-row static"><span className="grow"><b>{i.name}</b>{i.tag && <span className="tag">{i.tag}</span>}<span className="small muted">with {i.checkout.who}{i.checkout.due ? ` · due ${i.checkout.due}` : ''}</span></span></li>)}</ul>
          </Section>
        ))
      )}
      <GearPicker open={picking} outing={outing} items={gear.items} onClose={() => setPicking(false)} onDone={() => { setPicking(false); gear.refresh(); }} />
      <CheckinAll open={returning} items={out} onClose={() => setReturning(false)} onDone={() => { setReturning(false); gear.refresh(); }} />
    </>
  );
}

function OutingPhotos({ outing }) {
  const photos = useApi('photos');
  const list = (photos.data?.photos || []).filter(p => p.album === outing.id);
  return (
    <>
      <div className="btn-row">
        <a className="btn accent" href={`#/snap?album=${outing.id}`}><Icon name="camera" size={18} />Add photos</a>
        {list.length > 0 && <a className="btn secondary" href={`#/slideshow?album=${outing.id}`}><Icon name="play" size={18} />Slideshow</a>}
      </div>
      {photos.loading && !photos.data ? <p className="muted">Loading…</p> : list.length === 0 ? <Empty icon="image" title="No photos from this outing yet">Photos show up here after a leader approves them.</Empty> : (
        <ul className="gallery">{list.map(p => <li key={p.id}><a href={`#/gallery?album=${outing.id}&photo=${p.id}`} className="gal-a"><img src={photoUrl(p.id, true)} alt={p.caption || ''} loading="lazy" /></a></li>)}</ul>
      )}
    </>
  );
}
