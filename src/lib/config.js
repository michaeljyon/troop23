import troop from '../../troop/troop.js';

export { troop };
export const t = s => String(s ?? '').replaceAll('{unit}', troop.unit).replaceAll('{year}', troop.year).replaceAll('{place}', troop.place);
export const level = id => troop.consentLevels.find(l => l.id === id);
export const outingType = id => troop.outingTypes.find(x => x.id === id) || troop.outingTypes[troop.outingTypes.length - 1];
export const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'x';

export function applyTheme() {
  const r = document.documentElement.style;
  r.setProperty('--primary', troop.colors.primary);
  r.setProperty('--primary-dark', troop.colors.primaryDark);
  r.setProperty('--accent', troop.colors.accent);
  r.setProperty('--accent-ink', troop.colors.accentInk);
  r.setProperty('--khaki', troop.colors.khaki);
}
