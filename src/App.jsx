import Icon from './components/Icon.jsx';
import { Mark } from './components/ui.jsx';
import { useRoute } from './lib/router.js';
import { useLocal, useMe } from './lib/store.js';
import { useEffect, useState } from 'react';
import { useLeaderMode, refreshAccount, api, useAccount } from './lib/api.js';
import { troop } from './lib/config.js';

import Gate from './screens/Gate.jsx';
import Home from './screens/Home.jsx';
import Outings from './screens/Outings.jsx';
import Outing from './screens/Outing.jsx';
import Gear from './screens/Gear.jsx';
import Kitchen from './screens/Kitchen.jsx';
import Snap from './screens/Snap.jsx';
import Gallery from './screens/Gallery.jsx';
import Permission from './screens/Permission.jsx';
import Leaders from './screens/Leaders.jsx';
import Slideshow from './screens/Slideshow.jsx';
import More from './screens/More.jsx';
import Packing from './screens/Packing.jsx';
import Messages, { Thread } from './screens/Messages.jsx';
import Advancement from './screens/Advancement.jsx';

const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'outings', label: 'Outings', icon: 'tent', match: ['outings', 'outing'] },
  { id: 'snap', label: 'Snap', icon: 'camera', big: true },
  { id: 'messages', label: 'Chat', icon: 'message', match: ['messages', 'thread'] },
  { id: 'more', label: 'More', icon: 'grid', match: ['more', 'kitchen', 'gallery', 'permission', 'packing', 'leaders', 'gear', 'advancement'] },
];
const SCREENS = { home: Home, outings: Outings, outing: Outing, gear: Gear, kitchen: Kitchen, snap: Snap, gallery: Gallery, permission: Permission, leaders: Leaders, more: More, packing: Packing, messages: Messages, thread: Thread, advancement: Advancement };

export default function App() {
  const route = useRoute();
  const [code] = useLocal('troop-code', '');
  const [session] = useLocal('session', '');
  const [me] = useMe();
  const acct = useAccount();
  const leader = useLeaderMode();
  const unread = useUnread(!!session);
  const Screen = SCREENS[route.name] || Home;
  const inside = !!session || (!!code && !!me.name.trim());
  useEffect(() => { if (session) refreshAccount(); }, [session]);

  if (route.name === 'join') return <Gate route={route} />;
  if (route.name === 'slideshow' && inside) return <Slideshow route={route} />;
  if (!inside && route.name !== 'leaders') return <Gate />;

  return (
    <div className="app">
      <header className="app-header">
        <a className="header-brand" href="#/" aria-label={`${troop.appName} home`}>
          <Mark size={40} dark />
          <span className="header-text"><span className="header-unit">{troop.unit}</span><span className="header-app">Basecamp</span></span>
        </a>
        <div className="header-right">
          {leader && <a className="leader-chip" href="#/leaders"><Icon name="shield" size={14} />Leader</a>}
          {!acct && session === '' && <span className="guest-chip">Guest</span>}
          <a className="icon-btn on-dark" href="#/snap" aria-label="Share a photo"><Icon name="camera" /></a>
        </div>
      </header>
      <main className="app-main" id="main"><Screen route={route} /></main>
      {inside && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map(tab => {
            const active = (tab.match || [tab.id]).includes(route.name);
            return (
              <a key={tab.id} href={`#/${tab.id === 'home' ? '' : tab.id}`} className={`${active ? 'active' : ''} ${tab.big ? 'big' : ''}`} aria-current={active ? 'page' : undefined}>
                <span className="tab-ico"><Icon name={tab.icon} size={tab.big ? 26 : 22} />{tab.id === 'messages' && unread > 0 && <span className="tab-badge">{unread > 9 ? '9+' : unread}</span>}</span>
                <span>{tab.label}</span>
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}

// Unread conversations, checked every minute while signed in.
function useUnread(on) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) { setN(0); return; }
    let stop = false;
    const load = () => api('threads').then(d => !stop && setN(d.threads.filter(t => t.unread).length)).catch(() => {});
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), 60000);
    addEventListener('threads-read', load);
    return () => { stop = true; clearInterval(id); removeEventListener('threads-read', load); };
  }, [on]);
  return n;
}
