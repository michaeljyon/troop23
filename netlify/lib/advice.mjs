// Advancement suggestions: what each scout could work on next, built only
// from their own record (ranks, merit badges, partials, camping nights),
// the troop's counselors, upcoming outings and hikes logged in Basecamp.
// It never marks anything complete — Scoutbook/TroopWebHost stay official,
// and the Scoutmaster and counselors sign off.
//
// Rank rules used here (Scouts BSA, checked Oct 2026):
//   Star  — 6 merit badges, 4 from the Eagle-required list; 4 months active as First Class
//   Life  — 11 merit badges, 7 from the Eagle-required list; 6 months active as Star
//   Eagle — 21 merit badges incl. all 13 Eagle-required (Citizenship in Society was
//           discontinued Feb 27, 2026); 6 months active as Life
//   Camping merit badge — at least 20 nights of camping at Scouting activities
import { MILE } from './hikes.mjs';

export const EAGLE_GROUPS = [['Camping'], ['Citizenship in the Community'], ['Citizenship in the Nation'], ['Citizenship in the World'], ['Communication'], ['Cooking'],
  ['Emergency Preparedness', 'Lifesaving'], ['Environmental Science', 'Sustainability'], ['Family Life'], ['First Aid'], ['Personal Fitness'],
  ['Personal Management'], ['Swimming', 'Hiking', 'Cycling']];
const LEGACY_EAGLE = ['Citizenship in Society'];   // still counts if earned
const RANKS = ['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle'];
const RULES = {
  Star: { total: 6, eagle: 4, months: 4, from: 'First Class' },
  Life: { total: 11, eagle: 7, months: 6, from: 'Star' },
  Eagle: { total: 21, eagle: 13, months: 6, from: 'Life' },
};
// badges an outing of each kind can help with
const BY_TYPE = {
  campout: ['Camping', 'Cooking', 'Wilderness Survival', 'Pioneering'], camp: ['Camping'], hike: ['Hiking', 'Orienteering'],
  paddle: ['Canoeing', 'Kayaking', 'Paddle Craft Safety', 'Lifesaving'], service: ['Citizenship in the Community'],
};
const DAYMS = 86400000;
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const addMonths = (iso, m) => { const d = new Date(`${iso}T12:00:00`); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
const pct = b => Math.round(100 * b.done / Math.max(1, b.done + b.left));
const mi = m => Math.round(m / MILE * 10) / 10;
const nice = iso => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

function mentions(outing, badge) {
  const text = `${outing.title || ''} ${outing.details || ''}`;
  const re = new RegExp(`(^|[^a-z])${badge.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
  if (!re.test(text)) return false;
  return outing.type === 'merit' || outing.type === 'camp' || /merit|\bmb\b|badge|class/i.test(text);
}

// counselor names for a badge
function counselorsFor(counselors, badge) {
  const n = norm(badge);
  return counselors.filter(c => c.active !== false && (c.badges || []).some(b => norm(b) === n)).map(c => c.name);
}

export function adviseScout({ scout, record, counselors = [], outings = [], hikeTotal = null, today = new Date().toISOString().slice(0, 10) }) {
  const r = record || {};
  const earned = new Set((r.badges || []).map(b => b.name));
  const earnedN = new Set([...earned].map(norm));
  const inProg = r.inProgress || [];
  const groups = (r.eagleGroups && r.eagleGroups.length ? r.eagleGroups : EAGLE_GROUPS).filter(g => !g.every(x => LEGACY_EAGLE.includes(x)));
  const eagleList = new Set([...groups.flat(), ...LEGACY_EAGLE].map(norm));
  const eagleEarned = [...earned].filter(b => eagleList.has(norm(b))).length;
  const groupsDone = groups.filter(g => g.some(x => earnedN.has(norm(x)))).length;
  const rank = scout.rank || '';
  const ri = RANKS.indexOf(rank);
  const target = ri < 0 ? 'Scout' : RANKS[Math.min(ri + 1, RANKS.length - 1)];
  const soon = outings.filter(o => !o.cancelled && o.start >= today && o.start <= new Date(Date.parse(today) + 75 * DAYMS).toISOString().slice(0, 10)).sort((a, b) => a.start.localeCompare(b.start));
  const steps = [];
  const add = s => steps.push(s);

  // ---- next rank
  const nextRank = { rank: target, items: [] };
  if (rank === 'Eagle') nextRank.rank = null;
  else if (RULES[target]) {
    const rule = RULES[target];
    const needTotal = Math.max(0, rule.total - earned.size);
    const needEagle = target === 'Eagle' ? groups.length - groupsDone : Math.max(0, rule.eagle - eagleEarned);
    nextRank.items.push({ label: 'Merit badges', have: earned.size, need: rule.total, ok: needTotal === 0 });
    nextRank.items.push({ label: target === 'Eagle' ? 'Eagle-required badges' : 'From the Eagle-required list', have: target === 'Eagle' ? groupsDone : eagleEarned, need: target === 'Eagle' ? groups.length : rule.eagle, ok: needEagle === 0 });
    if (scout.rankDate && rank === rule.from) {
      const when = addMonths(scout.rankDate, rule.months);
      nextRank.items.push({ label: `${rule.months} months active as ${rule.from}`, have: when <= today ? 1 : 0, need: 1, ok: when <= today, note: when <= today ? `met ${nice(when)}` : `on ${nice(when)}` });
      nextRank.eligible = when;
    }
    if (!(scout.positions || []).length) nextRank.items.push({ label: 'Position of responsibility', have: 0, need: 1, ok: false, note: 'talk to your Scoutmaster' });
    const parts = [needTotal && `${needTotal} more merit badge${needTotal > 1 ? 's' : ''}`, needEagle && `${needEagle} ${target === 'Eagle' ? 'Eagle-required badge' : 'from the Eagle-required list'}${needEagle > 1 && target === 'Eagle' ? 's' : ''}`].filter(Boolean);
    add({ id: 'rank', kind: 'rank', icon: 'trophy', priority: 1, title: parts.length ? `For ${target}: ${parts.join(', ')}` : nextRank.eligible > today ? `Merit badges done for ${target} — ${rule.months} months as ${rule.from} on ${nice(nextRank.eligible)}` : `Merit badges done for ${target}`,
      detail: parts.length ? `${target} needs ${rule.total} merit badges, ${target === 'Eagle' ? `including all ${groups.length} Eagle-required` : `${rule.eagle} of them from the Eagle-required list`}.` : 'Check the service, position and Scout spirit requirements with your Scoutmaster, then ask for a conference.' });
    if (target === 'Eagle') add({ id: 'project', kind: 'rank', icon: 'flame', priority: 6, title: 'Plan your Eagle service project', detail: 'Talk with your Scoutmaster and the troop\'s Eagle advisor before you start the proposal workbook.' });
  } else if (scout.next && scout.next.total) {
    const left = scout.next.total - scout.next.done;
    nextRank.items.push({ label: 'Requirements signed off', have: scout.next.done, need: scout.next.total, ok: left === 0 });
    const camp = soon.find(o => ['campout', 'camp'].includes(o.type));
    add({ id: 'rank', kind: 'rank', icon: 'trophy', priority: 1, title: left ? `${left} requirement${left > 1 ? 's' : ''} left for ${scout.next.rank}` : `Ready to ask for a ${scout.next.rank} conference`,
      detail: left ? `Many of the early rank requirements are done on campouts and at meetings. Bring your handbook${camp ? ` to ${camp.title}` : ''} and ask a leader to sign off what you finish.` : 'Talk to your Scoutmaster about a conference, then a board of review.',
      ...(camp && left ? { href: `#/outing/${camp.id}`, hrefLabel: camp.title } : {}) });
  }

  // ---- finish what's started
  inProg.filter(b => !earnedN.has(norm(b.name))).sort((a, b) => a.left - b.left || pct(b) - pct(a)).slice(0, 3).forEach((b, i) => {
    const counsel = b.counselor || counselorsFor(counselors, b.name)[0] || '';
    const months = b.started ? Math.floor((Date.parse(today) - Date.parse(b.started)) / (30 * DAYMS)) : 0;
    add({ id: `finish-${b.name}`, kind: 'finish', icon: 'check', priority: b.left <= 3 ? 2 : 3 + i * 0.1, badge: b.name, eagle: eagleList.has(norm(b.name)),
      title: `Finish ${b.name}: ${b.left} requirement${b.left === 1 ? '' : 's'} left`,
      detail: [`${pct(b)}% done${months >= 6 ? `, started ${months} months ago` : ''}.`, counsel ? `Counselor: ${counsel}.` : 'Ask a leader who can counsel it.'].join(' '),
      href: `#/counselors?q=${encodeURIComponent(b.name)}`, hrefLabel: counsel ? 'Message the counselor' : 'Find a counselor' });
  });

  // ---- Eagle-required to start next (from First Class up, or anyone who asks)
  const startedN = new Set(inProg.map(b => norm(b.name)));
  if (ri >= 1) {
    const open = groups.filter(g => !g.some(x => earnedN.has(norm(x)) || startedN.has(norm(x))));
    const ranked = open.map(g => {
      const options = g.filter(x => !LEGACY_EAGLE.includes(x)).map(x => ({ name: x, counselors: counselorsFor(counselors, x), outing: soon.find(o => mentions(o, x) || (BY_TYPE[o.type] || []).includes(x)) }));
      const best = options.find(o => o.outing && o.counselors.length) || options.find(o => o.outing) || options.find(o => o.counselors.length) || options[0];
      return { g, best, score: (best.outing ? 2 : 0) + (best.counselors.length ? 1 : 0) };
    }).sort((a, b) => b.score - a.score);
    const wantEagle = target === 'Eagle' || RULES[target] ? 3 : 1;
    ranked.slice(0, wantEagle).forEach(({ g, best }, i) => add({
      id: `eagle-${best.name}`, kind: 'eagle', icon: 'star', priority: 4 + i * 0.1, badge: best.name, eagle: true,
      title: `Start ${best.name}${g.length > 1 ? ` (or ${g.filter(x => x !== best.name).join(' or ')})` : ''}`,
      detail: [best.outing ? `${best.outing.title} on ${nice(best.outing.start)} is a good chance to work on it.` : '', best.counselors.length ? `Troop counselor${best.counselors.length > 1 ? 's' : ''}: ${best.counselors.slice(0, 2).join(', ')}.` : 'Ask a leader for a counselor.'].filter(Boolean).join(' '),
      href: best.outing ? `#/outing/${best.outing.id}` : `#/counselors?q=${encodeURIComponent(best.name)}`, hrefLabel: best.outing ? best.outing.title : 'Find a counselor',
    }));
  }

  // ---- outings coming up that line up with badges they haven't earned
  const seen = new Set(steps.map(s => norm(s.badge)));
  const catalog = (counselors.flatMap(c => c.badges || [])).concat(...groups);
  let outingTips = 0;
  for (const o of soon) {
    if (outingTips >= 2) break;
    const named = [...new Set(catalog)].filter(b => mentions(o, b));
    const typed = (BY_TYPE[o.type] || []);
    const hit = [...named, ...typed].find(b => !earnedN.has(norm(b)) && !seen.has(norm(b)));
    if (!hit) continue;
    seen.add(norm(hit)); outingTips++;
    add({ id: `outing-${o.id}`, kind: 'outing', icon: 'calendar', priority: 5, badge: hit, eagle: eagleList.has(norm(hit)),
      title: `${o.title} could help with ${hit}`, detail: `${nice(o.start)}${o.location ? ` · ${o.location}` : ''}. Ask the counselor before you go which requirements you can work on there.`, href: `#/outing/${o.id}`, hrefLabel: 'See the outing' });
  }

  // ---- camping nights and hiking
  const nights = Number(scout.totals?.nights ?? r.totals?.nights ?? 0) || 0;
  const camping = { earned: earnedN.has('camping'), nights, need: 20 };
  if (!camping.earned) {
    const next = soon.find(o => ['campout', 'camp'].includes(o.type));
    add({ id: 'nights', kind: 'activity', icon: 'tent', priority: nights >= 20 ? 2.5 : 6, title: nights >= 20 ? `You have ${nights} camping nights — enough for the Camping merit badge's camping requirement` : `${nights} of 20 camping nights for the Camping merit badge`,
      detail: next ? `${next.title} (${nice(next.start)}) adds more nights.` : 'Every troop campout and long-term camp counts toward it.', ...(next ? { href: `#/outing/${next.id}`, hrefLabel: next.title } : {}) });
  }
  const hiking = hikeTotal ? { count: hikeTotal.count, miles: mi(hikeTotal.distance), longest: mi(hikeTotal.longest), gainFt: Math.round(hikeTotal.gain * 3.28084), over10: hikeTotal.over10, over20: hikeTotal.over20 } : null;
  if (!earnedN.has('hiking') && !groups.find(g => g.includes('Hiking'))?.some(x => earnedN.has(norm(x)))) {
    add({ id: 'hiking', kind: 'activity', icon: 'map', priority: 7, title: hiking?.count ? `${hiking.count} hike${hiking.count > 1 ? 's' : ''} tracked · longest ${hiking.longest} mi` : 'Track your hikes in Basecamp',
      detail: 'The Hiking merit badge includes long day hikes (10 and 20 miles). Recording them in Basecamp keeps the distance and time for your counselor to review.', href: '#/hikes', hrefLabel: 'Hikes' });
  }

  steps.sort((a, b) => a.priority - b.priority);
  return { steps, nextRank, camping, hiking, eagle: { groupsDone, groups: groups.length, listEarned: eagleEarned } };
}

// Troop-wide planning for leaders: which Eagle-required badges the most
// scouts still need (good merit badge class picks), who is close to a rank,
// and partial badges that are almost done.
export function troopNeeds({ scouts, records, counselors = [], outings = [], today = new Date().toISOString().slice(0, 10) }) {
  const groups = EAGLE_GROUPS;
  const eligible = scouts.filter(s => RANKS.indexOf(s.rank) >= 2);   // Second Class and up
  const classes = groups.map(g => {
    const need = eligible.filter(s => { const e = new Set((records[s.id]?.badges || []).map(b => norm(b.name))); return !g.some(x => e.has(norm(x))); });
    const started = need.filter(s => (records[s.id]?.inProgress || []).some(b => g.some(x => norm(x) === norm(b.name))));
    const counsel = [...new Set(g.flatMap(x => counselorsFor(counselors, x)))];
    const outing = outings.find(o => !o.cancelled && o.start >= today && g.some(x => mentions(o, x)));
    return { badge: g.join(' or '), need: need.length, started: started.length, scouts: need.map(s => ({ id: s.id, name: s.name })), counselors: counsel, outing: outing ? { id: outing.id, title: outing.title, start: outing.start } : null };
  }).filter(c => c.need > 0).sort((a, b) => b.need - a.need);
  const close = scouts.filter(s => s.next && s.next.total && s.next.total - s.next.done <= 3 && RANKS.indexOf(s.rank) < 3)
    .map(s => ({ id: s.id, name: s.name, rank: s.next.rank, left: s.next.total - s.next.done })).sort((a, b) => a.left - b.left);
  const ready = [];
  for (const s of scouts) {
    const ri = RANKS.indexOf(s.rank); const target = RANKS[ri + 1]; const rule = RULES[target];
    if (!rule) continue;
    const r = records[s.id] || {};
    const e = (r.badges || []).map(b => norm(b.name));
    const eagleList = new Set([...groups.flat(), ...LEGACY_EAGLE].map(norm));
    const haveEagle = target === 'Eagle' ? groups.filter(g => g.some(x => e.includes(norm(x)))).length : e.filter(b => eagleList.has(b)).length;
    const okBadges = e.length >= rule.total && haveEagle >= (target === 'Eagle' ? groups.length : rule.eagle);
    const okTime = s.rankDate && addMonths(s.rankDate, rule.months) <= today;
    if (okBadges) ready.push({ id: s.id, name: s.name, rank: target, time: !!okTime });
  }
  const nearly = [];
  for (const s of scouts) for (const b of records[s.id]?.inProgress || []) if (b.left <= 2 && !(records[s.id]?.badges || []).some(x => norm(x.name) === norm(b.name))) nearly.push({ id: s.id, name: s.name, badge: b.name, left: b.left, counselor: b.counselor || '' });
  nearly.sort((a, b) => a.left - b.left);
  return { classes: classes.slice(0, 13), close, ready, nearly: nearly.slice(0, 40) };
}
