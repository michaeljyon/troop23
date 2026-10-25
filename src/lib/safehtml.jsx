// Email-style messages are written in a rich editor and stored as HTML.
// They are never inserted with innerHTML: this walks the HTML and rebuilds
// only allowed tags as React elements, so nothing harmful can run.
import { Fragment } from 'react';

export const COLORS = { red: '#C62828', orange: '#D9480F', green: '#2B7A3D', blue: '#1D5FBF', purple: '#6A3FB5', gray: '#5F6B66' };
const TAGS = { P: 'p', DIV: 'p', BR: 'br', B: 'strong', STRONG: 'strong', I: 'em', EM: 'em', U: 'u', S: 's', STRIKE: 's', DEL: 's',
  H1: 'h3', H2: 'h3', H3: 'h3', H4: 'h4', UL: 'ul', OL: 'ol', LI: 'li', BLOCKQUOTE: 'blockquote', A: 'a', MARK: 'mark', HR: 'hr', CODE: 'code', PRE: 'pre', SPAN: 'span', FONT: 'span' };

const hex = c => {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
  if (m) return `#${[m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('')}`.toLowerCase();
  return (c || '').trim().toLowerCase();
};
const colorName = c => { const h = hex(c); return Object.keys(COLORS).find(k => COLORS[k].toLowerCase() === h) || null; };
const isHighlight = c => { const h = hex(c); return !!h && h !== 'transparent' && h !== '#ffffff' && h !== 'rgba(0, 0, 0, 0)' && h !== '#00000000'; };

function build(node, key) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return null;
  const kids = [...node.childNodes].map((c, i) => build(c, `${key}-${i}`));
  const tag = TAGS[node.tagName];
  if (!tag) return <Fragment key={key}>{kids}</Fragment>;
  if (tag === 'br') return <br key={key} />;
  if (tag === 'hr') return <hr key={key} />;
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    return /^(https?:|mailto:)/i.test(href) ? <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">{kids}</a> : <Fragment key={key}>{kids}</Fragment>;
  }
  if (tag === 'span' || tag === 'mark') {
    const col = colorName(node.getAttribute('color') || node.style?.color);
    const bg = node.style?.backgroundColor;
    let el = kids;
    if (col) el = <span className={`tc-${col}`}>{el}</span>;
    if (tag === 'mark' || isHighlight(bg)) el = <mark>{el}</mark>;
    if (node.style?.fontWeight === 'bold' || +node.style?.fontWeight >= 600) el = <strong>{el}</strong>;
    if (node.style?.fontStyle === 'italic') el = <em>{el}</em>;
    if (/underline/.test(node.style?.textDecoration || '')) el = <u>{el}</u>;
    return <Fragment key={key}>{el}</Fragment>;
  }
  const Tag = tag;
  return <Tag key={key}>{kids}</Tag>;
}

export function SafeHtml({ html }) {
  if (!html) return null;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return <div className="rich letter-body">{[...doc.body.childNodes].map((n, i) => build(n, `n${i}`))}</div>;
}

// Plain text version, for previews, notifications and the writing helper.
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  doc.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
  doc.querySelectorAll('li').forEach(li => li.prepend('• '));
  doc.querySelectorAll('p,div,li,h1,h2,h3,h4,blockquote,ul,ol').forEach(el => { el.prepend('\n'); el.append('\n'); });
  return doc.body.textContent.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Turn plain text (e.g. a writing-helper suggestion) into editor HTML.
export const textToHtml = t => String(t || '').split(/\n{2,}/).map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join('');
