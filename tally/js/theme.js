export function applyTheme(t) {
  try { if (t === 'light' || t === 'dark') localStorage.setItem('tally.theme', t); else localStorage.removeItem('tally.theme'); } catch { /* optional */ }
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0f1f' : '#e9eefb');
}
