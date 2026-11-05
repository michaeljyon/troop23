import Icon from './components/Icon.jsx';
import { Mark, Empty } from './components/ui.jsx';
import { useSettings, ROUTE_FEATURE } from './lib/features.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { useRoute } from './lib/router.js';
import { useLocal, useMe } from './lib/store.js';
import { useEffect, lazy, Suspense } from 'react';
import { useLeaderMode, refreshAccount, useAccount, isDemo } from './lib/api.js';
import { troop } from './lib/config.js';
import { useInbox } from './lib/inbox.js';
import { WelcomeBack } from './components/Inbox.jsx';

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
import Counselors from './screens/Counselors.jsx';
import Hikes, { Track } from './screens/Hikes.jsx';
const Notes = lazy(() => import('./screens/Notes.jsx'));
const Campfire = lazy(() => import('./screens/Campfire.jsx'));
const Ceremonies = lazy(() => import('./screens/Ceremonies.jsx'));
const Knots = lazy(() => import('./screens/Knots.jsx'));
const Points = lazy(() => import('./screens/Points.jsx'));
const Hunts = lazy(() => import('./screens/Hunts.jsx'));
const NightSky = lazy(() => import('./screens/NightSky.jsx'));
const Coh = lazy(() => import('./screens/Coh.jsx'));
const Safety = lazy(() => import('./screens/Safety.jsx'));
const Reqs = lazy(() => import('./screens/Reqs.jsx'));
const Service = lazy(() => import('./screens/Service.jsx'));
const Eagle = lazy(() => import('./screens/Eagle.jsx'));
const CampPlan = lazy(() => import('./screens/CampPlan.jsx'));
const TroopOps = lazy(() => import('./screens/Troop.jsx'));
const Trees = lazy(() => import('./screens/Trees.jsx'));
const Geocache = lazy(() => import('./screens/Geocache.jsx'));
const Explore = lazy(() => import('./screens/Explore.jsx'));
const Elections = lazy(() => import('./screens/Elections.jsx'));
const Inspect = lazy(() => import('./screens/Inspect.jsx'));
const loadGames = () => import('./screens/Games.jsx');
const Games = lazy(loadGames), Play = lazy(() => loadGames().then(m => ({ default: m.Play }))), Live = lazy(() => loadGames().then(m => ({ default: m.Live })));

const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'outings', label: 'Outings', icon: 'tent', match: ['outings', 'outing'] },
  { id: 'snap', label: 'Snap', icon: 'camera', big: true },
  { id: 'messages', label: 'Chat', icon: 'message', match: ['messages', 'thread'] },
  { id: 'more', label: 'More', icon: 'grid', match: ['more', 'explore', 'kitchen', 'gallery', 'permission', 'packing', 'leaders', 'gear', 'advancement', 'counselors', 'hikes', 'games', 'play', 'live', 'inspect', 'vote', 'notes', 'campfire', 'ceremonies', 'knots', 'points', 'hunts', 'sky', 'coh', 'field', 'reqs', 'service', 'eagle', 'camp', 'meetings', 'polls', 'checkin', 'year', 'eagles', 'lost', 'fundraiser', 'geocache'] },
];
const SCREENS = { home: Home, outings: Outings, outing: Outing, gear: Gear, kitchen: Kitchen, snap: Snap, gallery: Gallery, permission: Permission, leaders: Leaders, more: More, packing: Packing, messages: Messages, thread: Thread, advancement: Advancement, counselors: Counselors, hikes: Hikes, track: Track, games: Games, play: Play, live: Live, inspect: Inspect, vote: Elections, notes: Notes, campfire: Campfire, ceremonies: Ceremonies, knots: Knots, points: Points, hunts: Hunts, sky: NightSky, coh: Coh, emergency: Safety, buddy: Safety, field: Safety, reqs: Reqs, service: Service, eagle: Eagle, camp: CampPlan, meetings: TroopOps, polls: TroopOps, checkin: TroopOps, year: TroopOps, eagles: TroopOps, lost: TroopOps, fundraiser: Trees, geocache: Geocache, explore: Explore };

export default function App() {
  const route = useRoute();
  const [code] = useLocal('troop-code', '');
  const [session] = useLocal('session', '');
  const [me] = useMe();
  const acct = useAccount();
  const leader = useLeaderMode();
  const inbox = useInbox(!!session && !!acct);
  const unread = new Set((inbox.threads || []).filter(t => t.unread || t.needsReply).map(t => t.id)).size;
  const Screen = SCREENS[route.name] || Home;
  const { features } = useSettings();
  const off = ROUTE_FEATURE[route.name] && features[ROUTE_FEATURE[route.name]] === false;
  const inside = !!session || (!!code && !!me.name.trim());
  useEffect(() => { if (session) refreshAccount(); }, [session]);
  useEffect(() => {   // tapping a notification while the app is open
    const onMsg = e => { if (e.data?.type === 'open' && e.data.hash) location.hash = e.data.hash; };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);

  if (route.name === 'join') return <Gate route={route} />;
  if (route.name === 'slideshow' && inside) return <Slideshow route={route} />;
  if (!inside && route.name !== 'leaders') return <Gate />;

  return (
    <div className={`app ${['thread', 'track', 'live'].includes(route.name) || (route.name === 'vote' && route.args[1] === 'screen') ? 'chat-mode' : ''}`}>
      <header className="app-header">
        <a className="header-brand" href="#/" aria-label={`${troop.appName} home`}>
          <Mark size={40} dark />
          <span className="header-text"><span className="header-unit">{troop.unit}</span><span className="header-app">Basecamp</span></span>
        </a>
        <div className="header-right">
          {leader && <a className="leader-chip" href="#/leaders"><Icon name="shield" size={14} />Leader</a>}
          {isDemo() && <span className="demo-chip" title="Sample troop for showing off the app">Demo</span>}
          {!acct && session === '' && !isDemo() && <span className="guest-chip">Guest</span>}
          {acct && <a className={`icon-btn on-dark bell ${inbox.reply ? 'hot' : ''}`} href="#/messages" aria-label={unread ? `${unread} conversation${unread > 1 ? 's' : ''} need you` : 'Messages'}><Icon name="bell" />{unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}</a>}
          <a className="icon-btn on-dark" href="#/snap" aria-label="Share a photo"><Icon name="camera" /></a>
        </div>
      </header>
      <main className="app-main" id="main">
        {off && !leader ? <div className="content"><Empty icon="lock" title="This part of Basecamp is turned off" action={<a className="btn" href="#/">Go home</a>}>Your leaders have switched it off for the troop. Ask a leader if you need it.</Empty></div> : (
          <>
            {off && <div className="off-note"><Icon name="info" size={16} />Switched off for the troop. Only leaders can see this. <a href="#/leaders?tab=settings">Settings</a></div>}
            <ErrorBoundary resetKey={location.hash}><Suspense fallback={<div className="content"><p className="muted">Loading…</p></div>}><Screen route={route} /></Suspense></ErrorBoundary>
          </>
        )}
      </main>
      {acct && <WelcomeBack inbox={inbox} route={route} />}
      {inside && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map(tab => {
            const active = (tab.match || [tab.id]).includes(route.name);
            return (
              <a key={tab.id} href={`#/${tab.id === 'home' ? '' : tab.id}`} className={`${active ? 'active' : ''} ${tab.big ? 'big' : ''}`} aria-current={active ? 'page' : undefined}>
                <span className="tab-ico"><Icon name={tab.icon} size={tab.big ? 26 : 22} />{tab.id === 'messages' && unread > 0 && <span className={`tab-badge ${inbox.reply ? 'pulse' : ''}`}>{unread > 9 ? '9+' : unread}</span>}</span>
                <span>{tab.label}</span>
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}

