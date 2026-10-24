import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';

// Tag scouts in a photo so leaders can check each family's photo choice.
export default function TagPicker({ scouts, patrol, tags, setTags, label = 'Scouts in this photo' }) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const shown = useMemo(() => {
    if (q.trim()) return scouts.filter(x => x.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (patrol && !all) return scouts.filter(x => x.patrol === patrol || tags.includes(x.id));
    return scouts;
  }, [scouts, q, patrol, all, tags]);
  const toggle = id => setTags(tags.includes(id) ? tags.filter(x => x !== id) : [...tags, id]);
  if (!scouts.length) return <p className="small muted tag-empty"><Icon name="tag" size={15} /> Once families fill out photo permission, you can tag scouts here so leaders can double-check.</p>;
  return (
    <div className="tagger">
      <div className="tagger-head"><span className="field-label">{label}</span>{tags.length > 0 && <span className="count-pill">{tags.length} tagged</span>}</div>
      <p className="small muted">Helps leaders check each family's photo choice. Tags are only visible to leaders.</p>
      {scouts.length > 12 && <input className="tag-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Find a scout" aria-label="Find a scout" />}
      <div className="tag-chips">
        {shown.map(s => <button key={s.id} type="button" className={`chip ${tags.includes(s.id) ? 'on' : ''}`} aria-pressed={tags.includes(s.id)} onClick={() => toggle(s.id)}>{tags.includes(s.id) && <Icon name="check" size={14} />}{s.name}{s.patrol && <span className="chip-sub">{s.patrol}</span>}</button>)}
      </div>
      {patrol && !all && !q && shown.length < scouts.length && <button type="button" className="link-btn small" onClick={() => setAll(true)}>Show scouts from every patrol</button>}
    </div>
  );
}
