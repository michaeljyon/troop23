import { useEffect } from 'react';
import Icon from '../components/Icon.jsx';
import { Section, Empty, Pill } from '../components/ui.jsx';
import Rsvp from '../components/Rsvp.jsx';
import { useApi, useCol, photoUrl } from '../lib/api.js';
import { useLocal, useMe } from '../lib/store.js';
import { troop, outingType } from '../lib/config.js';
import { rangeLabel, whenLabel, monthDay, today } from '../lib/dates.js';

export default function Home() {
  const [me] = useMe();
  const [family] = useLocal('family', null);
  const [mine, setMine] = useLocal('my-photos', []);
  const outings = useCol('outings');
  const posts = useCol('posts');
  const gear = useCol('gear');
  const photos = useApi('photos');
  const upcoming = outings.items.filter(o => (o.end || o.start) >= today());
  const next = upcoming[0];
  const rsvps = useCol('rsvps', next ? { outing: next.id } : { outing: '_none' });
  const myGear = gear.items.filter(g => g.checkout && g.checkout.who.trim().toLowerCase() === me.name.trim().toLowerCase());
  const recent = (photos.data?.photos || []).slice(0, 6);
  const first = me.name.trim().split(/\s+/)[0];

  useEffect(() => {
    const live = new Set((photos.data?.photos || []).map(p => p.id));
    if (live.size && mine.some(p => p.status === 'pending' && live.has(p.id))) setMine(m => m.map(p => (p.status === 'pending' && live.has(p.id) ? { ...p, status: 'approved' } : p)));
  }, [photos.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const going = rsvps.items.filter(r => r.status === 'yes').length;

  return (
    <div className="content home">
      <p className="hello">Hey {first}{me.patrol ? <span> · {me.patrol}</span> : null}</p>

      {outings.loading && !outings.data ? <div className="next-card skeleton" /> : next ? (
        <section className="next-card">
          <div className="next-top">
            <span className="next-kicker">Next up · {whenLabel(next.start, next.end)}</span>
            <span className="next-type" aria-hidden="true">{outingType(next.type).emoji}</span>
          </div>
          <a className="next-title" href={`#/outing/${next.id}`}>{next.title}</a>
          <p className="next-meta"><Icon name="calendar" size={16} />{rangeLabel(next.start, next.end)}{next.location && <><span className="dot-sep" /><Icon name="pin" size={16} />{next.location}</>}</p>
          {next.meetTime && <p className="next-meta"><Icon name="clock" size={16} />Meet {next.meetTime}{next.meetPlace && ` · ${next.meetPlace}`}</p>}
          <Rsvp outing={next} rsvps={rsvps.items} onChange={rsvps.refresh} />
          <div className="next-actions">
            <a href={`#/outing/${next.id}?tab=meals`}><Icon name="pot" size={20} /><span>Meal plan</span></a>
            <a href={`#/outing/${next.id}?tab=pack`}><Icon name="checklist" size={20} /><span>Packing</span></a>
            <a href={`#/outing/${next.id}?tab=gear`}><Icon name="box" size={20} /><span>Gear</span></a>
            <a href={`#/outing/${next.id}`}><Icon name="users" size={20} /><span>{going} going</span></a>
          </div>
        </section>
      ) : (
        <Empty icon="tent" title="No outings on the calendar yet">Leaders add outings from the Outings tab.</Empty>
      )}

      {posts.items.length > 0 && (
        <Section title="Bulletin">
          <ul className="posts">
            {posts.items.slice(0, 4).map(p => (
              <li key={p.id} className={`post ${p.pinned ? 'pinned' : ''}`}>
                <p className="post-title">{p.pinned && <Icon name="megaphone" size={16} />}{p.title}</p>
                {p.body && <p className="post-body">{p.body}</p>}
                {p.link && <a className="link-btn small" href={p.link} target="_blank" rel="noopener noreferrer">Open link <Icon name="external" size={14} /></a>}
                <p className="post-meta">{new Date(p.created).toLocaleDateString([], { month: 'short', day: 'numeric' })}{p.updatedBy && ` · ${p.updatedBy}`}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {myGear.length > 0 && (
        <a className="alert-card" href="#/gear?filter=mine">
          <span className="alert-ico"><Icon name="box" size={22} /></span>
          <span className="grow"><b>You have {myGear.length} piece{myGear.length > 1 ? 's' : ''} of troop gear</b><span>{myGear.slice(0, 3).map(g => g.name).join(', ')}{myGear.length > 3 ? '…' : ''}</span></span>
          <Icon name="chevronR" />
        </a>
      )}

      {me.role === 'parent' && !family && (
        <a className="alert-card warm" href="#/permission">
          <span className="alert-ico"><Icon name="shield" size={22} /></span>
          <span className="grow"><b>Set your scout's photo permission</b><span>Takes a minute. You choose who can see photos of your scout.</span></span>
          <Icon name="chevronR" />
        </a>
      )}

      <div className="tiles">
        <a className="tile" href="#/kitchen"><Icon name="pot" size={26} /><b>Kitchen</b><span>Recipes & pantry</span></a>
        <a className="tile" href="#/gear"><Icon name="box" size={26} /><b>Gear locker</b><span>Check out & in</span></a>
        <a className="tile" href="#/gallery"><Icon name="image" size={26} /><b>Photos</b><span>Troop gallery</span></a>
        <a className="tile" href="#/packing"><Icon name="checklist" size={26} /><b>Packing list</b><span>Be ready to go</span></a>
      </div>

      {upcoming.length > 1 && (
        <Section title="Coming up" action={<a className="link-btn" href="#/outings">All outings</a>}>
          <ul className="outing-list">{upcoming.slice(1, 4).map(o => <OutingRow key={o.id} o={o} />)}</ul>
        </Section>
      )}

      <Section title="Fresh photos" action={recent.length > 0 && <a className="link-btn" href="#/gallery">Gallery</a>}>
        {recent.length === 0 ? <Empty icon="camera" title="No photos yet" action={<a className="btn small" href="#/snap">Share the first one</a>}>Approved photos show up here.</Empty>
          : <ul className="strip">{recent.map(p => <li key={p.id}><a href={`#/gallery?photo=${p.id}`}><img src={photoUrl(p.id, true)} alt={p.caption || 'Troop photo'} loading="lazy" /></a></li>)}</ul>}
      </Section>

      <footer className="home-foot">
        <p><Icon name="lock" size={15} /> Private to {troop.unit}. Location data is removed from every photo before it's sent.</p>
      </footer>
    </div>
  );
}

export function OutingRow({ o }) {
  const md = monthDay(o.start);
  const t = outingType(o.type);
  return (
    <li>
      <a className={`outing-row ${o.cancelled ? 'cancelled' : ''}`} href={`#/outing/${o.id}`}>
        <span className="date-block"><span>{md.mon}</span><b>{md.day}</b></span>
        <span className="grow">
          <span className="outing-row-title">{o.title}</span>
          <span className="outing-row-meta">{t.emoji} {t.label} · {rangeLabel(o.start, o.end)}{o.location ? ` · ${o.location}` : ''}</span>
        </span>
        {o.cancelled ? <Pill tone="bad">Cancelled</Pill> : <Icon name="chevronR" />}
      </a>
    </li>
  );
}
