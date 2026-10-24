import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Sheet } from './ui.jsx';
import { go } from '../lib/router.js';

const ago = t => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`; const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
};
export function waiting(threads) {
  const list = (threads || []).filter(t => t.needsReply || t.unread);
  return list.sort((a, b) => (b.needsReply - a.needsReply) || (b.last?.at || 0) - (a.last?.at || 0));
}

function Row({ t, onOpen }) {
  return (
    <li>
      <button className={`inbox-row ${t.needsReply ? 'reply' : ''}`} onClick={() => onOpen(t.id)}>
        <span className="thread-emoji sm" aria-hidden="true">{t.kind === 'dm' ? (t.title || '?').slice(0, 1) : t.emoji}</span>
        <span className="grow">
          <span className="inbox-title">{t.title}{t.needsReply && <span className="reply-tag">Reply</span>}</span>
          <span className="inbox-last">{t.last ? `${t.last.byName}: ${t.last.text}` : ''}</span>
        </span>
        {t.last && <span className="inbox-time">{ago(t.last.at)}</span>}
      </button>
    </li>
  );
}

// Home: the first thing a member sees when someone is waiting on them.
export function InboxCard({ inbox }) {
  const list = waiting(inbox.threads);
  if (!list.length) return null;
  const reply = list.filter(t => t.needsReply).length;
  return (
    <section className={`inbox-card ${reply ? 'hot' : ''}`} aria-labelledby="inbox-h">
      <div className="inbox-head">
        <span className="inbox-ico"><Icon name="message" size={22} /></span>
        <span className="grow"><b id="inbox-h">{reply ? `${reply} conversation${reply > 1 ? 's' : ''} waiting on you` : `${list.length} new message${list.length > 1 ? 's' : ''}`}</b>
          <span>{reply ? 'Someone asked you something. Tap to reply.' : 'Catch up on troop chat.'}</span></span>
      </div>
      <ul className="inbox-list">{list.slice(0, 3).map(t => <Row key={t.id} t={t} onOpen={id => go(`thread/${id}`)} />)}</ul>
      {list.length > 3 && <a className="inbox-more" href="#/messages">See all {list.length} in Chat <Icon name="chevronR" size={14} /></a>}
    </section>
  );
}

// Once per visit: a sheet that greets members with what's waiting.
export function WelcomeBack({ inbox, route }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (['messages', 'thread', 'slideshow', 'join'].includes(route.name)) { setOpen(false); return; }
    if (!inbox.threads) return;
    let shown = false; try { shown = sessionStorage.getItem('t23-welcome') === '1'; } catch { /* private mode */ }
    if (!shown && waiting(inbox.threads).length) { setOpen(true); try { sessionStorage.setItem('t23-welcome', '1'); } catch { /* private mode */ } }
  }, [inbox.threads, route.name]);
  const list = waiting(inbox.threads);
  const reply = list.filter(t => t.needsReply).length;
  const close = () => setOpen(false);
  return (
    <Sheet open={open && list.length > 0} onClose={close} title={reply ? 'Waiting on you' : 'New messages'}>
      <p className="small muted">{reply ? `${reply} conversation${reply > 1 ? 's' : ''} need${reply > 1 ? '' : 's'} a reply from you.` : 'Here\'s what came in since you were last here.'}</p>
      <ul className="inbox-list sheet-list">{list.slice(0, 6).map(t => <Row key={t.id} t={t} onOpen={id => { close(); go(`thread/${id}`); }} />)}</ul>
      <div className="btn-row"><button className="btn" onClick={() => { close(); go('messages'); }}><Icon name="message" size={18} />Open Chat</button><button className="btn secondary" onClick={close}>Later</button></div>
    </Sheet>
  );
}
