// What kind of outing this is, so each one only shows the tools that fit it.
//   overnight: ends on a later day than it starts (or is a campout or summer/winter camp)
//   indoor:    a one-day meeting, training or fundraiser, with no campsite, meals or packing
const INDOOR = ['meeting', 'training', 'fundraiser'];
const CAMPING = ['campout', 'camp'];

export function outingKind(o = {}) {
  const overnight = !!(o.end && o.start && o.end > o.start) || CAMPING.includes(o.type);
  const indoor = !overnight && INDOOR.includes(o.type);
  return { overnight, indoor, day: !overnight && !indoor };
}

// Which outing tabs make sense: meals, gear and packing for anything outdoors; the campsite duty roster only overnight.
export function outingTabOk(tab, o) {
  const k = outingKind(o);
  if (tab === 'duty') return k.overnight;
  if (['meals', 'gear', 'pack'].includes(tab)) return !k.indoor;
  return true;
}
