// Turn the text read from a recipe photo into { title, serves, ingredients, steps }.
// Works with cookbook pages, recipe cards, printouts and handwritten-ish cards
// that OCR reasonably well. Everything stays editable before saving.
const FRAC = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
const UNITS = [
  [/^(cups?|c\.?)$/i, 'cups'], [/^(tablespoons?|tbsps?\.?|tbs\.?|T)$/, 'tbsp'], [/^(teaspoons?|tsps?\.?|t)$/, 'tsp'],
  [/^(pounds?|lbs?\.?|Ibs?\.?|1bs?\.?)$/i, 'lb'], [/^(ounces?|oz\.?)$/i, 'oz'], [/^(cans?|tins?)$/i, 'can'], [/^jars?$/i, 'jar'],
  [/^(packages?|pkgs?\.?)$/i, 'package'], [/^(packets?|envelopes?)$/i, 'packet'], [/^(boxes|box)$/i, 'box'], [/^bags?$/i, 'bag'],
  [/^cloves?$/i, 'cloves'], [/^sticks?$/i, 'stick'], [/^slices?$/i, 'slices'], [/^dozen$/i, 'dozen'], [/^(gallons?|gal\.?)$/i, 'gal'],
  [/^(quarts?|qts?\.?)$/i, 'qt'], [/^(pints?|pts?\.?)$/i, 'pt'], [/^(bottles?)$/i, 'bottle'], [/^(loaf|loaves)$/i, 'loaf'], [/^(heads?)$/i, 'head'],
  [/^(bunch(es)?)$/i, 'bunch'], [/^(pinch(es)?|dash(es)?)$/i, 'pinch'], [/^(grams?|g)$/i, 'g'], [/^(kilograms?|kg)$/i, 'kg'], [/^(ml|milliliters?)$/i, 'ml'], [/^(liters?|l)$/i, 'l'],
];
const QTY = String.raw`(\d+\s+\d+\/\d+|\d+\/\d+|\d+[¼½¾⅓⅔⅛]|\d*\.\d+|\d+|[¼½¾⅓⅔⅛⅜⅝⅞])`;
const ING_RX = new RegExp(`^${QTY}(?:\\s*(?:-|–|to)\\s*${QTY})?\\s*(.*)$`, 'i');

export function parseQty(s) {
  s = String(s || '').trim();
  if (!s) return 0;
  if (FRAC[s] != null) return FRAC[s];
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3];
  m = s.match(/^(\d)(\d)\/([2348])$/); if (m && +m[2] < +m[3]) return +m[1] + m[2] / m[3];   // OCR often drops the space in "1 1/2"
  m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2];
  m = s.match(/^(\d+)([¼½¾⅓⅔⅛])$/); if (m) return +m[1] + FRAC[m[2]];
  return Number(s) || 0;
}
const unitOf = w => { for (const [rx, u] of UNITS) if (rx.test(w)) return u; return null; };
const fixOcr = l => l
  .replace(/^[\s•·*\-–—▪◦o>]+(?=\S)/, '')            // bullets
  .replace(/\b[Il|](?=\s*(cup|tbsp|tsp|lb|oz|can|egg|tablespoon|teaspoon|pound|ounce)s?\b)/gi, '1') // "I cup" → "1 cup"
  .replace(/(\d)\s*\/\s*(\d)/g, '$1/$2')
  .replace(/\s{2,}/g, ' ').trim();

export function parseIngredient(line) {
  const l = fixOcr(line);
  const m = l.match(ING_RX);
  if (!m) return null;
  let qty = parseQty(m[1]);
  if (m[2]) qty = Math.max(qty, parseQty(m[2]));  // "2-3 cups" → plan for the larger amount
  let rest = m[3].replace(/^[\s.,)-]+/, '');
  let unit = '';
  const w = rest.split(/\s+/);
  const size = /^(large|medium|small|lg|med|sm)$/i.test(w[0]) ? w.shift() : '';
  const u = w[0] && unitOf(w[0].replace(/[.,]$/, ''));
  if (u) { unit = u; w.shift(); if (/^of$/i.test(w[0])) w.shift(); }
  else if (w[0] && /^\(([\d.]+\s*-?\s*(oz|ounce|lb)s?)\)$/i.test(w[0] + (w[1] ? ` ${w[1]}` : ''))) { /* "(15 oz)" sizes stay in the name */ }
  let name = [size, ...w].filter(Boolean).join(' ').replace(/\s*,\s*$/, '').replace(/^\(([^)]*)\)\s*(.+)$/, '$2 ($1)').replace(/^[^\w(]+/, '');
  if (!name || name.length < 2) return null;
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return { name: name.slice(0, 60), qty: Math.round(qty * 100) / 100, unit: unit || 'each' };
}

export function parseRecipe(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let title = '', serves = 0, mode = 'auto';
  const ingredients = [], steps = [], notes = [];
  for (const raw of lines) {
    const line = fixOcr(raw);
    const low = line.toLowerCase();
    const sv = low.match(/\b(serves|servings?|makes|yield|yields|feeds)\b[:\s-]*(?:about\s*)?(\d+)/);
    if (sv) { serves = +sv[2]; if (line.length < 40) continue; }
    if (/^(ingredients?|what you need|you will need|shopping list)\b:?$/i.test(line)) { mode = 'ing'; continue; }
    if (/^(directions?|instructions?|method|preparation|steps?|how to make( it)?|to make)\b:?$/i.test(line)) { mode = 'steps'; continue; }
    if (/^(notes?|tips?)\b:?$/i.test(line)) { mode = 'notes'; continue; }
    const numbered = line.match(/^(?:step\s*)?(\d{1,2})[.)]\s+(.{8,})$/i);
    const ing = !numbered && mode !== 'steps' && mode !== 'notes' ? parseIngredient(line) : null;
    if (ing && line.length < 90) { ingredients.push(ing); if (mode === 'auto') mode = 'ing-auto'; continue; }
    if (mode === 'ing' && !numbered && line.length < 50 && !/[.!?]$/.test(line)) {
      const nm = line.replace(/,?\s*(to taste|as needed|optional)\s*$/i, m => ` (${m.replace(/^,?\s*/, '').trim()})`);
      ingredients.push({ name: nm.charAt(0).toUpperCase() + nm.slice(1, 60), qty: 0, unit: '' }); continue;
    }
    if (!title && mode === 'auto' && line.length >= 3 && line.length <= 60 && !/^\d/.test(line) && !/(prep|cook|total)\s*time/i.test(line)) { title = titleCase(line); continue; }
    if (/(prep|cook|total|bake)\s*time|^(calories|nutrition)/i.test(line)) continue;
    if (mode === 'notes') { notes.push(line); continue; }
    if (numbered) { steps.push(numbered[2]); mode = 'steps'; continue; }
    if (mode === 'steps' || mode === 'ing-auto' || ingredients.length) {
      // join wrapped lines onto the previous step unless it ended a sentence and this starts a new one
      if (steps.length && !/[.!?]$/.test(steps[steps.length - 1])) steps[steps.length - 1] += ` ${line}`;
      else if (line.length > 3) steps.push(line);
      if (mode !== 'steps') mode = 'steps';
    }
  }
  return {
    title: title || 'Scanned recipe', serves: serves || 4, ingredients: dedupe(ingredients),
    steps: steps.map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 3).slice(0, 30), notes: notes.join(' ').slice(0, 500),
    meal: guessMeal(`${title} ${steps.join(' ')}`),
  };
}
function dedupe(list) {
  const seen = new Map();
  for (const i of list) { const k = `${i.name.toLowerCase()}|${i.unit}`; if (seen.has(k)) seen.get(k).qty += i.qty; else seen.set(k, { ...i }); }
  return [...seen.values()];
}
const titleCase = s => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(And|Or|Of|The|With|A|In|On)\b/g, w => w.toLowerCase()).replace(/^./, c => c.toUpperCase());
function guessMeal(t) {
  const s = t.toLowerCase();
  if (/pancake|breakfast|egg|bacon|oatmeal|french toast|biscuit|sausage gravy|waffle/.test(s)) return 'breakfast';
  if (/cobbler|cake|cookie|s'more|brownie|dessert|pie|crisp|banana boat/.test(s)) return 'dessert';
  if (/sandwich|wrap|lunch|quesadilla|salad/.test(s)) return 'lunch';
  if (/cocoa|cider|drink|lemonade/.test(s)) return 'drink';
  return 'dinner';
}
