import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Sheet } from './ui.jsx';

// Location for hikes: one button that asks the phone for location, and when
// the phone says no, step-by-step help written for that exact phone and
// browser. Websites aren't allowed to open the phone's Settings app
// themselves, so the help shows exactly what to tap, then checks again by
// itself when the person comes back to Basecamp.

export function device() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const installed = matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  let browser = 'safari';
  if (ios) browser = /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : 'safari';
  else if (android) browser = /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox/.test(ua) ? 'firefox' : 'chrome';
  else browser = 'desktop';
  return { os: ios ? 'ios' : android ? 'android' : 'desktop', browser, installed };
}

// permission state where the browser shares it ('granted' | 'prompt' | 'denied' | 'unknown')
export function useGeoPermission() {
  const [state, setState] = useState('unknown');
  useEffect(() => {
    let status = null, gone = false;
    const set = () => !gone && status && setState(status.state);
    navigator.permissions?.query({ name: 'geolocation' }).then(s => { status = s; set(); s.onchange = set; }).catch(() => {});
    return () => { gone = true; if (status) status.onchange = null; };
  }, []);
  return [state, setState];
}

// ask for one reading; resolves { ok, acc, code }
export function askLocation(timeout = 15000) {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve({ ok: false, code: 0 });
    navigator.geolocation.getCurrentPosition(
      p => resolve({ ok: true, acc: p.coords.accuracy }),
      e => resolve({ ok: false, code: e.code }),
      { enableHighAccuracy: true, maximumAge: 0, timeout },
    );
  });
}

const Path = ({ items }) => <span className="tap-path">{items.map((t, i) => <span key={i}>{i > 0 && <Icon name="chevronR" size={13} />}<b>{t}</b></span>)}</span>;
const HOST = typeof location !== 'undefined' ? location.host : 'this site';

// The steps for each phone. "problem": 'blocked' (said no), 'off' (phone's location off), 'precise' (approximate only)
function steps(d, problem) {
  const s = [];
  if (d.os === 'ios') {
    if (problem === 'off') s.push({ t: 'Turn on Location Services', d: <>Open the <b>Settings</b> app, then tap <Path items={['Privacy & Security', 'Location Services']} /> and turn the top switch <b>on</b>.</> });
    if (d.browser === 'chrome' || d.browser === 'firefox' || d.browser === 'edge') {
      const name = { chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge' }[d.browser];
      s.push({ t: `Let ${name} use location`, d: <>In <b>Settings</b>, tap <Path items={['Privacy & Security', 'Location Services', name]} /> and choose <b>While Using the App</b>. Turn on <b>Precise Location</b>.</> });
      s.push({ t: 'Allow this site', d: <>Come back to {name}, tap <b>Check again</b> below, and tap <b>Allow</b> when it asks.</> });
    } else {
      if (!d.installed && problem !== 'off') s.push({ t: 'Quickest fix: the page menu', d: <>In Safari, tap the page menu next to the web address (it looks like <b className="glyph">aA</b> or <b className="glyph">⋯</b>), then <Path items={['Website Settings', 'Location']} /> and choose <b>Allow</b>.</>, quick: true });
      s.push({ t: 'Let websites use location', d: <>Open the <b>Settings</b> app and tap <Path items={['Privacy & Security', 'Location Services', 'Safari Websites']} />. Choose <b>While Using the App</b> and turn on <b>Precise Location</b>.</> });
      s.push({ t: 'Let Safari ask', d: <>Still in <b>Settings</b>, tap <Path items={['Apps', 'Safari', 'Location']} /> and choose <b>Ask</b> or <b>Allow</b>. <span className="muted">(On older iPhones it's <Path items={['Safari', 'Location']} /> right in Settings.)</span></> });
      s.push({ t: 'Come back and allow', d: <>Switch back to Basecamp. Tap <b>Check again</b> below, then <b>Allow</b> if your iPhone asks.</> });
    }
    if (problem === 'precise') s.unshift({ t: 'Turn on Precise Location', d: <>In <b>Settings</b>, tap <Path items={['Privacy & Security', 'Location Services', d.browser === 'safari' ? 'Safari Websites' : 'Chrome']} /> and turn on <b>Precise Location</b>. Without it, hikes are off by a mile or more.</> });
  } else if (d.os === 'android') {
    if (problem === 'off') s.push({ t: 'Turn on your phone\'s location', d: <>Swipe down from the top of the screen and tap the <b>Location</b> tile so it lights up. (Or open <Path items={['Settings', 'Location']} /> and turn on <b>Use location</b>.)</> });
    if (d.browser === 'samsung') {
      s.push({ t: 'Allow this site', d: <>In Samsung Internet, tap the icon left of the web address, then <b>Permissions</b> (or <Path items={['☰', 'Settings', 'Sites and downloads', 'Site permissions', 'Location']} />) and allow <b>{HOST}</b>.</> });
    } else if (d.browser === 'firefox') {
      s.push({ t: 'Allow this site', d: <>In Firefox, tap the lock icon left of the web address, then turn on <b>Location</b> for this site.</> });
    } else {
      if (!d.installed && problem !== 'off') s.push({ t: 'Quickest fix: the icon by the address', d: <>Tap the small icon on the left side of the web address (<b className="glyph">⚙︎</b> or a lock), then <Path items={['Permissions', 'Location']} /> and turn it <b>on</b>.</>, quick: true });
      s.push({ t: 'Allow this site in Chrome', d: <>Open <b>Chrome</b> and tap <Path items={['⋮', 'Settings', 'Site settings', 'Location']} />. Make sure <b>Sites can ask</b> is on. If <b>{HOST}</b> is under <b>Not allowed</b>, tap it and choose <b>Allow</b>.</> });
    }
    const app = d.browser === 'samsung' ? 'Samsung Internet' : d.browser === 'firefox' ? 'Firefox' : 'Chrome';
    s.push({ t: `Let ${app} use location`, d: <>Open the phone's <Path items={['Settings', 'Apps', app, 'Permissions', 'Location']} /> and choose <b>Allow only while using the app</b>. Turn on <b>Use precise location</b>.</> });
    s.push({ t: 'Come back and allow', d: <>Switch back to Basecamp and tap <b>Check again</b>. Tap <b>Allow</b> if it asks.</> });
    if (problem === 'precise') s.unshift({ t: 'Turn on precise location', d: <>Open <Path items={['Settings', 'Apps', app, 'Permissions', 'Location']} /> and turn on <b>Use precise location</b>.</> });
  } else {
    s.push({ t: 'Allow this site', d: <>Click the icon at the left end of the address bar, find <b>Location</b>, and choose <b>Allow</b>. Then reload the page.</> });
    s.push({ t: 'Best on a phone', d: <>Computers usually guess location from Wi-Fi, so they can't track a hike. Open Basecamp on your phone to record.</> });
  }
  return s;
}
const label = d => (d.os === 'ios' ? `iPhone · ${d.installed ? 'Home Screen app' : { safari: 'Safari', chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge' }[d.browser]}`
  : d.os === 'android' ? `Android · ${d.installed ? 'installed app' : { chrome: 'Chrome', samsung: 'Samsung Internet', firefox: 'Firefox' }[d.browser]}` : 'Computer');

// Step-by-step help sheet. Checks again whenever the person comes back.
export function LocationGuide({ open, onClose, problem = 'blocked', onFixed }) {
  const here = device();
  const [pick, setPick] = useState(here.os);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // null | 'ok' | message
  const d = pick === here.os ? here : { os: pick, browser: pick === 'ios' ? 'safari' : pick === 'android' ? 'chrome' : 'desktop', installed: false };
  const check = useCallback(async () => {
    setBusy(true); setResult(null);
    const r = await askLocation(12000);
    setBusy(false);
    if (r.ok) { setResult('ok'); onFixed?.(r); }
    else setResult(r.code === 1 ? 'Still blocked. Go through the steps again, then come back.' : r.code === 2 ? 'Location is still off on the phone. Check step 1.' : 'No GPS signal yet. Step outside or near a window and try again.');
  }, [onFixed]);
  useEffect(() => {   // coming back from Settings: check automatically
    if (!open) return undefined;
    const back = () => document.visibilityState === 'visible' && result !== 'ok' && check();
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [open, check, result]);
  const list = steps(d, problem);
  return (
    <Sheet open={open} onClose={onClose} title="Turn on location">
      {result === 'ok' ? (
        <div className="loc-done">
          <span className="loc-done-ico"><Icon name="check" size={34} strokeWidth={3} /></span>
          <h3>Location is on</h3>
          <p className="muted">You're all set to record hikes.</p>
          <button className="btn big" onClick={onClose}>Continue</button>
        </div>
      ) : (
        <>
          <p className="loc-why">Basecamp needs your location to map the trail and measure distance. It's only used while you're recording a hike.</p>
          <div className="loc-for"><Icon name={d.os === 'desktop' ? 'globe' : 'phone'} size={16} />Steps for <b>{label(d)}</b></div>
          <ol className="loc-steps">{list.map((st, i) => (
            <li key={i} className={st.quick ? 'quick' : ''}>
              <span className="loc-n">{i + 1}</span>
              <div><b>{st.t}</b>{st.quick && <span className="loc-quick">Try this first</span>}<p>{st.d}</p></div>
            </li>
          ))}</ol>
          <p className="small muted loc-note"><Icon name="info" size={14} /> Phones don't let websites open Settings for you, so these steps show exactly where to tap. When you come back to Basecamp, it checks again on its own.</p>
          <details className="loc-other"><summary>Different phone?</summary>
            <div className="seg mt">{[['ios', 'iPhone'], ['android', 'Android'], ['desktop', 'Computer']].map(([k, l]) => <button key={k} type="button" className={pick === k ? 'on' : ''} onClick={() => setPick(k)}>{l}</button>)}</div>
          </details>
          {result && <p className="form-msg" role="alert">{result}</p>}
          <div className="sheet-foot"><button className="btn big" onClick={check} disabled={busy}>{busy ? <><span className="spinner sm" /> Checking…</> : <><Icon name="refresh" size={18} />I did it — check again</>}</button></div>
        </>
      )}
    </Sheet>
  );
}

// The card: shows whether location is ready, with one obvious button.
export function LocationCheck({ compact = false, onReady }) {
  const [perm, setPerm] = useGeoPermission();
  const [status, setStatus] = useState(null);    // { ok, acc, code }
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(null);       // problem type or null
  async function go() {
    setBusy(true);
    const r = await askLocation();
    setBusy(false); setStatus(r);
    if (r.ok) { setPerm('granted'); onReady?.(r); if (r.acc > 500) setGuide('precise'); }
    else if (r.code === 1) { setPerm('denied'); setGuide('blocked'); }
    else if (r.code === 2) setGuide('off');
  }
  const on = perm === 'granted' || status?.ok;
  const blocked = perm === 'denied' || status?.code === 1;
  const ft = status?.acc ? Math.round(status.acc * 3.28) : null;
  return (
    <div className={`loc-card ${on ? 'on' : blocked ? 'blocked' : ''} ${compact ? 'compact' : ''}`}>
      <span className="loc-ico"><Icon name={on ? 'check' : 'pin'} size={22} strokeWidth={on ? 3 : 2} /></span>
      <div className="grow">
        <b>{on ? 'Location is on' : blocked ? 'Location is blocked' : 'Location is needed for hikes'}</b>
        <span>{on ? (ft ? (ft > 1600 ? 'Only approximate right now. Turn on precise location for accurate hikes.' : `GPS is working · accurate to about ${ft} ft`) : 'Ready to record hikes.')
          : blocked ? 'Your phone said no to Basecamp. Two minutes to fix.' : status?.code === 2 ? 'Your phone\'s location seems to be off.' : status?.code === 3 ? 'No GPS signal yet. Step outside and try again.' : 'Tap the button, then tap Allow.'}</span>
      </div>
      {on ? <button className="btn small secondary" onClick={go} disabled={busy}>{busy ? 'Testing…' : 'Test GPS'}</button>
        : <button className={`btn ${compact ? 'small' : ''} ${blocked ? 'accent' : ''}`} onClick={blocked ? () => setGuide('blocked') : go} disabled={busy}>{busy ? 'Asking…' : blocked ? 'Fix it' : 'Turn on location'}</button>}
      <LocationGuide open={!!guide} problem={guide || 'blocked'} onClose={() => setGuide(null)} onFixed={r => { setPerm('granted'); setStatus(r); onReady?.(r); }} />
    </div>
  );
}
