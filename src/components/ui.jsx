import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { back } from '../lib/router.js';
import { troop } from '../lib/config.js';

export function PageHead({ title, sub, backTo, eyebrow, children }) {
  return (
    <header className="page-head">
      {backTo !== undefined && <button className="back-btn" onClick={() => back(backTo)}><Icon name="chevronL" size={20} /> Back</button>}
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      {title && <h1>{title}</h1>}
      {sub && <p className="page-sub">{sub}</p>}
      {children}
    </header>
  );
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`section ${className}`}>
      {(title || action) && <div className="section-row">{title && <h2 className="section-title">{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

export function Sheet({ open, onClose, title, children, wide, dark }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    ref.current?.focus();
    const key = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', key);
    document.body.classList.add('no-scroll');
    return () => { removeEventListener('keydown', key); document.body.classList.remove('no-scroll'); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`sheet-overlay ${dark ? 'dark' : ''}`} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon = 'info', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <p className="empty-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// The troop's official artwork when it's been added (troop.logo), otherwise
// the "Troop 23" mark.
export function Mark({ size = 44, dark = false, className = '' }) {
  const src = (dark && troop.logoOnDark) || troop.logo;
  if (src) return <img className={`logo-img ${className}`} src={src} style={{ height: size }} alt={troop.unit} />;
  return <img className={`mark-img ${className}`} src="/brand/mark-256.png" width={size} height={size} alt="" />;
}

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([id, l]) => <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{l}</button>)}
    </div>
  );
}

export function Pill({ tone = 'neutral', children }) { return <span className={`pill pill-${tone}`}>{children}</span>; }

export function Progress({ value, max, label }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}><span style={{ width: `${pct}%` }} /></div>;
}
