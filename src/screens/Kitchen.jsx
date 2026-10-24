import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Pill } from '../components/ui.jsx';
import { IngredientRows } from './Meals.jsx';
import { useCol, saveDoc, deleteDoc, useLeaderMode } from '../lib/api.js';
import { rid } from '../lib/config.js';
import { useMe } from '../lib/store.js';
import { scaled, fmtQty } from '../lib/food.js';
import { go } from '../lib/router.js';

const MEALS = [['', 'All'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['dessert', 'Dessert'], ['snack', 'Snack'], ['drink', 'Drink']];
const EMOJI = { breakfast: '🍳', lunch: '🌯', dinner: '🍲', dessert: '🍑', snack: '🥨', drink: '☕' };

export default function Kitchen({ route }) {
  const tab = route.query.tab || 'recipes';
  return (
    <div className="content">
      <PageHead backTo="more" title="Troop kitchen" sub="Recipes that work at camp, and what's in the troop pantry." />
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'recipes'} className={tab === 'recipes' ? 'on' : ''} onClick={() => go('kitchen')}>Recipes</button>
        <button role="tab" aria-selected={tab === 'pantry'} className={tab === 'pantry' ? 'on' : ''} onClick={() => go('kitchen?tab=pantry')}>Pantry</button>
      </div>
      {tab === 'recipes' ? <Recipes /> : <Pantry />}
    </div>
  );
}

function Recipes() {
  const recipes = useCol('recipes');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const list = recipes.items.filter(r => (!type || r.meal === type) && (!q || `${r.title} ${r.method}`.toLowerCase().includes(q.toLowerCase())));
  const current = open && recipes.items.find(r => r.id === open);
  return (
    <>
      <div className="search-row mt"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search recipes" aria-label="Search recipes" /></div>
      <div className="chip-scroll">{MEALS.map(([k, l]) => <button key={k} className={`chip ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>{l}</button>)}</div>
      {recipes.loading && !recipes.data ? <p className="muted">Loading…</p> : (
        <ul className="recipe-cards">
          {list.map(r => (
            <li key={r.id}><button className="recipe-card" onClick={() => setOpen(r.id)}>
              <span className="rc-emoji" aria-hidden="true">{EMOJI[r.meal] || '🍽️'}</span>
              <span className="grow"><b>{r.title}</b><span className="small muted">{r.method} · serves {r.serves} · {r.ingredients.length} ingredients</span></span>
              <Icon name="chevronR" size={18} />
            </button></li>
          ))}
          {list.length === 0 && <Empty icon="pot" title="No recipes match" />}
        </ul>
      )}
      <button className="btn secondary" onClick={() => setEdit({})}><Icon name="plus" size={18} />Add a recipe</button>
      <Sheet open={!!current} onClose={() => setOpen(null)} title={current?.title || ''} wide>
        {current && <RecipeView r={current} onEdit={() => { setEdit(current); setOpen(null); }} onDeleted={() => { setOpen(null); recipes.refresh(); }} />}
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit recipe' : 'New recipe'} wide>
        {edit && <RecipeForm r={edit} onSaved={() => { setEdit(null); recipes.refresh(); }} />}
      </Sheet>
    </>
  );
}

function RecipeView({ r, onEdit, onDeleted }) {
  const [n, setN] = useState(r.serves || 8);
  const leader = useLeaderMode();
  return (
    <div>
      <p className="recipe-meta"><Pill>{r.meal}</Pill><Pill>{r.method}</Pill>{r.builtIn && <Pill tone="good">Troop classic</Pill>}{r.by && <span className="small muted">Added by {r.by}</span>}</p>
      <div className="stepper">
        <span>Servings</span>
        <button className="icon-btn" onClick={() => setN(Math.max(1, n - 1))} aria-label="Fewer servings">−</button>
        <b aria-live="polite">{n}</b>
        <button className="icon-btn" onClick={() => setN(n + 1)} aria-label="More servings">+</button>
      </div>
      <Section title="Ingredients"><ul className="ing-list">{scaled(r.ingredients, r.serves, n).map((i, k) => <li key={k}><span>{i.name}</span><b>{fmtQty(i)}</b></li>)}</ul></Section>
      {r.steps?.length > 0 && <Section title="Steps"><ol className="steps">{r.steps.map((s, k) => <li key={k}>{s}</li>)}</ol></Section>}
      {r.notes && <p className="gear-notes">{r.notes}</p>}
      <div className="btn-row">
        <button className="btn secondary small" onClick={onEdit}><Icon name="edit" size={16} />Edit</button>
        {leader && !r.builtIn && <button className="link-btn danger small" onClick={async () => { if (confirm(`Delete ${r.title}?`)) { await deleteDoc('recipes', r.id); onDeleted(); } }}><Icon name="trash" size={15} />Delete</button>}
      </div>
      <p className="small muted">Plan this recipe into a trip from an outing's Meals tab.</p>
    </div>
  );
}

function RecipeForm({ r, onSaved }) {
  const [me] = useMe();
  const [f, setF] = useState({ title: '', meal: 'dinner', method: 'Stove', serves: 8, notes: '', ...r, ingredients: (r.ingredients || [{ name: '', qty: 1, unit: '' }]).map(i => ({ ...i })), stepsText: (r.steps || []).join('\n') });
  const [msg, setMsg] = useState('');
  const setIng = (i, patch) => setF({ ...f, ingredients: f.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  async function save(e) {
    e.preventDefault(); setMsg('');
    const { stepsText, builtIn, ...doc } = f;
    try { await saveDoc('recipes', r.id || `r-${rid()}`, { ...doc, by: r.by || me.name, ingredients: f.ingredients.filter(i => i.name.trim()), steps: stepsText.split('\n').map(s => s.trim()).filter(Boolean) }, me.name); onSaved(); }
    catch (err) { setMsg(err.message); }
  }
  return (
    <form onSubmit={save}>
      <label className="field"><span>Recipe name</span><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} required /></label>
      <div className="two-col">
        <label className="field"><span>Meal</span><select value={f.meal} onChange={e => setF({ ...f, meal: e.target.value })}>{MEALS.slice(1).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field"><span>Cooked on</span><input value={f.method} onChange={e => setF({ ...f, method: e.target.value })} list="methods" /></label>
        <label className="field"><span>Serves</span><input type="number" min="1" value={f.serves} onChange={e => setF({ ...f, serves: +e.target.value || 1 })} /></label>
      </div>
      <datalist id="methods">{['Stove', 'Griddle', 'Dutch oven', 'Coals', 'Campfire', 'No cook'].map(m => <option key={m} value={m} />)}</datalist>
      <IngredientRows rows={f.ingredients} setIng={setIng} add={() => setF({ ...f, ingredients: [...f.ingredients, { name: '', qty: 1, unit: '' }] })} remove={i => setF({ ...f, ingredients: f.ingredients.filter((_, j) => j !== i) })} />
      <label className="field"><span>Steps <i className="opt">one per line</i></span><textarea rows={5} value={f.stepsText} onChange={e => setF({ ...f, stepsText: e.target.value })} /></label>
      <label className="field"><span>Tips <i className="opt">optional</i></span><input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
      {r.builtIn && <p className="small muted">Saving changes this troop classic for everyone.</p>}
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn">Save recipe</button>
    </form>
  );
}

function Pantry() {
  const [me] = useMe();
  const pantry = useCol('pantry');
  const [f, setF] = useState({ name: '', qty: '', unit: '', location: '' });
  const [msg, setMsg] = useState('');
  const low = pantry.items.filter(p => p.low);
  async function add(e) {
    e.preventDefault(); setMsg('');
    try { await saveDoc('pantry', `p-${rid()}`, { ...f, qty: +f.qty || 0, low: false }, me.name); setF({ name: '', qty: '', unit: '', location: f.location }); pantry.refresh(); }
    catch (err) { setMsg(err.message); }
  }
  const upd = async (p, patch) => { await saveDoc('pantry', p.id, { ...p, ...patch }, me.name); pantry.refresh(); };
  const locs = [...new Set(pantry.items.map(p => p.location || 'Pantry'))];
  return (
    <>
      <p className="small muted mt">Staples the troop keeps between trips (patrol boxes, the trailer, the closet). Mark items low so the next grubmaster picks them up. Meal-plan shopping lists show what the pantry already has.</p>
      {low.length > 0 && <div className="alert-card warm static"><span className="alert-ico"><Icon name="basket" size={22} /></span><span className="grow"><b>Running low: {low.length}</b><span>{low.map(p => p.name).join(', ')}</span></span></div>}
      <form className="card pantry-add" onSubmit={add}>
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Item (e.g. Cooking oil)" aria-label="Item" required />
        <input type="number" min="0" step="0.25" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} placeholder="Qty" aria-label="Quantity" />
        <input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} placeholder="Unit" aria-label="Unit" list="units2" />
        <input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Where" aria-label="Where" list="locs" />
        <button className="btn small"><Icon name="plus" size={16} />Add</button>
        <datalist id="units2">{['bottle', 'box', 'bag', 'can', 'jar', 'roll', 'lb', 'oz', 'each'].map(u => <option key={u} value={u} />)}</datalist>
        <datalist id="locs">{locs.map(l => <option key={l} value={l} />)}</datalist>
      </form>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      {pantry.loading && !pantry.data ? <p className="muted">Loading…</p> : pantry.items.length === 0 ? <Empty icon="basket" title="Pantry is empty">Add salt, oil, foil, spices, trash bags, dish soap…</Empty> : (
        locs.map(l => (
          <Section key={l} title={l}>
            <ul className="pantry">{pantry.items.filter(p => (p.location || 'Pantry') === l).map(p => (
              <li key={p.id} className={p.low ? 'low' : ''}>
                <span className="grow"><b>{p.name}</b><span className="small muted">{p.qty ? `${p.qty} ${p.unit}` : ''}</span></span>
                <button className={`chip sm ${p.low ? 'on warn' : ''}`} onClick={() => upd(p, { low: !p.low })} aria-pressed={p.low}>{p.low ? 'Low' : 'Mark low'}</button>
                <button className="icon-btn sm" onClick={async () => { if (confirm(`Remove ${p.name}?`)) { await deleteDoc('pantry', p.id); pantry.refresh(); } }} aria-label={`Remove ${p.name}`}><Icon name="trash" size={16} /></button>
              </li>
            ))}</ul>
          </Section>
        ))
      )}
    </>
  );
}
