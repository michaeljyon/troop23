import Icon from './Icon.jsx';
import { PageHead, Empty } from './ui.jsx';
import { useAccount, useLeaderMode } from '../lib/api.js';

// The shared troop code is read-only. Screens that change things ask guests to sign in first.
export function useCanChange() { const acct = useAccount(); const leader = useLeaderMode(); return !!acct || !!leader; }
export function SignInFirst({ title, what, backTo = 'more' }) {
  return (
    <div className="content">
      <PageHead backTo={backTo} title={title} />
      <Empty icon="lock" title="Sign in with your personal code" action={<a className="btn" href="#/more"><Icon name="user" size={16} />Sign in</a>}>
        You're looking around with the troop code, which can't make changes. {what} Ask a leader if you don't have a personal code.
      </Empty>
    </div>
  );
}
