import { Component } from 'react';

// If one screen hits a bug, show a friendly note instead of a blank app.
export default class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  componentDidCatch(err) { console.error('Screen error', err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="content"><div className="empty">
        <h2>Something went wrong on this page</h2>
        <p className="muted">Try again, or go back. If it keeps happening, tell a leader what you tapped.</p>
        <div className="btn-row" style={{ justifyContent: 'center' }}><button className="btn" onClick={() => location.reload()}>Try again</button><a className="btn secondary" href="#/">Go home</a></div>
      </div></div>
    );
  }
}
