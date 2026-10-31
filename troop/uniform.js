// Uniform inspection checklist (Scouts BSA field uniform), shared by the app and the server.
// Points add up to 100 with the hat switched off (it is off by default). Items marked `optional` can be switched off by leaders for the troop;
// items marked `na` can be marked "doesn't apply" for one scout (e.g. no position yet).
// `spot` is where the item's pin sits on the drawing (percent of width / height).

export const UNIFORM = [
  { id: 'hat', label: 'Hat', emoji: '🧢', pts: 5, optional: true, off: true, spot: [50, 6], tip: 'Troop or Scouts BSA cap, worn forward. Off indoors.' },
  { id: 'neck', label: 'Neckerchief & slide', emoji: '🎀', pts: 10, optional: true, spot: [50, 25], tip: 'Rolled neatly, slide snug at the collar (or a bolo tie if the troop allows).' },
  { id: 'shirt', label: 'Shirt', emoji: '👕', pts: 15, spot: [36, 48], tip: 'Tan uniform shirt, buttoned and tucked in.' },
  { id: 'loops', label: 'Shoulder loops', emoji: '🟩', pts: 5, spot: [31, 21], tip: 'Green loops on both shoulders.' },
  { id: 'council', label: 'Council patch & 23', emoji: '🔴', pts: 10, spot: [80, 30], tip: 'Left sleeve: council patch at the top, troop numerals right under it.' },
  { id: 'flag', label: 'U.S. flag', emoji: '🇺🇸', pts: 5, spot: [20, 30], tip: 'Right sleeve, just below the shoulder seam.' },
  { id: 'patrol', label: 'Patrol patch', emoji: '🏷️', pts: 10, spot: [19, 39], tip: 'Right sleeve, under the flag.' },
  { id: 'office', label: 'Position patch', emoji: '🎖️', pts: 5, na: true, spot: [81, 40], tip: 'Left sleeve, under the numerals. Mark "doesn\'t apply" if the scout has no position.' },
  { id: 'rank', label: 'Rank patch', emoji: '⭐', pts: 10, spot: [62, 37], tip: 'Centered on the left pocket.' },
  { id: 'crest', label: 'World Crest', emoji: '🌐', pts: 5, spot: [64, 29], tip: 'Above the left pocket, halfway to the shoulder seam.' },
  { id: 'pants', label: 'Pants or shorts', emoji: '👖', pts: 10, spot: [42, 70], tip: 'Uniform pants or shorts (or neat pants the troop allows).' },
  { id: 'belt', label: 'Belt', emoji: '🪢', pts: 5, spot: [50, 55], tip: 'Scout belt, buckle centered.' },
  { id: 'socks', label: 'Socks', emoji: '🧦', pts: 5, spot: [41, 89], tip: 'Uniform socks or plain socks that match.' },
  { id: 'shoes', label: 'Shoes', emoji: '👟', pts: 5, spot: [61, 96], tip: 'Clean, closed-toe, laces tied.' },
];

// Each item is Sharp (full points), Needs a fix (half points), Missing (none), or Doesn't apply (left out).
export const MARKS = {
  good: { label: 'Sharp', short: '✓', share: 1 },
  fix: { label: 'Needs a fix', short: '~', share: 0.5 },
  miss: { label: 'Missing', short: '✗', share: 0 },
  na: { label: 'Doesn\'t apply', short: '–', share: null },
};

// items in play for the troop (leaders can switch optional ones on or off)
export function activeItems(off) {
  const offSet = new Set(off ?? UNIFORM.filter(i => i.off).map(i => i.id));
  return UNIFORM.filter(i => !(i.optional && offSet.has(i.id)));
}

// score 0–100 for one scout
export function scoreOf(marks, items) {
  let got = 0, max = 0;
  for (const it of items) {
    const m = marks?.[it.id] || 'good';
    if (m === 'na' && it.na) continue;
    max += it.pts; got += it.pts * (MARKS[m]?.share ?? 1);
  }
  return max ? Math.round((got / max) * 100) : 0;
}

export const RATINGS = [
  { min: 100, title: 'Inspection Legend', emoji: '🏆', line: 'Perfect. Not a thread out of place!' },
  { min: 90, title: 'Sharp as a Pocketknife', emoji: '🔪', line: 'Looking squared away.' },
  { min: 75, title: 'Squared Away', emoji: '✅', line: 'Solid. A fix or two and you\'re perfect.' },
  { min: 50, title: 'Getting There', emoji: '🧭', line: 'Check the list for what to fix next time.' },
  { min: 0, title: 'Room to Grow', emoji: '🌱', line: 'Every uniform starts somewhere. Ask your patrol for help.' },
];
export const ratingOf = s => RATINGS.find(r => s >= r.min);
