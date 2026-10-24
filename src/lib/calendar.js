// The troop calendar feed link (a private URL with its own key).
import { useEffect, useState } from 'react';
import { api } from './api.js';

const KEY = 't23-cal';
const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export function useCalendarLink() {
  const [url, setUrl] = useState(read);
  useEffect(() => {
    api('calendar/link').then(d => { setUrl(d.url); try { localStorage.setItem(KEY, d.url); } catch { /* private mode */ } }).catch(() => {});
  }, []);
  return url;
}
export const webcal = url => url.replace(/^https?:/, 'webcal:');
export const googleAdd = url => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal(url))}`;
export const outingIcs = (url, id) => (url ? `${url}&id=${encodeURIComponent(id)}` : '');
