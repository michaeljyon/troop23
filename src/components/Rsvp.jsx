import Icon from './Icon.jsx';
import { saveDoc } from '../lib/api.js';
import { slug } from '../lib/config.js';
import { useMe } from '../lib/store.js';

export const rsvpId = (outingId, name) => `${outingId}__${slug(name)}`.slice(0, 80);

// Going / Maybe / Can't buttons for the person on this phone.
export default function Rsvp({ outing, rsvps, onChange, compact }) {
  const [me] = useMe();
  const id = rsvpId(outing.id, me.name);
  const mine = rsvps.find(r => r.id === id);
  async function set(status) {
    await saveDoc('rsvps', id, { outingId: outing.id, name: me.name, patrol: me.patrol, role: me.role === 'scout' ? 'scout' : 'adult', status }, me.name);
    onChange?.();
  }
  if (outing.cancelled) return <p className="pill pill-bad">Cancelled</p>;
  return (
    <div className={`rsvp ${compact ? 'compact' : ''}`} role="group" aria-label="Are you going?">
      {[['yes', 'Going', 'check'], ['maybe', 'Maybe', 'clock'], ['no', 'Can\'t go', 'x']].map(([s, l, ic]) => (
        <button key={s} type="button" className={`rsvp-btn rsvp-${s} ${mine?.status === s ? 'on' : ''}`} aria-pressed={mine?.status === s} onClick={() => set(s)}><Icon name={ic} size={16} strokeWidth={2.4} />{l}</button>
      ))}
    </div>
  );
}
