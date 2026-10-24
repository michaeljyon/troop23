// Troop calendar feed (iCalendar). Phones subscribe once and outings stay up
// to date. The feed URL carries its own random key (not the troop code), made
// once and kept in the Blobs store. Signed-in members and troop-code guests can
// get the link from GET /api/calendar/link.
import troop from '../../troop/troop.js';

const TZ = 'America/New_York';
const keyOf = async store => {
  let k = await store.get('calkey', { type: 'json' });
  if (!k) { k = { key: [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('') }; await store.setJSON('calkey', k); }
  return k.key;
};

export async function calendarLink(store, url) {
  const key = await keyOf(store);
  return new Response(JSON.stringify({ url: `${url.origin}/api/calendar.ics?c=${key}` }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// "Sat 8:00 AM" / "7:00 PM" / "19:30" -> "HHMM00"
function hhmm(s) {
  const m = String(s || '').match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?/i) || String(s || '').match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  let h = +m[1]; const min = +(m[2] || 0);
  if (m[3]) { const pm = m[3].toLowerCase() === 'p'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}00`;
}
const d8 = iso => iso.replace(/-/g, '');
const nextDay = iso => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
// fold long lines at 74 octets-ish (characters is close enough for this content)
const fold = line => line.length <= 74 ? line : line.match(/.{1,70}/gu).join('\r\n ');

function vevent(o, origin, stamp) {
  const start = o.start, end = o.end && o.end >= o.start ? o.end : o.start;
  const t1 = hhmm(o.meetTime), t2 = hhmm(o.returnTime);
  const lines = ['BEGIN:VEVENT', `UID:${o.id}@${new URL(origin).host}`, `DTSTAMP:${stamp}`];
  if (t1 && (t2 || start === end)) {
    lines.push(`DTSTART;TZID=${TZ}:${d8(start)}T${t1}`);
    const endT = t2 && (end > start || t2 > t1) ? t2 : null;
    lines.push(endT ? `DTEND;TZID=${TZ}:${d8(end)}T${endT}` : 'DURATION:PT1H30M');
  } else {
    lines.push(`DTSTART;VALUE=DATE:${d8(start)}`, `DTEND;VALUE=DATE:${d8(nextDay(end))}`);
  }
  const type = troop.outingTypes.find(t => t.id === o.type);
  lines.push(`SUMMARY:${esc(`${o.cancelled ? 'CANCELLED: ' : ''}${type?.emoji ? `${type.emoji} ` : ''}${o.title}`)}`);
  const loc = [o.location, o.address].filter(Boolean).join(', ');
  if (loc) lines.push(`LOCATION:${esc(loc)}`);
  const desc = [
    o.meetTime && `Meet: ${o.meetTime}${o.meetPlace ? ` at ${o.meetPlace}` : ''}`,
    o.returnTime && `Back: ${o.returnTime}`,
    o.cost && `Cost: ${o.cost}`,
    o.details,
    `Sign up and details: ${origin}/#/outing/${o.id}`,
  ].filter(Boolean).join('\n');
  lines.push(`DESCRIPTION:${esc(desc)}`, `URL:${origin}/#/outing/${o.id}`);
  if (o.cancelled) lines.push('STATUS:CANCELLED');
  lines.push('END:VEVENT');
  return lines.map(fold).join('\r\n');
}

export async function calendarFeed(store, url) {
  const key = await keyOf(store);
  if (url.searchParams.get('c') !== key) return new Response('Calendar link expired. Get a new one in the Basecamp app under Outings.', { status: 401 });
  const one = url.searchParams.get('id');
  const { blobs } = await store.list({ prefix: 'c/outings/' });
  const since = new Date(Date.now() - 86400000 * 90).toISOString().slice(0, 10);
  let items = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
  items = one ? items.filter(o => o.id === one) : items.filter(o => (o.end || o.start) >= since);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const name = `${troop.unit || 'Troop 23'} Basecamp`;
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Troop 23 Basecamp//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`, `X-WR-TIMEZONE:${TZ}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
    ...items.sort((a, b) => a.start.localeCompare(b.start)).map(o => vevent(o, url.origin, stamp)), 'END:VCALENDAR'].join('\r\n') + '\r\n';
  return new Response(body, { headers: {
    'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store',
    'content-disposition': `${one ? 'attachment' : 'inline'}; filename="${one ? 'outing' : 'troop23'}.ics"`,
  } });
}
