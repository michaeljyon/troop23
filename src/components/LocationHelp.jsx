import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Sheet } from './ui.jsx';

// Location for hikes: one button that asks the phone for location, and when
// the phone says no, step-by-step help for that exact phone and browser.
// Websites aren't allowed to open the phone's Settings app, so the help shows
// exactly what to tap, then checks again when the person comes back.
//
// iPhones: every browser there is built on Safari's engine, but each one has
// its own location switch in Settings, Home Screen apps can have their own,
// and links opened inside other apps (texts, email, Facebook…) usually can't
// share location at all. So the help first works out which one this is, and
// lets the person correct it.

const IOS_APPS = {
  safari: 'Safari', installed: 'Basecamp on my Home Screen', chrome: 'Chrome', google: 'Google app', edge: 'Edge', firefox: 'Firefox',
  duckduckgo: 'DuckDuckGo', brave: 'Brave', opera: 'Opera', inapp: 'Inside another app (text, email, Facebook…)',
};
const ANDROID_APPS = {
  chrome: 'Chrome', installed: 'Basecamp on my home screen', samsung: 'Samsung Internet', firefox: 'Firefox', edge: 'Edge', opera: 'Opera',
  brave: 'Brave', duckduckgo: 'DuckDuckGo', google: 'Google app', inapp: 'Inside another app (text, email, Facebook…)',
};
// where each Android browser keeps per-site permissions
const ANDROID_SITE = {
  chrome: { icon: '⚙︎ or 🔒', menu: ['⋮', 'Settings', 'Site settings', 'Location'] },
  brave: { icon: '🔒', menu: ['⋮', 'Settings', 'Site settings', 'Location'] },
  edge: { icon: '🔒', menu: ['⋯', 'Settings', 'Privacy and security', 'Site permissions', 'Location'] },
  opera: { icon: '🔒', menu: ['Opera menu', 'Settings', 'Site settings', 'Location'] },
  samsung: { icon: '🔒', menu: ['≡', 'Settings', 'Sites and downloads', 'Site permissions', 'Location'] },
  firefox: { icon: '🔒', menu: ['⋮', 'Settings', 'Site permissions', 'Location'] },
  duckduckgo: { icon: '', menu: ['⋮', 'Settings', 'Permissions', 'Location'] },
};
const INAPP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|LinkedInApp|Twitter|Pinterest|musical_ly|TikTok|GroupMe|MicroMessenger|Discord|KAKAOTALK|; wv\)/i;

export function device() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const installed = !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
  let browser;
  if (ios) {
    browser = installed ? 'installed' : INAPP.test(ua) ? 'inapp' : /GSA\//.test(ua) ? 'google' : /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge'
      : /DuckDuckGo|Ddg\//.test(ua) ? 'duckduckgo' : /OPT\//.test(ua) ? 'opera' : navigator.brave ? 'brave' : 'safari';
  } else if (android) {
    browser = installed ? 'installed' : INAPP.test(ua) ? 'inapp' : /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox|Focus\//.test(ua) ? 'firefox' : /EdgA\//.test(ua) ? 'edge'
      : /OPR\/|OPX\//.test(ua) ? 'opera' : /DuckDuckGo/.test(ua) ? 'duckduckgo' : /GSA\//.test(ua) ? 'google' : navigator.brave ? 'brave' : 'chrome';
  } else browser = 'desktop';
  const v = /OS (\d+)[._](\d+)/.exec(ua);
  return { os: ios ? 'ios' : android ? 'android' : 'desktop', browser, installed, iosVersion: ios && v ? `${v[1]}.${v[2]}` : '' };
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

let lastResult = null;   // for the details panel
export function askLocation(timeout = 15000) {
  return new Promise(resolve => {
    const done = r => { lastResult = { ...r, at: new Date().toLocaleTimeString() }; resolve(r); };
    if (!('geolocation' in navigator)) return done({ ok: false, code: 0, msg: 'No location support in this browser' });
    navigator.geolocation.getCurrentPosition(
      p => done({ ok: true, acc: p.coords.accuracy }),
      e => done({ ok: false, code: e.code, msg: e.message }),
      { enableHighAccuracy: true, maximumAge: 0, timeout },
    );
  });
}

const Path = ({ items }) => <span className="tap-path">{items.map((t, i) => <span key={i}>{i > 0 && <Icon name="chevronR" size={13} />}<b>{t}</b></span>)}</span>;
const HOST = typeof location !== 'undefined' ? location.host : 'this site';
const SITE = typeof location !== 'undefined' ? `${location.origin}/` : '';

function CopyLink() {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(SITE); setDone(true); }
    catch { window.prompt('Copy this link:', SITE); }
  }
  return <button type="button" className="btn small secondary loc-copy" onClick={copy}><Icon name={done ? 'check' : 'copy'} size={15} />{done ? 'Link copied — paste it in Safari' : 'Copy the Basecamp link'}</button>;
}

// Steps for a phone + browser. problem: 'blocked' | 'off' | 'precise'
function steps(os, app, problem) {
  const s = [];
  const precise = { t: 'Turn on Precise Location', d: null };
  if (os === 'ios') {
    if (problem === 'off') s.push({ t: 'Turn on Location Services', mock: { app: 'Settings', path: ['Privacy & Security', 'Location Services'], toggle: 'Location Services' }, d: <>Open the <b>Settings</b> app and tap <Path items={['Privacy & Security', 'Location Services']} />. Turn the top switch <b>on</b>.</> });
    if (app === 'inapp') {
      s.push({ t: 'Open Basecamp in Safari', mock: { app: 'Facebook, Gmail, Messages…', path: ['⋯', 'Open in Safari'] }, quick: true, d: <>You're in another app's built-in browser, and those usually can't share location. Tap <b className="glyph">⋯</b> or the share button and choose <b>Open in Safari</b> (or <b>Open in browser</b>). Or copy the link and paste it into Safari:<br /><CopyLink /></> });
      s.push({ t: 'Sign in and try again', d: <>In Safari, sign in with your personal code, open <b>Hikes</b>, and tap <b>Turn on location</b>. Then tap <b>Allow</b>.</> });
      return s;
    }
    if (app === 'safari') {
      s.push({ t: 'Let websites ask for location', quick: true, mock: { app: 'Settings', path: ['Privacy & Security', 'Location Services', 'Safari Websites'], options: ['Never', 'Ask Next Time', 'While Using the App'], pick: 'While Using the App', toggle: 'Precise Location' }, d: <>Open the <b>Settings</b> app and tap <Path items={['Privacy & Security', 'Location Services', 'Safari Websites']} />. Choose <b>While Using the App</b> (not <b>Never</b>) and turn on <b>Precise Location</b>. This switch is the most common reason it doesn't work.</> });
      s.push({ t: 'Let Safari allow this site', mock: { app: 'Settings', path: ['Apps', 'Safari', 'Location'], options: ['Ask', 'Deny', 'Allow'], pick: 'Allow' }, d: <>Still in <b>Settings</b>, go back and tap <Path items={['Apps', 'Safari', 'Location']} /> and choose <b>Ask</b> or <b>Allow</b>. <span className="muted">(On older iPhones: <Path items={['Safari', 'Location']} /> right in Settings.)</span></> });
      s.push({ t: 'Or fix it from the page', mock: { app: 'Safari', path: ['⋯', 'Website Settings', 'Location'], options: ['Ask', 'Deny', 'Allow'], pick: 'Allow' }, d: <>Back in Safari, tap <b className="glyph">⋯</b> (bottom right) or the page button to the left of the web address. If you don't see <b>Website Settings</b>, tap <b>More</b> and scroll down. Then <Path items={['Website Settings', 'Location']} /> and choose <b>Allow</b>.</> });
      s.push({ t: 'Reload and allow', d: <>Come back to Basecamp and tap <b>Reload and try again</b> below. Tap <b>Allow</b> when your iPhone asks.</> });
    } else if (app === 'installed') {
      s.push({ t: 'Find Basecamp in Settings', quick: true, mock: { app: 'Settings', path: ['Apps', 'Basecamp', 'Location'], options: ['Never', 'Ask Next Time', 'While Using the App'], pick: 'While Using the App', toggle: 'Precise Location' }, d: <>Open the <b>Settings</b> app, tap <b>Apps</b> and look for <b>Basecamp</b> in the list. If it's there, tap <Path items={['Basecamp', 'Location']} />, choose <b>While Using the App</b> and turn on <b>Precise Location</b>.</> });
      s.push({ t: 'If Basecamp isn\'t listed', mock: { app: 'Settings', path: ['Privacy & Security', 'Location Services', 'Safari Websites'], options: ['Never', 'Ask Next Time', 'While Using the App'], pick: 'While Using the App', toggle: 'Precise Location' }, d: <>Tap <Path items={['Privacy & Security', 'Location Services', 'Safari Websites']} /> instead. Choose <b>While Using the App</b> and turn on <b>Precise Location</b>.</> });
      s.push({ t: 'Close and reopen Basecamp', d: <>Swipe up from the bottom and hold to see your open apps, swipe Basecamp away, then open it again from your Home Screen. Tap <b>Turn on location</b> and <b>Allow</b>.</> });
      s.push({ t: 'Still stuck? Use Safari for hikes', d: <>Some iPhones won't share location with Home Screen apps. Recording works the same in Safari: copy the link, open Safari, paste it, and sign in with your personal code.<br /><CopyLink /></> });
    } else {
      const name = IOS_APPS[app] === 'Google app' ? 'Google' : IOS_APPS[app];
      s.push({ t: `Let ${name} use your location`, quick: true, mock: { app: 'Settings', path: ['Privacy & Security', 'Location Services', name], options: ['Never', 'Ask Next Time', 'While Using the App'], pick: 'While Using the App', toggle: 'Precise Location' }, d: <>Open the <b>Settings</b> app and tap <Path items={['Privacy & Security', 'Location Services', name]} />. Choose <b>While Using the App</b> (not <b>Never</b> or <b>Ask Next Time</b>) and turn on <b>Precise Location</b>.</> });
      s.push({ t: 'Reload and allow', d: <>Come back to {name}, tap <b>Reload and try again</b> below, and tap <b>Allow</b> when {name} asks to use your location.</> });
      s.push({ t: 'Still stuck? Use Safari', d: <>Safari is the most reliable browser on iPhone for hikes. Copy the link, open Safari, paste it, and sign in with your personal code.<br /><CopyLink /></> });
    }
    if (problem === 'precise') s.unshift({ ...precise, d: <>In <b>Settings</b>, tap <Path items={['Privacy & Security', 'Location Services', app === 'safari' || app === 'installed' ? 'Safari Websites' : (IOS_APPS[app] || 'your browser')]} /> and turn on <b>Precise Location</b>. Without it, hikes are off by a mile or more.</> });
  } else if (os === 'android') {
    if (problem === 'off') s.push({ t: 'Turn on your phone\'s location', mock: { app: 'Quick settings (swipe down)', path: [], tiles: true }, d: <>Swipe down from the top of the screen and tap the <b>Location</b> tile so it lights up. (Or open <Path items={['Settings', 'Location']} /> and turn on <b>Use location</b>.)</> });
    if (app === 'inapp') {
      s.push({ t: 'Open Basecamp in your browser', quick: true, mock: { app: 'Facebook, Gmail, Messages…', path: ['⋮', 'Open in Chrome'] }, d: <>You're in another app's built-in browser, and those usually can't share location. Tap <b className="glyph">⋮</b> and choose <b>Open in Chrome</b> (or <b>Open in browser</b>). Or copy the link and paste it into Chrome:<br /><CopyLink /></> });
      s.push({ t: 'Sign in and try again', d: <>Sign in with your personal code, open <b>Hikes</b>, tap <b>Turn on location</b>, then <b>Allow</b>.</> });
      return s;
    }
    const appName = app === 'installed' ? 'Chrome' : app === 'google' ? 'Google' : ANDROID_APPS[app] || 'Chrome';
    if (app === 'google') {
      s.push({ t: 'Let the Google app use location', quick: true, mock: { app: 'Settings', path: ['Apps', 'Google', 'Permissions', 'Location'], options: ['Allow all the time', 'Allow only while using the app', 'Ask every time', 'Don\'t allow'], pick: 'Allow only while using the app', toggle: 'Use precise location' }, d: <>Open the phone's <Path items={['Settings', 'Apps', 'Google', 'Permissions', 'Location']} /> and choose <b>Allow only while using the app</b>. Turn on <b>Use precise location</b>.</> });
      s.push({ t: 'Or open it in Chrome', d: <>Chrome is more reliable for hikes. Tap <b className="glyph">⋮</b> and choose <b>Open in Chrome</b>, or copy the link:<br /><CopyLink /></> });
    } else {
      const site = ANDROID_SITE[app === 'installed' ? 'chrome' : app] || ANDROID_SITE.chrome;
      if (app === 'installed') s.push({ t: 'Basecamp uses Chrome\'s settings', quick: true, d: <>Apps added to the home screen get their location permission from <b>Chrome</b>. Open the <b>Chrome</b> app and follow the next step. (If you added Basecamp from Samsung Internet or another browser, tap <b>Not right? Change</b> above and pick that browser.)</> });
      else s.push({ t: `Allow this site in ${appName}`, quick: true, mock: { app: appName, path: [site.icon ? site.icon.split(' ').pop() : '🔒', 'Permissions', 'Location'], toggle: 'Location' }, d: <>Tap the small icon on the left of the web address{site.icon ? <> (<b className="glyph">{site.icon}</b>)</> : ''}, then <b>Permissions</b> (or <b>Site settings</b>), and turn <b>Location</b> on.</> });
      s.push({ t: `Or in ${appName}'s settings`, mock: { app: appName, path: [...site.menu, HOST], options: ['Allow', 'Block'], pick: 'Allow' }, d: <>In <b>{appName}</b>, tap <Path items={site.menu} />. Make sure sites are allowed to ask. If <b>{HOST}</b> is listed as blocked, tap it and choose <b>Allow</b>.</> });
    }
    if (app !== 'google') s.push({ t: `Let ${appName} use location`, mock: { app: 'Settings', path: ['Apps', appName, 'Permissions', 'Location'], options: ['Allow all the time', 'Allow only while using the app', 'Ask every time', 'Don\'t allow'], pick: 'Allow only while using the app', toggle: 'Use precise location' }, d: <>Open the phone's <Path items={['Settings', 'Apps', appName, 'Permissions', 'Location']} /> and choose <b>Allow only while using the app</b>. Turn on <b>Use precise location</b>. (On Samsung phones, <b>Apps</b> is the same place.)</> });
    s.push({ t: 'Reload and allow', d: <>Come back and tap <b>Reload and try again</b>. Tap <b>Allow</b> if it asks.</> });
    if (problem === 'precise') s.unshift({ ...precise, d: <>Open <Path items={['Settings', 'Apps', appName, 'Permissions', 'Location']} /> and turn on <b>Use precise location</b>.</> });
  } else {
    s.push({ t: 'Allow this site', d: <>Click the icon at the left end of the address bar, find <b>Location</b>, and choose <b>Allow</b>. Then reload the page.</> });
    s.push({ t: 'Best on a phone', d: <>Computers usually guess location from Wi-Fi, so they can't track a hike. Open Basecamp on your phone to record.</> });
  }
  return s;
}

function Details({ here, perm }) {
  const r = lastResult;
  const lines = [
    `Device: ${here.os === 'ios' ? `iPhone/iPad${here.iosVersion ? ` (reports iOS ${here.iosVersion})` : ''}` : here.os === 'android' ? 'Android' : 'Computer'}`,
    `Browser: ${(here.os === 'ios' ? IOS_APPS : ANDROID_APPS)[here.browser] || here.browser}`,
    `Home Screen app: ${here.installed ? 'yes' : 'no'}`,
    `Permission: ${perm}`,
    `Last try: ${r ? (r.ok ? `worked (±${Math.round(r.acc)} m)` : `error ${r.code} ${r.msg || ''}`) : 'not yet'}${r?.at ? ` at ${r.at}` : ''}`,
    `Secure page: ${window.isSecureContext ? 'yes' : 'no'}`,
    `Browser ID: ${navigator.userAgent}`,
  ];
  return (
    <details className="loc-other"><summary>Details for a leader</summary>
      <pre className="loc-diag">{lines.join('\n')}</pre>
      <button type="button" className="link-btn small" onClick={() => navigator.clipboard?.writeText(lines.join('\n'))}><Icon name="copy" size={14} />Copy details</button>
    </details>
  );
}

// A little animated phone that walks through the taps: each screen shows the
// row to tap glowing, then the choice to pick. Plain shapes stand in for the
// other rows, so it matches whatever else is on the person's screen.
export function PhoneMock({ mock, android }) {
  const screens = [];
  let title = mock.app;
  mock.path.forEach(item => { screens.push({ title, tap: item }); title = item; });
  if (mock.options || mock.toggle) screens.push({ title, end: true });
  if (mock.tiles) screens.push({ title: mock.app, tiles: true });
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const t = setInterval(() => setI(x => (x + 1) % (screens.length + 1)), 1500);
    return () => clearInterval(t);
  }, [mock]); // eslint-disable-line react-hooks/exhaustive-deps
  const sc = screens[Math.min(i, screens.length - 1)] || { title: mock.app };
  const done = i >= screens.length - 1;
  const fill = [62, 48, 70, 55, 40];
  return (
    <div className={`phone ${android ? 'android' : ''}`} aria-hidden="true">
      <div className="ph-notch" />
      <div className="ph-top"><span className="ph-back">{sc.title === mock.app ? '' : android ? '←' : '‹'}</span><b>{sc.title}</b></div>
      <div className="ph-body" key={i}>
        {sc.tiles ? (
          <div className="ph-tiles">{['Wi-Fi', 'Bluetooth', 'Location', 'Flashlight', 'Airplane', 'Rotate'].map(t => <span key={t} className={t === 'Location' ? `tap ${done ? 'on' : ''}` : ''}>{t === 'Location' ? <><Icon name="pin" size={16} />Location</> : ''}</span>)}</div>
        ) : sc.end ? (
          <>
            {mock.options && <div className="ph-group">{mock.options.map(o => <div key={o} className={`ph-row opt ${o === mock.pick ? 'pick' : ''}`}><span>{o}</span>{o === mock.pick && <Icon name="check" size={15} strokeWidth={3} />}</div>)}</div>}
            {mock.toggle && <div className="ph-group"><div className={`ph-row ${!mock.options ? 'tap' : ''}`}><span>{mock.toggle}</span><i className="ph-switch on" /></div></div>}
          </>
        ) : (
          <div className="ph-group">
            {fill.slice(0, 2).map((w, k) => <div key={k} className="ph-row ghost"><i style={{ width: `${w}%` }} /></div>)}
            <div className="ph-row tap"><span>{sc.tap}</span><Icon name="chevronR" size={14} /><span className="ph-finger" /></div>
            {fill.slice(2).map((w, k) => <div key={k} className="ph-row ghost"><i style={{ width: `${w}%` }} /></div>)}
          </div>
        )}
      </div>
      <div className="ph-dots">{screens.map((_, k) => <i key={k} className={k === Math.min(i, screens.length - 1) ? 'on' : ''} />)}</div>
    </div>
  );
}

// Before the phone's own question: show what it will look like and which button to tap.
export function LocationPrimer({ open, onGo, onClose }) {
  const d = device();
  const android = d.os === 'android';
  return (
    <Sheet open={open} onClose={onClose} title="One quick question">
      <div className="primer">
        <p className="loc-why">Your {android ? 'phone' : 'iPhone'} will ask if Basecamp can use your location. It's only used to map hikes while you're recording.</p>
        <div className={`fake-dialog ${android ? 'android' : 'ios'}`} aria-hidden="true">
          {android ? (
            <>
              <p className="fd-title"><b>{HOST}</b> wants to<br /><Icon name="pin" size={15} /> Know your location</p>
              <span className="fd-btn hl">While visiting the site<span className="ph-finger" /></span><span className="fd-btn">This time</span><span className="fd-btn">Never allow</span>
            </>
          ) : (
            <>
              <p className="fd-title"><b>“{HOST}”</b> Would Like to Use Your Current Location</p>
              <div className="fd-row"><span className="fd-btn">Don’t Allow</span><span className="fd-btn hl">Allow<span className="ph-finger" /></span></div>
            </>
          )}
        </div>
        <p className="primer-tip"><Icon name="check" size={16} strokeWidth={3} /><span>Tap <b>{android ? 'While visiting the site' : 'Allow'}</b>{android ? '' : <> (or <b>Allow While Using App</b> if it asks that first)</>}.</span></p>
        <button className="btn big" onClick={onGo}>OK, ask me</button>
        <button className="link-btn center-btn" onClick={onClose}>Not now</button>
      </div>
    </Sheet>
  );
}

// Step-by-step help: one step at a time, with the phone showing where to tap.
export function LocationGuide({ open, onClose, problem = 'blocked', onFixed }) {
  const here = device();
  const [os, setOs] = useState(here.os);
  const [app, setApp] = useState(here.browser);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // null | 'ok' | message
  const [step, setStep] = useState(0);
  const [all, setAll] = useState(false);
  const [perm] = useGeoPermission();
  const check = useCallback(async () => {
    setBusy(true); setResult(null);
    const r = await askLocation(12000);
    setBusy(false);
    if (r.ok) { setResult('ok'); onFixed?.(r); }
    else setResult(r.code === 1 ? 'Still blocked. After changing Settings, phones usually need the page reloaded — tap Reload and try again.' : r.code === 2 ? 'Location is still off on the phone. Check the Location Services switch.' : 'No GPS signal yet. Step outside or near a window and try again.');
  }, [onFixed]);
  useEffect(() => {   // back from Settings: check automatically
    if (!open) return undefined;
    const back = () => document.visibilityState === 'visible' && result !== 'ok' && check();
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [open, check, result]);
  useEffect(() => { setStep(0); }, [os, app, problem]);
  function reload() { try { sessionStorage.setItem('loc-recheck', '1'); } catch { /* private mode */ } location.reload(); }
  const apps = os === 'ios' ? IOS_APPS : os === 'android' ? ANDROID_APPS : { desktop: 'Computer browser' };
  const list = steps(os, app, problem);
  const st = list[Math.min(step, list.length - 1)];
  const last = step >= list.length - 1;
  return (
    <Sheet open={open} onClose={onClose} title={result === 'ok' ? 'All set' : 'Turn on location'}>
      {result === 'ok' ? (
        <div className="loc-done">
          <span className="loc-done-ico"><Icon name="check" size={34} strokeWidth={3} /></span>
          <h3>Location is on</h3>
          <p className="muted">You're ready to record hikes.</p>
          <button className="btn big" onClick={onClose}>Continue</button>
        </div>
      ) : (
        <>
          <div className="loc-which">
            <button type="button" className="loc-which-btn" onClick={() => setChoosing(v => !v)} aria-expanded={choosing}>
              <Icon name={os === 'desktop' ? 'globe' : 'phone'} size={17} /><b>{os === 'ios' ? 'iPhone' : os === 'android' ? 'Android' : 'Computer'} · {apps[app] || 'Browser'}</b><span className="link-btn small">{choosing ? 'Done' : 'Not right?'}</span>
            </button>
            {choosing && (
              <div className="loc-pick">
                <div className="seg">{[['ios', 'iPhone'], ['android', 'Android'], ['desktop', 'Computer']].map(([k, l]) => <button key={k} type="button" className={os === k ? 'on' : ''} onClick={() => { setOs(k); setApp(k === here.os ? here.browser : k === 'ios' ? 'safari' : k === 'android' ? 'chrome' : 'desktop'); }}>{l}</button>)}</div>
                {os !== 'desktop' && <><p className="small muted mt">Which app are you using right now?</p><div className="chip-wrap">{Object.entries(apps).map(([k, l]) => <button key={k} type="button" className={`chip sm ${app === k ? 'on' : ''}`} onClick={() => { setApp(k); setChoosing(false); }}>{l}</button>)}</div></>}
              </div>
            )}
          </div>

          {all ? (
            <ol className="loc-steps">{list.map((x, i) => (
              <li key={`${app}-${i}`} className={x.quick ? 'quick' : ''}><span className="loc-n">{i + 1}</span><div><b>{x.t}</b><p>{x.d}</p></div></li>
            ))}</ol>
          ) : st && (
            <div className="wiz" key={`${os}-${app}-${step}`}>
              <div className="wiz-head">
                <span className="wiz-count">Step {step + 1} of {list.length}</span>
                <div className="wiz-bar"><i style={{ width: `${((step + 1) / list.length) * 100}%` }} /></div>
              </div>
              <h3 className="wiz-title">{st.t}</h3>
              {st.mock && <PhoneMock mock={st.mock} android={os === 'android'} />}
              <p className="wiz-text">{st.d}</p>
            </div>
          )}

          {result && <p className="form-msg" role="alert">{result}</p>}
          <div className="sheet-foot loc-foot">
            {!all && !last && (
              <div className="wiz-nav">
                {step > 0 && <button className="btn secondary big" onClick={() => setStep(step - 1)}>Back</button>}
                <button className="btn big" onClick={() => setStep(step + 1)}>Next <Icon name="chevronR" size={18} /></button>
              </div>
            )}
            {(all || last) && <button className="btn big" onClick={check} disabled={busy}>{busy ? <><span className="spinner sm" /> Checking…</> : <><Icon name="refresh" size={18} />Check my location now</>}</button>}
            {(all || last || result) && app !== 'inapp' && <button className="btn secondary big" onClick={reload}>Reload Basecamp and try again</button>}
            <div className="wiz-links">
              <button className="link-btn small" onClick={() => setAll(v => !v)}>{all ? 'One step at a time' : 'See all steps'}</button>
              {!last && !all && <button className="link-btn small" onClick={check}>It's fixed — check now</button>}
            </div>
          </div>
          <p className="small muted loc-note"><Icon name="info" size={14} /> Phones don't let websites open Settings for you, so this shows exactly where to tap. When you come back to Basecamp, it checks again on its own.</p>
          <Details here={here} perm={perm} />
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
  const [primer, setPrimer] = useState(false);
  function start() { if (perm === 'granted') go(); else setPrimer(true); }
  async function go() {
    setPrimer(false);
    setBusy(true);
    const r = await askLocation();
    setBusy(false); setStatus(r);
    if (r.ok) { setPerm('granted'); onReady?.(r); if (r.acc > 500) setGuide('precise'); }
    else if (r.code === 1) { setPerm('denied'); setGuide('blocked'); }
    else if (r.code === 2) setGuide('off');
  }
  useEffect(() => {   // just reloaded from the help sheet: try again right away
    let again = false;
    try { again = sessionStorage.getItem('loc-recheck') === '1'; sessionStorage.removeItem('loc-recheck'); } catch { /* private mode */ }
    if (again) go();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const on = perm === 'granted' || status?.ok;
  const blocked = !status?.ok && (perm === 'denied' || status?.code === 1);
  const ft = status?.acc ? Math.round(status.acc * 3.28) : null;
  return (
    <div className={`loc-card ${on && !blocked ? 'on' : blocked ? 'blocked' : ''} ${compact ? 'compact' : ''}`}>
      <span className="loc-ico"><Icon name={on && !blocked ? 'check' : 'pin'} size={22} strokeWidth={on && !blocked ? 3 : 2} /></span>
      <div className="grow">
        <b>{on && !blocked ? 'Location is on' : blocked ? 'Location is blocked' : 'Location is needed for hikes'}</b>
        <span>{on && !blocked ? (ft ? (ft > 1600 ? 'Only approximate right now. Turn on precise location for accurate hikes.' : `GPS is working · accurate to about ${ft} ft`) : 'Ready to record hikes.')
          : blocked ? 'Your phone said no to Basecamp. Tap Fix it for steps made for your phone.' : status?.code === 2 ? 'Your phone\'s location seems to be off.' : status?.code === 3 ? 'No GPS signal yet. Step outside and try again.' : 'Tap the button, then tap Allow.'}</span>
      </div>
      {on && !blocked ? <button className="btn small secondary" onClick={go} disabled={busy}>{busy ? 'Testing…' : 'Test GPS'}</button>
        : <button className={`btn ${compact ? 'small' : ''} ${blocked ? 'accent' : ''}`} onClick={blocked ? () => setGuide('blocked') : start} disabled={busy}>{busy ? 'Asking…' : blocked ? 'Fix it' : 'Turn on location'}</button>}
      <LocationPrimer open={primer} onGo={go} onClose={() => setPrimer(false)} />
      <LocationGuide open={!!guide} problem={guide || 'blocked'} onClose={() => setGuide(null)} onFixed={r => { setPerm('granted'); setStatus(r); onReady?.(r); }} />
    </div>
  );
}
