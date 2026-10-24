import Icon from './Icon.jsx';
import { saveDoc, useAccount } from '../lib/api.js';
import { slug } from '../lib/config.js';
import { useMe } from '../lib/store.js';

export const rsvpId = (outingId, name) => `${outingId}__${slug(name)}`.slice(0, 80);
const idFor = (outingId, person) => (person.id ? `${outingId}__${person.id}` : rsvpId(outingId, person.name)).slice(0, 80);

// Going / Maybe / Can't for the person on this phone, plus each scout linked
// to their account (parents can sign up the whole family in one place).
export default function Rsvp({ outing, rsvps, onChange, compact }) {
  const [me] = useMe();
  const acct = useAccount();
  const people = acct
    ? [{ id: acct.member.id, name: acct.member.name, patrol: acct.member.patrol, role: acct.member.role === 'scout' ? 'scout' : 'adult', self: true }, ...(acct.scouts || []).map(s => ({ id: s.id, name: s.name, patrol: s.patrol, role: 'scout' }))]
    : [{ name: me.name, patrol: me.patrol, role: me.role === 'scout' ? 'scout' : 'adult', self: true }];
  if (outing.cancelled) return <p className="pill pill-bad">Cancelled</p>;
  async function set(person, status) {
    await saveDoc('rsvps', idFor(outing.id, person), { outingId: outing.id, memberId: person.id || '', name: person.name, patrol: person.patrol || '', role: person.role, status }, me.name);
    onChange?.();
  }
  const many = people.length > 1;
  return (
    <div className={`rsvp-wrap ${many ? 'many' : ''}`}>
      {people.map(p => {
        const mine = rsvps.find(r => r.id === idFor(outing.id, p));
        return (
          <div key={p.id || p.name} className="rsvp-person">
            {many && <span className="rsvp-name">{p.self ? 'Me' : p.name.split(' ')[0]}</span>}
            <div className={`rsvp ${compact ? 'compact' : ''}`} role="group" aria-label={`Is ${p.self ? 'you' : p.name} going?`}>
              {[['yes', 'Going', 'check'], ['maybe', 'Maybe', 'clock'], ['no', 'Can\'t go', 'x']].map(([s, l, ic]) => (
                <button key={s} type="button" className={`rsvp-btn rsvp-${s} ${mine?.status === s ? 'on' : ''}`} aria-pressed={mine?.status === s} onClick={() => set(p, s)}><Icon name={ic} size={16} strokeWidth={2.4} />{l}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
