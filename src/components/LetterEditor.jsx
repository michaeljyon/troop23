import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { COLORS, htmlToText, textToHtml } from '../lib/safehtml.jsx';

// Full-screen, email-style writer for conversations: optional subject, a big
// writing area and a formatting toolbar (works on phones, which support the
// browser's built-in rich-text editing).
export default function LetterEditor({ title, initialText, attachTray, onAddPhotos, onAddFiles, onHelp, onSend, onClose, busy, error }) {
  const ed = useRef(null);
  const [subject, setSubject] = useState('');
  const [empty, setEmpty] = useState(!initialText);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('https://');
  const [palette, setPalette] = useState(false);
  const saved = useRef(null);
  useEffect(() => {
    if (initialText) ed.current.innerHTML = textToHtml(initialText);
    try { document.execCommand('styleWithCSS', false, false); document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* older browsers */ }
    ed.current.focus();
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const keep = e => e.preventDefault();   // toolbar taps keep the cursor in the writing area
  const cmd = (c, v) => { ed.current.focus(); document.execCommand(c, false, v); setEmpty(!ed.current.textContent.trim()); };
  const block = tag => {
    const cur = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    cmd('formatBlock', cur === tag ? '<p>' : `<${tag}>`);
  };
  function saveSel() { const s = getSelection(); saved.current = s.rangeCount ? s.getRangeAt(0).cloneRange() : null; }
  function restoreSel() { const s = getSelection(); if (saved.current) { s.removeAllRanges(); s.addRange(saved.current); } }
  function addLink() {
    restoreSel();
    const href = url.trim();
    if (/^(https?:\/\/|mailto:)\S+\.\S+/i.test(href) || /^mailto:/i.test(href)) {
      if (getSelection().isCollapsed) cmd('insertHTML', `<a href="${href.replace(/"/g, '&quot;')}">${href.replace(/^https?:\/\//, '').replace(/</g, '&lt;')}</a>&nbsp;`);
      else cmd('createLink', href);
    }
    setLinking(false); setUrl('https://');
  }
  function send() {
    const html = ed.current.innerHTML;
    const text = htmlToText(html);
    onSend({ subject: subject.trim(), html: text ? html : '', text });
  }
  function useSuggestion(t) { ed.current.innerHTML = textToHtml(t); setEmpty(!t.trim()); }

  const B = ({ label, children, on, ...p }) => <button type="button" className={`tb ${on ? 'on' : ''}`} aria-label={label} title={label} onMouseDown={keep} {...p}>{children}</button>;
  return (
    <div className="letter-full" role="dialog" aria-modal="true" aria-label="Write a message">
      <header className="letter-top">
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={22} /></button>
        <b className="grow">To: {title}</b>
        <button className="btn small" onClick={send} disabled={busy || (empty && !attachTray)}>{busy ? 'Sending…' : <>Send <Icon name="send" size={15} /></>}</button>
      </header>
      <input className="letter-subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject (optional)" maxLength={150} aria-label="Subject" />
      <div className="letter-tools" role="toolbar" aria-label="Formatting">
        <B label="Bold" onClick={() => cmd('bold')}><b>B</b></B>
        <B label="Italic" onClick={() => cmd('italic')}><i>I</i></B>
        <B label="Underline" onClick={() => cmd('underline')}><u>U</u></B>
        <B label="Strikethrough" onClick={() => cmd('strikeThrough')}><s>S</s></B>
        <span className="tb-sep" />
        <B label="Heading" onClick={() => block('h3')}><b>H</b></B>
        <B label="Bulleted list" onClick={() => cmd('insertUnorderedList')}><Icon name="checklist" size={17} /></B>
        <B label="Numbered list" onClick={() => cmd('insertOrderedList')}>1.</B>
        <B label="Quote" onClick={() => block('blockquote')}>❝</B>
        <B label="Decrease indent" onClick={() => cmd('outdent')}>⇤</B>
        <B label="Increase indent" onClick={() => cmd('indent')}>⇥</B>
        <span className="tb-sep" />
        <B label="Highlight" onClick={() => { const on = /255,\s*229,\s*138|ffe58a/i.test(String(document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor'))); cmd('hiliteColor', on ? 'transparent' : '#FFE58A'); }}><mark>ab</mark></B>
        <B label="Text color" on={palette} onClick={() => setPalette(v => !v)}><span className="tc-a">A</span></B>
        <B label="Add a link" onClick={() => { saveSel(); setLinking(v => !v); }}><Icon name="external" size={16} /></B>
        <B label="Divider line" onClick={() => cmd('insertHorizontalRule')}>―</B>
        <B label="Clear formatting" onClick={() => { cmd('removeFormat'); cmd('formatBlock', '<p>'); }}>T<sub>x</sub></B>
        <B label="Undo" onClick={() => cmd('undo')}>↶</B>
        <B label="Redo" onClick={() => cmd('redo')}>↷</B>
      </div>
      {palette && (
        <div className="letter-palette">
          {Object.entries(COLORS).map(([k, v]) => <button key={k} type="button" aria-label={`${k} text`} style={{ background: v }} onMouseDown={keep} onClick={() => { cmd('foreColor', v); setPalette(false); }} />)}
          <button type="button" className="pal-reset" onMouseDown={keep} onClick={() => { cmd('foreColor', '#1B2420'); setPalette(false); }}>Default</button>
        </div>
      )}
      {linking && (
        <div className="letter-link">
          <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())} aria-label="Link address" autoFocus inputMode="url" />
          <button type="button" className="btn small" onClick={addLink}>Add link</button>
          <button type="button" className="link-btn small" onClick={() => setLinking(false)}>Cancel</button>
        </div>
      )}
      <div ref={ed} className="letter-edit rich" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Message"
        data-placeholder="Write your message…" onInput={() => setEmpty(!ed.current.textContent.trim())}
        onPaste={e => { e.preventDefault(); const t = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); }} />
      {attachTray}
      {error && <p className="form-msg compose-err" role="alert">{error}</p>}
      <div className="letter-foot">
        <button type="button" className="icon-btn sm" onClick={onAddPhotos}><Icon name="image" size={19} /><span className="tool-l">Photos</span></button>
        <button type="button" className="icon-btn sm" onClick={onAddFiles}><Icon name="paperclip" size={19} /><span className="tool-l">Files</span></button>
        {onHelp && <button type="button" className="icon-btn sm coach-btn" onClick={() => onHelp(htmlToText(ed.current.innerHTML), useSuggestion)}><Icon name="sparkle" size={19} /><span className="tool-l">Help me write</span></button>}
      </div>
    </div>
  );
}
