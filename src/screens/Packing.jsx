import Icon from '../components/Icon.jsx';
import { PageHead, Section, Progress } from '../components/ui.jsx';
import { useLocal } from '../lib/store.js';
import { troop } from '../lib/config.js';

// Personal packing checklist, saved on this phone (one per outing).
export function PackingList({ storeKey, extras = [], title }) {
  const [done, setDone] = useLocal(storeKey, {});
  const groups = [...(extras.length ? [{ group: 'For this trip', items: extras, special: true }] : []), ...troop.packing];
  const all = groups.flatMap(g => g.items.map(i => `${g.group}|${i}`));
  const n = all.filter(k => done[k]).length;
  return (
    <>
      <div className="card pack-head">
        <div><b>{n === all.length ? 'All packed! 🎒' : `${n} of ${all.length} packed`}</b>{title && <span className="small muted">{title}</span>}</div>
        <Progress value={n} max={all.length} label="Packing progress" />
        {n > 0 && <button className="link-btn small" onClick={() => confirm('Uncheck everything?') && setDone({})}><Icon name="refresh" size={14} />Start over</button>}
      </div>
      {groups.map(g => (
        <Section key={g.group} title={g.group} className={g.special ? 'pack-special' : ''}>
          <ul className="checklist">
            {g.items.map(i => {
              const k = `${g.group}|${i}`;
              return <li key={k}><label className={done[k] ? 'done' : ''}><input type="checkbox" checked={!!done[k]} onChange={e => setDone({ ...done, [k]: e.target.checked })} /><span>{i}</span></label></li>;
            })}
          </ul>
        </Section>
      ))}
      <p className="small muted center pad-top">Saved on this phone only.</p>
    </>
  );
}

export default function Packing() {
  return (
    <div className="content">
      <PageHead backTo="more" title="Packing list" sub="The standard overnight list. Each outing has its own copy with trip-specific extras." />
      <PackingList storeKey="pack-general" />
    </div>
  );
}
