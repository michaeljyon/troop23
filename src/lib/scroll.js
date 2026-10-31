// Installed (Home Screen) app on a phone: the page itself stays still and only the middle area scrolls,
// so the bottom menu can't drift or bounce (an iPhone quirk with fixed menus). Everywhere else the page scrolls as usual.
const standaloneQuery = typeof matchMedia === 'function' ? matchMedia('(display-mode: standalone)') : null;

export function markStandalone() {
  const set = () => document.documentElement.classList.toggle('standalone', !!(standaloneQuery?.matches || navigator.standalone === true));
  set();
  standaloneQuery?.addEventListener?.('change', set);
}

// Scroll to the top of whatever is scrolling: the main area in the installed app, the page otherwise.
export function scrollToTop(opts = {}) {
  const main = document.getElementById('main');
  if (main && main.scrollHeight > main.clientHeight && getComputedStyle(main).overflowY === 'auto') main.scrollTo({ top: 0, ...opts });
  else window.scrollTo({ top: 0, ...opts });
}
