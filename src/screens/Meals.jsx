import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Section, Empty, Sheet, Progress } from '../components/ui.jsx';
import { api, saveDoc, useCol, usePatrols, useApi } from '../lib/api.js';
import { priceFor } from './KitchenTools.jsx';
import { troop, rid, slug } from '../lib/config.js';
import { useMe } from '../lib/store.js';
import { defaultSlots, scaled, shoppingList, fmtQty, inPantry, money } from '../lib/food.js';

// Patrol meal planning for one outing: menu, shopping list, budget and duty
// roster. One plan per patrol, saved for the whole troop to see.
export default function Meals({ outing, rsvps }) {
  const [me] = useMe();
  const patrols = usePatrols() || troop.patrols;
  const [patrol, setPatrol] = useState(me.patrol && patrols.includes(me.patrol) ? me.patrol : patrols[0]);
  const planId = `${outing.id}__${slug(patrol)}`.slice(0, 80);
  const [plan, setPlan] = useState(undefined);
  const [msg, setMsg] = useState('');
  const recipes = useCol('recipes');
  const pantry = useCol('pantry');

  const load = () => api(`c/plans/${planId}`).then(d => setPlan(d.item)).catch(e => setPlan(e.status === 404 ? null : undefined));
  useEffect(() => { setPlan(undefined); load(); }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

  const going = rsvps.filter(r => r.status === 'yes' && r.patrol === patrol);
  const people = plan?.headcount || going.length || 0;

  // Save shortly after the last change so typing doesn't send a request per key.
  const timer = useRef(null), version = useRef(0);
  async function push(next, v) {
    try { const { checks, spend, duties, ...doc } = next; const r = await saveDoc('plans', planId, doc, me.name); if (v === version.current) setPlan(r.item); }
    catch (e) { setMsg(e.message); load(); }
  }
  function save(next, { now = false } = {}) {
    setPlan(next); setMsg('');
    const v = ++version.current;
    clearTimeout(timer.current);
    if (now) return push(next, v);
    timer.current = setTimeout(() => push(next, v), 700);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  async function start() {
    const meals = defaultSlots(outing.start, outing.end).map(slot => ({ id: rid(), slot, title: '', recipeId: '', serves: 0, ingredients: [], notes: '' }));
    await save({ outingId: outing.id, patrol, grubmaster: me.patrol === patrol ? me.name : '', headcount: 0, budget: 0, meals, checks: {}, spend: [], duties: null }, { now: true });
  }

  return (
    <>
      <div className="chip-scroll" role="radiogroup" aria-label="Patrol">
        {patrols.map(p => <button key={p} role="radio" aria-checked={patrol === p} className={`chip ${patrol === p ? 'on' : ''}`} onClick={() => setPatrol(p)}>{p}</button>)}
      </div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      {plan === undefined ? <p className="muted pad-top">Loading…</p>
        : plan === null ? (
          <Empty icon="pot" title={`No meal plan for ${patrol} yet`} action={<button className="btn" onClick={start}><Icon name="plus" size={18} />Start the meal plan</button>}>
            We'll set up meal slots from the outing dates. Pick recipes, and the shopping list builds itself for {going.length || 'your'} {going.length === 1 ? 'person' : 'people'}.
          </Empty>
        ) : (
          <PlanView outing={outing} plan={plan} save={save} setLocal={setPlan} reload={load} people={people} going={going} recipes={recipes.items} pantry={pantry.items} patrol={patrol} />
        )}
    </>
  );
}

function PlanView({ outing, plan, save, setLocal, reload, people, going, recipes, pantry, patrol }) {
  const [me] = useMe();
  const [editMeal, setEditMeal] = useState(null);
  const list = useMemo(() => shoppingList(plan.meals.filter(m => m.ingredients?.length), people), [plan.meals, people]);
  const bought = list.filter(i => plan.checks?.[i.key]).length;
  const book = useApi('pricebook');
  const priceOf = i => plan.prices?.[i.key] ?? null;
  const suggest = i => priceFor(i, book.data?.book);
  const estTotal = list.reduce((n, i) => n + (priceOf(i) ?? suggest(i) ?? 0), 0);
  const unpriced = list.filter(i => priceOf(i) == null && suggest(i) == null).length;
  async function setPrice(i, v) {
    const price = Number(v) || 0;
    setLocal({ ...plan, prices: { ...(plan.prices || {}), [i.key]: price || undefined } });
    await api(`plans/${plan.id}/price`, { method: 'POST', body: { key: i.key, price, name: i.name, unit: i.unit, qty: i.qty } }).catch(() => {});
  }
  const spent = (plan.spend || []).reduce((n, s) => n + s.amount, 0);
  const budgetTotal = (plan.budget || 0) * people;
  const planned = plan.meals.filter(m => m.title).length;

  async function toggle(key, on) {
    const checks = { ...plan.checks }; if (on) checks[key] = me.name; else delete checks[key];
    setLocal({ ...plan, checks });
    await api(`plans/${plan.id}/check`, { method: 'POST', body: { key, on, by: me.name } }).catch(() => {});
  }
  function copyList() {
    const txt = [`${troop.unit} · ${patrol} · ${outing.title}`, `Shopping for ${people}`, '', ...list.map(i => `${plan.checks?.[i.key] ? '☑' : '☐'} ${i.name} — ${fmtQty(i)}`)].join('\n');
    navigator.clipboard?.writeText(txt).then(() => alert('Shopping list copied. Paste it into a text or notes app.')).catch(() => {});
  }

  return (
    <>
      <div className="plan-summary card">
        <label className="ps-item"><span>Grubmaster</span><input value={plan.grubmaster} onChange={e => save({ ...plan, grubmaster: e.target.value })} placeholder="Who's shopping?" /></label>
        <label className="ps-item"><span>Eating</span>
          <span className="ps-num"><input type="number" min="0" inputMode="numeric" value={plan.headcount || ''} placeholder={String(going.length)} onChange={e => save({ ...plan, headcount: +e.target.value || 0 })} aria-describedby="hc-note" /> people</span>
        </label>
        <label className="ps-item"><span>Budget</span><span className="ps-num">$<input type="number" min="0" step="0.5" inputMode="decimal" value={plan.budget || ''} placeholder="0" onChange={e => save({ ...plan, budget: +e.target.value || 0 })} /> each</span></label>
        <p className="small muted ps-note" id="hc-note">{plan.headcount ? `Set by hand. Leave blank to use sign-ups (${going.length} going).` : `From sign-ups: ${going.length} going from ${patrol}.`}</p>
      </div>

      <Section title="Menu" action={<span className="small muted">{planned}/{plan.meals.length} planned</span>}>
        <ul className="menu">
          {plan.meals.map(m => (
            <li key={m.id}>
              <button className={`meal ${m.title ? '' : 'empty'}`} onClick={() => setEditMeal(m)}>
                <span className="meal-slot">{m.slot}</span>
                <span className="meal-title">{m.title || 'Tap to pick a recipe'}</span>
                {m.title && m.ingredients?.length > 0 && <span className="meal-sub">{m.ingredients.length} ingredients · scaled for {people || '—'}</span>}
                <Icon name="chevronR" size={18} />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn secondary small" onClick={() => setEditMeal({ id: rid(), slot: '', title: '', recipeId: '', serves: 0, ingredients: [], notes: '', isNew: true })}><Icon name="plus" size={16} />Add a meal</button>
      </Section>

      <Section title="Shopping list" action={list.length > 0 && <button className="link-btn small" onClick={copyList}><Icon name="copy" size={15} />Copy</button>}>
        {list.length === 0 ? <p className="muted small">Pick recipes for the menu and the list fills in here, scaled for {people || 'your'} {people === 1 ? 'person' : 'people'}.</p> : (
          <div className="card">
            <div className="shop-head"><span><b>{bought}</b> of {list.length} in the cart</span><Progress value={bought} max={list.length} label="Shopping progress" /></div>
            <div className={`est-bar ${budgetTotal && estTotal > budgetTotal ? 'over' : ''}`}>
              <span><Icon name="dollar" size={16} />Estimated <b>{money(estTotal)}</b>{people ? ` · ${money(estTotal / people)} each` : ''}</span>
              <span>{budgetTotal ? (estTotal > budgetTotal ? `${money(estTotal - budgetTotal)} over budget` : `${money(budgetTotal - estTotal)} under budget`) : 'Set a budget above'}</span>
            </div>
            {unpriced > 0 && <p className="small muted">{unpriced} item{unpriced > 1 ? 's have' : ' has'} no price yet. Type what it costs, and the troop price book remembers it for next time.</p>}
            <ul className="shop">
              {list.map(i => {
                const pan = inPantry(pantry, i.name);
                return (
                  <li key={i.key} className={plan.checks?.[i.key] ? 'done' : ''}>
                    <label>
                      <input type="checkbox" checked={!!plan.checks?.[i.key]} onChange={e => toggle(i.key, e.target.checked)} />
                      <span className="grow"><span className="shop-name">{i.name}</span><span className="shop-for">{i.meals.join(', ')}</span></span>
                      <span className="shop-qty">{fmtQty(i)}</span>
                    </label>
                    <label className="price-in" onClick={e => e.stopPropagation()}><span>$</span><input type="number" min="0" step="0.01" inputMode="decimal" defaultValue={priceOf(i) ?? ''} placeholder={suggest(i) != null ? suggest(i).toFixed(2) : '0.00'} onBlur={e => { const v = e.target.value; if ((Number(v) || 0) !== (priceOf(i) || 0)) setPrice(i, v); }} aria-label={`Price for ${i.name}`} /></label>
                    {pan && <span className="pantry-hint"><Icon name="basket" size={13} />Troop pantry has {pan.name.toLowerCase()}{pan.qty ? ` (${pan.qty} ${pan.unit})` : ''}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Section>

      <Budget plan={plan} reload={reload} people={people} spent={spent} budgetTotal={budgetTotal} />
      <Duties plan={plan} reload={reload} going={going} />

      <MealSheet meal={editMeal} recipes={recipes} people={people}
        onClose={() => setEditMeal(null)}
        onSave={m => { const { isNew, ...meal } = m; save({ ...plan, meals: isNew ? [...plan.meals, meal] : plan.meals.map(x => (x.id === meal.id ? meal : x)) }, { now: true }); setEditMeal(null); }}
        onRemove={m => { save({ ...plan, meals: plan.meals.filter(x => x.id !== m.id) }, { now: true }); setEditMeal(null); }} />
    </>
  );
}

function Budget({ plan, reload, people, spent, budgetTotal }) {
  const [me] = useMe();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  async function add(e) {
    e.preventDefault(); setMsg('');
    try { await api(`plans/${plan.id}/spend`, { method: 'POST', body: { amount: +amount, note, by: me.name } }); setAmount(''); setNote(''); reload(); }
    catch (err) { setMsg(err.message); }
  }
  async function del(s) { if (confirm(`Remove ${money(s.amount)}${s.note ? ` (${s.note})` : ''}?`)) { await api(`plans/${plan.id}/spend/${s.id}`, { method: 'DELETE' }); reload(); } }
  const left = budgetTotal - spent;
  return (
    <Section title="Food budget">
      <div className="card">
        <div className="money-row">
          <div><span>Budget</span><b>{budgetTotal ? money(budgetTotal) : '—'}</b><em>{plan.budget ? `${money(plan.budget)} × ${people}` : 'Set $ each above'}</em></div>
          <div><span>Spent</span><b>{money(spent)}</b><em>{people ? `${money(spent / people)} per person` : ''}</em></div>
          <div className={left < 0 ? 'over' : ''}><span>{left < 0 ? 'Over' : 'Left'}</span><b>{budgetTotal ? money(Math.abs(left)) : '—'}</b></div>
        </div>
        {budgetTotal > 0 && <Progress value={spent} max={budgetTotal} label="Budget used" />}
        {(plan.spend || []).length > 0 && (
          <ul className="spend">{plan.spend.map(s => <li key={s.id}><span className="grow">{s.note || 'Receipt'}<span className="small muted"> · {s.by}</span></span><b>{money(s.amount)}</b><button className="icon-btn sm" onClick={() => del(s)} aria-label="Remove"><Icon name="x" size={16} /></button></li>)}</ul>
        )}
        <form className="spend-form" onSubmit={add}>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="$ amount" aria-label="Amount" />
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Store / note" aria-label="Note" />
          <button className="btn small" disabled={!+amount}>Add receipt</button>
        </form>
        {msg && <p className="form-msg" role="alert">{msg}</p>}
      </div>
    </Section>
  );
}

function Duties({ plan, reload, going }) {
  const roles = plan.duties?.roles || troop.dutyRoles;
  const names = going.filter(r => r.role === 'scout').map(r => r.name);
  const grid = plan.duties?.grid || {};
  const [busy, setBusy] = useState(false);
  async function saveGrid(next) { await api(`plans/${plan.id}/duties`, { method: 'POST', body: { roles, grid: next } }); reload(); }
  async function build(shuffle) {
    if (!names.length) return;
    setBusy(true);
    const pool = shuffle ? [...names].sort(() => Math.random() - 0.5) : names;
    const next = {};
    plan.meals.forEach((m, i) => { next[m.id] = Object.fromEntries(roles.map((r, j) => [r, pool[(i + j) % pool.length]])); });
    await saveGrid(next); setBusy(false);
  }
  const has = Object.keys(grid).length > 0;
  return (
    <Section title="Duty roster" action={has && <button className="link-btn small" onClick={() => build(true)} disabled={busy}><Icon name="refresh" size={15} />Shuffle</button>}>
      {!names.length ? <p className="muted small">Once scouts from this patrol sign up as Going, build a roster that rotates {roles.join(', ').toLowerCase()} across every meal.</p>
        : !has ? <button className="btn secondary" onClick={() => build(false)} disabled={busy}><Icon name="users" size={18} />Build roster for {names.length} scout{names.length > 1 ? 's' : ''}</button>
        : (
          <div className="duties">
            {plan.meals.map(m => (
              <div key={m.id} className="duty card">
                <p className="duty-slot">{m.slot}{m.title && <span> · {m.title}</span>}</p>
                <dl>{roles.map(r => (
                  <div key={r}><dt>{r}</dt><dd>
                    <select value={grid[m.id]?.[r] || ''} onChange={e => saveGrid({ ...grid, [m.id]: { ...(grid[m.id] || {}), [r]: e.target.value } })} aria-label={`${r} for ${m.slot}`}>
                      <option value="">—</option>{names.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </dd></div>
                ))}</dl>
              </div>
            ))}
          </div>
        )}
    </Section>
  );
}

function MealSheet({ meal, recipes, people, onClose, onSave, onRemove }) {
  return (
    <Sheet open={!!meal} onClose={onClose} title={meal?.isNew ? 'Add a meal' : meal?.slot || 'Meal'} wide>
      {meal && <MealFields meal={meal} recipes={recipes} people={people} onSave={onSave} onRemove={onRemove} />}
    </Sheet>
  );
}

function MealFields({ meal, recipes, people, onSave, onRemove }) {
  const [m, setM] = useState({ ...meal, ingredients: meal.ingredients.map(i => ({ ...i })) });
  const [mode, setMode] = useState(meal.title && !meal.recipeId ? 'custom' : 'pick');
  const [q, setQ] = useState('');
  const [type, setType] = useState(guessType(meal.slot));
  const shown = recipes.filter(r => (!type || r.meal === type) && (!q || r.title.toLowerCase().includes(q.toLowerCase())));
  const pick = r => setM({ ...m, recipeId: r.id, title: r.title, serves: r.serves, ingredients: r.ingredients.map(i => ({ ...i })) });
  const setIng = (i, patch) => setM({ ...m, ingredients: m.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div>
      <label className="field"><span>Meal</span><input value={m.slot} onChange={e => setM({ ...m, slot: e.target.value })} placeholder="e.g. Sat dinner" /></label>
      <div className="seg" role="tablist">
        <button type="button" className={mode === 'pick' ? 'on' : ''} onClick={() => setMode('pick')}>From recipes</button>
        <button type="button" className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>Write my own</button>
      </div>
      {mode === 'pick' ? (
        <>
          <div className="chip-scroll mt">
            {[['', 'All'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['dessert', 'Dessert'], ['snack', 'Snack']].map(([k, l]) => <button key={k} type="button" className={`chip ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>{l}</button>)}
          </div>
          <input className="tag-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search recipes" aria-label="Search recipes" />
          <ul className="recipe-pick">
            {shown.map(r => (
              <li key={r.id}><button type="button" className={m.recipeId === r.id ? 'on' : ''} onClick={() => pick(r)}>
                <span className="grow"><b>{r.title}</b><span className="small muted">{r.method} · serves {r.serves}</span></span>
                {m.recipeId === r.id && <Icon name="check" size={18} strokeWidth={2.6} />}
              </button></li>
            ))}
            {shown.length === 0 && <li className="muted small">No recipes match. Add one in the Kitchen.</li>}
          </ul>
        </>
      ) : (
        <>
          <div className="two-col">
            <label className="field"><span>Dish</span><input value={m.title} onChange={e => setM({ ...m, title: e.target.value, recipeId: '' })} placeholder="e.g. Hot dogs & chips" /></label>
            <label className="field"><span>Ingredients feed</span><input type="number" min="1" value={m.serves || ''} onChange={e => setM({ ...m, serves: +e.target.value || 0 })} placeholder="8" /></label>
          </div>
          <IngredientRows rows={m.ingredients} setIng={setIng} add={() => setM({ ...m, ingredients: [...m.ingredients, { name: '', qty: 1, unit: '' }] })} remove={i => setM({ ...m, ingredients: m.ingredients.filter((_, j) => j !== i) })} />
        </>
      )}
      {m.title && m.ingredients.length > 0 && (
        <div className="scaled-box">
          <p className="small"><b>For {people || m.serves} {people === 1 ? 'person' : 'people'}</b>{people ? '' : ' (no headcount yet)'}</p>
          <ul>{scaled(m.ingredients, m.serves, people || m.serves).map((i, k) => <li key={k}><span>{i.name}</span><b>{fmtQty(i)}</b></li>)}</ul>
        </div>
      )}
      <label className="field"><span>Notes <i className="opt">optional</i></span><input value={m.notes} onChange={e => setM({ ...m, notes: e.target.value })} placeholder="Allergies, who brings the dutch oven…" /></label>
      <div className="btn-row">
        <button className="btn" disabled={!m.slot.trim()} onClick={() => onSave({ ...m, ingredients: m.ingredients.filter(i => i.name.trim()) })}>Save meal</button>
        {!meal.isNew && <button className="link-btn danger" onClick={() => onRemove(meal)}><Icon name="trash" size={16} />Remove meal</button>}
      </div>
    </div>
  );
}

export function IngredientRows({ rows, setIng, add, remove }) {
  return (
    <div className="ing-rows">
      <p className="field-label">Ingredients</p>
      {rows.map((r, i) => (
        <div className="ing-row" key={i}>
          <input value={r.name} onChange={e => setIng(i, { name: e.target.value })} placeholder="Ingredient" aria-label="Ingredient" />
          <input type="number" min="0" step="0.25" inputMode="decimal" value={r.qty || ''} onChange={e => setIng(i, { qty: +e.target.value || 0 })} placeholder="Qty" aria-label="Quantity" />
          <input value={r.unit} onChange={e => setIng(i, { unit: e.target.value })} placeholder="Unit" aria-label="Unit" list="units" />
          <button type="button" className="icon-btn sm" onClick={() => remove(i)} aria-label="Remove ingredient"><Icon name="x" size={16} /></button>
        </div>
      ))}
      <datalist id="units">{['each', 'lb', 'oz', 'cups', 'tbsp', 'tsp', 'can', 'jar', 'box', 'bag', 'packet', 'gal', 'dozen', 'loaf', 'bottle', 'slices'].map(u => <option key={u} value={u} />)}</datalist>
      <button type="button" className="link-btn small" onClick={add}><Icon name="plus" size={15} />Add ingredient</button>
    </div>
  );
}

function guessType(slot = '') {
  const s = slot.toLowerCase();
  return ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'].find(t => s.includes(t)) || '';
}
