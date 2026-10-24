// Meal-plan math: scale recipes to a headcount and build a shopping list.
const UNIT = { each: '', ea: '', pcs: '' };
const norm = s => String(s || '').trim().toLowerCase();

export function scaled(ingredients, serves, people) {
  const f = serves > 0 && people > 0 ? people / serves : 1;
  return (ingredients || []).map(i => ({ ...i, qty: round(i.qty * f, i.unit) }));
}

// Measured units round to the nearest quarter; things you buy whole
// (cans, boxes, eggs, rolls of foil…) round up to a whole number.
const MEASURED = new Set(['lb', 'lbs', 'oz', 'cup', 'cups', 'c', 'tbsp', 'tsp', 'gal', 'qt', 'pt', 'l', 'ml', 'g', 'kg']);
export function round(n, unit) {
  if (!n) return 0;
  if (!MEASURED.has(norm(unit))) return Math.max(1, Math.ceil(n - 0.001));
  if (n >= 10) return Math.ceil(n);
  return Math.ceil(n * 4 - 0.001) / 4;
}

export function fmtQty(i) {
  const q = i.qty ? fraction(i.qty) : '';
  const u = UNIT[norm(i.unit)] ?? i.unit;
  return [q, u].filter(Boolean).join(' ');
}
function fraction(n) {
  const w = Math.floor(n), r = Math.round((n - w) * 4);
  const fr = ['', '¼', '½', '¾'][r] || '';
  return `${w || ''}${fr}` || '0';
}

// meals: [{ id, slot, title, serves, ingredients }], people: number
export function shoppingList(meals, people) {
  const map = new Map();
  for (const m of meals) {
    for (const i of scaled(m.ingredients, m.serves, people)) {
      if (!i.name) continue;
      const key = `${norm(i.name)}|${norm(i.unit)}`;
      const cur = map.get(key) || { key, name: i.name, unit: i.unit, qty: 0, meals: [] };
      cur.qty = round(cur.qty + i.qty, i.unit);
      if (!cur.meals.includes(m.slot)) cur.meals.push(m.slot);
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Does the troop pantry already have this item (and not marked low)?
export function inPantry(pantry, name) {
  const n = norm(name);
  return (pantry || []).find(p => !p.low && (norm(p.name) === n || n.includes(norm(p.name)) || norm(p.name).includes(n)) && norm(p.name).length > 2);
}

export const money = n => `$${(Number(n) || 0).toFixed(2)}`;

// Default meal slots from an outing's dates: arrival-day dinner, full days,
// departure-day breakfast.
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function defaultSlots(start, end) {
  if (!start) return ['Breakfast', 'Lunch', 'Dinner'];
  const d0 = new Date(`${start}T12:00`), d1 = new Date(`${end || start}T12:00`);
  const days = Math.max(0, Math.round((d1 - d0) / 86400000));
  if (days === 0) return [`${DAY[d0.getDay()]} lunch`];
  const out = [];
  for (let i = 0; i <= Math.min(days, 6); i++) {
    const name = DAY[new Date(d0.getTime() + i * 86400000).getDay()];
    if (i === 0) out.push(`${name} dinner`);
    else if (i === days) out.push(`${name} breakfast`);
    else out.push(`${name} breakfast`, `${name} lunch`, `${name} dinner`);
  }
  return out;
}
