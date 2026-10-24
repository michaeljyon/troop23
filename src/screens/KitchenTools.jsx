import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Section, Progress } from '../components/ui.jsx';
import { api, useApi, useCol, usePatrols, useAccount } from '../lib/api.js';
import { useMe } from '../lib/store.js';
import { troop, slug } from '../lib/config.js';
import { parseRecipe } from '../lib/recipeparse.js';
import { scaled, fmtQty, money, defaultSlots } from '../lib/food.js';
import { today } from '../lib/dates.js';

// ---------------------------------------------------------------- recipe scanner
// Reads a recipe photo right on the phone (nothing is uploaded to read it),
// turns it into ingredients and steps, and scales it for the group.
async function prepImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(async () => {
    const i = new Image(); i.src = URL.createObjectURL(file); await i.decode(); return i;
  });
  const s = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const ctx = c.getContext('2d');
  ctx.filter = 'grayscale(1) contrast(1.35) brightness(1.05)';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return { canvas: c, preview: c.toDataURL('image/jpeg', 0.7) };
}

export function Scan({ RecipeForm, onSaved }) {
  const take = useRef(null), pick = useRef(null);
  const [stage, setStage] = useState('idle'); // idle | reading | review | error
  const [pct, setPct] = useState(0);
  const [preview, setPreview] = useState('');
  const [text, setText] = useState('');
  const [recipe, setRecipe] = useState(null);
  const [people, setPeople] = useState(8);
  const [msg, setMsg] = useState('');
  const book = useApi('pricebook');

  async function read(file) {
    if (!file) return;
    setStage('reading'); setPct(0); setMsg('');
    try {
      const { canvas, preview: pv } = await prepImage(file);
      setPreview(pv);
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', gzip: true,
        logger: m => { if (m.status === 'recognizing text') setPct(Math.round(m.progress * 100)); },
      });
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      setText(data.text);
      const r = parseRecipe(data.text);
      setRecipe(r); setPeople(r.serves || 8);
      setStage('review');
      if (!r.ingredients.length) setMsg('I couldn\'t find ingredient amounts. Try a straighter, closer photo in good light, or fix the text below and tap Read again.');
    } catch (e) { console.error(e); setStage('error'); setMsg('Couldn\'t read that photo. Try again with good light and the recipe filling the frame.'); }
  }
  const est = useMemo(() => estimate(recipe ? scaled(recipe.ingredients, recipe.serves, people) : [], book.data?.book), [recipe, people, book.data]);

  return (
    <>
      <p className="small muted mt">Snap a cookbook page, recipe card or printout. The phone reads it, then you can fix anything, scale it for your group, and save it to the troop's recipes.</p>
      {stage !== 'review' && (
        <div className="scan-box">
          {stage === 'reading' ? (
            <>
              {preview && <img src={preview} alt="" className="scan-preview" />}
              <p><b>Reading the recipe… {pct}%</b></p>
              <Progress value={pct} max={100} label="Reading progress" />
              <p className="small muted">The first scan loads the reader (about 6 MB). After that it's faster.</p>
            </>
          ) : (
            <>
              <Icon name="camera" size={40} />
              <div className="btn-row center-row">
                <button className="btn accent" onClick={() => take.current.click()}><Icon name="camera" size={18} />Take a photo</button>
                <button className="btn secondary" onClick={() => pick.current.click()}><Icon name="image" size={18} />Choose a photo</button>
              </div>
              <p className="small muted">Tips: lay the page flat, fill the frame, avoid shadows.</p>
            </>
          )}
          {msg && stage === 'error' && <p className="form-msg">{msg}</p>}
          <input ref={take} type="file" accept="image/*" capture="environment" hidden onChange={e => { read(e.target.files[0]); e.target.value = ''; }} />
          <input ref={pick} type="file" accept="image/*" hidden onChange={e => { read(e.target.files[0]); e.target.value = ''; }} />
        </div>
      )}
      {stage === 'review' && recipe && (
        <>
          {msg && <p className="form-msg">{msg}</p>}
          <div className="card scale-card">
            <div className="stepper">
              <span>Cooking for</span>
              <button className="icon-btn" onClick={() => setPeople(Math.max(1, people - 1))} aria-label="Fewer people">−</button>
              <b aria-live="polite">{people}</b>
              <button className="icon-btn" onClick={() => setPeople(people + 1)} aria-label="More people">+</button>
            </div>
            <p className="small muted">Recipe makes {recipe.serves}. Here's what to buy for {people}:</p>
            <ul className="ing-list">{scaled(recipe.ingredients, recipe.serves, people).map((i, k) => <li key={k}><span>{i.name}</span><b>{fmtQty(i) || 'to taste'}</b></li>)}</ul>
            {est.priced > 0 && <p className="est-line"><Icon name="dollar" size={16} />About <b>{money(est.total)}</b> ({money(est.total / people)} per person) from {est.priced} remembered price{est.priced > 1 ? 's' : ''}{est.missing ? `; ${est.missing} item${est.missing > 1 ? 's' : ''} not priced yet` : ''}.</p>}
          </div>
          <Section title="Check it and save">
            <RecipeForm key={JSON.stringify(recipe).length + recipe.title} r={{ ...recipe, by: '' }} onSaved={() => { setStage('idle'); setRecipe(null); onSaved?.(); }} />
          </Section>
          <details className="card ocr-text">
            <summary>What the phone read</summary>
            <textarea rows={8} value={text} onChange={e => setText(e.target.value)} />
            <button className="btn small secondary" onClick={() => { const r = parseRecipe(text); setRecipe(r); setPeople(r.serves || people); setMsg(r.ingredients.length ? '' : msg); }}><Icon name="refresh" size={16} />Read again from this text</button>
          </details>
          <button className="link-btn small" onClick={() => { setStage('idle'); setRecipe(null); }}><Icon name="camera" size={15} />Scan a different recipe</button>
        </>
      )}
    </>
  );
}

// Estimate cost from the troop price book (last price paid per item).
export function estimate(items, book) {
  let total = 0, priced = 0, missing = 0;
  for (const i of items) {
    const p = priceFor(i, book);
    if (p != null) { total += p; priced++; } else if (i.qty) missing++;
  }
  return { total, priced, missing };
}
export function priceFor(i, book) {
  const b = book?.[String(i.name || '').toLowerCase()];
  if (!b) return null;
  if (b.qty && b.unit && i.unit && b.unit.toLowerCase() === String(i.unit).toLowerCase()) return Math.round((b.price / b.qty) * i.qty * 100) / 100;
  return b.price;
}

// ---------------------------------------------------------------- budget calculator
const MEALS = [['breakfast', 'Breakfasts'], ['lunch', 'Lunches'], ['dinner', 'Dinners'], ['snack', 'Snacks / desserts']];
export function Budget() {
  const outings = useCol('outings');
  const patrols = usePatrols() || troop.patrols;
  const upcoming = outings.items.filter(o => (o.end || o.start) >= today() && !o.cancelled && ['campout', 'camp', 'hike', 'paddle', 'trip'].includes(o.type));
  const [outingId, setOutingId] = useState('');
  const acct = useAccount();
  const [me] = useMe();
  const [patrol, setPatrol] = useState(acct?.scouts?.[0]?.patrol || me.patrol || patrols[0]);
  const [people, setPeople] = useState(8);
  const [counts, setCounts] = useState({ breakfast: 2, lunch: 1, dinner: 2, snack: 2 });
  const [rates, setRates] = useState(troop.mealCosts);
  const [extras, setExtras] = useState([{ name: 'Ice', amount: 10 }, { name: 'Propane', amount: 0 }]);
  const [plan, setPlan] = useState(null);
  const rsvps = useCol('rsvps', outingId ? { outing: outingId } : { outing: '_none' });

  useEffect(() => {
    const o = outings.items.find(x => x.id === outingId);
    if (!o) { setPlan(null); return; }
    const slots = defaultSlots(o.start, o.end).map(s => s.toLowerCase());
    setCounts({ breakfast: slots.filter(s => s.includes('breakfast')).length, lunch: slots.filter(s => s.includes('lunch')).length, dinner: slots.filter(s => s.includes('dinner')).length, snack: Math.max(1, slots.filter(s => s.includes('dinner')).length) });
    api(`c/plans/${outingId}__${slug(patrol)}`.slice(0, 80)).then(d => setPlan(d.item)).catch(() => setPlan(null));
  }, [outingId, patrol, outings.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!outingId) return;
    const n = rsvps.items.filter(r => r.status === 'yes' && r.patrol === patrol).length;
    if (n) setPeople(plan?.headcount || n);
  }, [rsvps.data, patrol, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const perPerson = MEALS.reduce((n, [k]) => n + (counts[k] || 0) * (rates[k] || 0), 0);
  const food = perPerson * people;
  const extra = extras.reduce((n, e) => n + (Number(e.amount) || 0), 0);
  const total = food + extra;
  const each = people ? total / people : 0;
  const ask = Math.ceil(each / (troop.mealCosts.roundTo || 5)) * (troop.mealCosts.roundTo || 5);
  const spent = (plan?.spend || []).reduce((n, s) => n + s.amount, 0);

  return (
    <>
      <p className="small muted mt">Work out a food budget for a trip and what to collect from each scout.</p>
      <div className="card">
        <label className="field"><span>Trip <i className="opt">optional</i></span>
          <select value={outingId} onChange={e => setOutingId(e.target.value)}><option value="">Just calculating</option>{upcoming.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</select>
        </label>
        {outingId && <label className="field"><span>Patrol</span><select value={patrol} onChange={e => setPatrol(e.target.value)}>{patrols.map(p => <option key={p}>{p}</option>)}</select></label>}
        <div className="stepper">
          <span>People eating</span>
          <button className="icon-btn" onClick={() => setPeople(Math.max(1, people - 1))} aria-label="Fewer people">−</button>
          <b>{people}</b>
          <button className="icon-btn" onClick={() => setPeople(people + 1)} aria-label="More people">+</button>
        </div>
        <table className="calc">
          <thead><tr><th>Meals</th><th>How many</th><th>$ per person</th><th>Cost</th></tr></thead>
          <tbody>
            {MEALS.map(([k, l]) => (
              <tr key={k}>
                <td>{l}</td>
                <td><input type="number" min="0" inputMode="numeric" value={counts[k]} onChange={e => setCounts({ ...counts, [k]: +e.target.value || 0 })} aria-label={`Number of ${l}`} /></td>
                <td><input type="number" min="0" step="0.25" inputMode="decimal" value={rates[k]} onChange={e => setRates({ ...rates, [k]: +e.target.value || 0 })} aria-label={`Dollars per person for each of ${l}`} /></td>
                <td>{money((counts[k] || 0) * (rates[k] || 0) * people)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="field-label mt">Extras for the group</p>
        {extras.map((x, i) => (
          <div className="row-input" key={i}>
            <input value={x.name} onChange={e => setExtras(extras.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} aria-label="Extra" placeholder="Campsite fee, ice…" />
            <input className="money-in" type="number" min="0" step="0.5" value={x.amount} onChange={e => setExtras(extras.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} aria-label="Amount" />
            <button className="icon-btn sm" onClick={() => setExtras(extras.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="x" size={16} /></button>
          </div>
        ))}
        <button className="link-btn small" onClick={() => setExtras([...extras, { name: '', amount: 0 }])}><Icon name="plus" size={14} />Add an extra</button>
      </div>
      <div className="card budget-result">
        <div className="money-row">
          <div><span>Food</span><b>{money(food)}</b><em>{money(perPerson)} per person</em></div>
          <div><span>Total</span><b>{money(total)}</b><em>with {money(extra)} extras</em></div>
          <div><span>Per scout</span><b>{money(each)}</b><em>Collect {money(ask)}</em></div>
        </div>
        {plan && <>
          <p className="small">Spent so far by {patrol}: <b>{money(spent)}</b> of {money(total)} ({total ? Math.round(100 * spent / total) : 0}%)</p>
          <Progress value={spent} max={total || 1} label="Spent so far" />
          <p className="small muted">Set this patrol's budget on the trip's Meals tab to {money(perPerson)} per person so the shopping list tracks against it.</p>
        </>}
      </div>
      <PriceBook />
    </>
  );
}

function PriceBook() {
  const book = useApi('pricebook');
  const items = Object.entries(book.data?.book || {}).sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <Section title={`Troop price book · ${items.length}`}>
      {items.length === 0 ? <p className="small muted">When grubmasters type prices into a trip's shopping list, they're remembered here and used to estimate future trips.</p> : (
        <ul className="badge-list">{items.map(([name, p]) => <li key={name}><span>{name.replace(/^./, c => c.toUpperCase())}</span><span className="muted small">{money(p.price)}{p.qty ? ` for ${p.qty} ${p.unit}` : ''} · {new Date(p.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span></li>)}</ul>
      )}
    </Section>
  );
}
