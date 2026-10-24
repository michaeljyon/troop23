// Small, safe formatter for chat messages (no HTML is ever injected):
//   **bold**  *italic* or _italic_  ~~strike~~  `code`  [text](https://link)
//   lines starting "- " or "• " → bullets, "1. " → numbered, "> " → quote
//   bare http(s) links become tappable.
const INLINE = /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]|\*[^*\s][^*\n]*\*|\b_[^_\n]+_\b)/g;   // no lookbehind: older iPhones can't parse it

function inline(s, key = 'i') {
  const out = [];
  let last = 0, m, n = 0;
  const re = new RegExp(INLINE.source, 'g');   // own copy: nested calls must not reset the outer loop's position
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0], k = `${key}-${n++}`;
    if (t.startsWith('**')) out.push(<strong key={k}>{inline(t.slice(2, -2), k)}</strong>);
    else if (t.startsWith('~~')) out.push(<s key={k}>{inline(t.slice(2, -2), k)}</s>);
    else if (t.startsWith('`')) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) { const mm = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(t); out.push(<a key={k} href={mm[2]} target="_blank" rel="noopener noreferrer nofollow">{mm[1]}</a>); }
    else if (t.startsWith('http')) out.push(<a key={k} href={t} target="_blank" rel="noopener noreferrer nofollow">{t.replace(/^https?:\/\//, '').slice(0, 60)}{t.length > 68 ? '…' : ''}</a>);
    else out.push(<em key={k}>{inline(t.slice(1, -1), k)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function RichText({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*([-•*])\s+/.test(l)) {
      const items = []; while (i < lines.length && /^\s*([-•*])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-•*]\s+/, ''));
      blocks.push(<ul key={i}>{items.map((x, j) => <li key={j}>{inline(x, `u${i}-${j}`)}</li>)}</ul>);
    } else if (/^\s*\d+[.)]\s+/.test(l)) {
      const items = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push(<ol key={i}>{items.map((x, j) => <li key={j}>{inline(x, `o${i}-${j}`)}</li>)}</ol>);
    } else if (/^>\s?/.test(l)) {
      const items = []; while (i < lines.length && /^>\s?/.test(lines[i])) items.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={i}>{items.map((x, j) => <span key={j}>{inline(x, `q${i}-${j}`)}{j < items.length - 1 && <br />}</span>)}</blockquote>);
    } else {
      const para = []; while (i < lines.length && !/^\s*([-•*]|\d+[.)])\s+|^>/.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={i}>{para.map((x, j) => <span key={j}>{inline(x, `p${i}-${j}`)}{j < para.length - 1 && <br />}</span>)}</p>);
    }
  }
  return <div className="rich">{blocks}</div>;
}

// Wrap the textarea selection with markers, or prefix the selected lines.
export function applyFormat(el, value, kind) {
  const a = el.selectionStart ?? value.length, b = el.selectionEnd ?? value.length;
  const sel = value.slice(a, b);
  const wrap = (l, r = l, ph = 'text') => {
    const inner = sel || ph;
    return { value: value.slice(0, a) + l + inner + r + value.slice(b), start: a + l.length, end: a + l.length + inner.length };
  };
  if (kind === 'bold') return wrap('**', '**', 'bold text');
  if (kind === 'italic') return wrap('_', '_', 'italic text');
  if (kind === 'strike') return wrap('~~', '~~', 'text');
  if (kind === 'link') {
    const url = (prompt('Link address (https://…)') || '').trim();
    if (!/^https?:\/\//.test(url)) return null;
    return wrap('[', `](${url})`, 'link text');
  }
  // lists: prefix each selected line (or start a new item)
  const ls = value.lastIndexOf('\n', a - 1) + 1;
  const le = value.indexOf('\n', b); const end = le === -1 ? value.length : le;
  const chunk = value.slice(ls, end).split('\n');
  const done = chunk.map((x, k) => (kind === 'ul' ? `- ${x.replace(/^\s*([-•*]|\d+[.)])\s+/, '')}` : `${k + 1}. ${x.replace(/^\s*([-•*]|\d+[.)])\s+/, '')}`)).join('\n');
  const v = value.slice(0, ls) + done + value.slice(end);
  return { value: v, start: ls + done.length, end: ls + done.length };
}
