import { alerts } from './calc.js';
import { monthOf } from './dates.js';
import { cs, state, today } from './ctx.js';

/** Alerts after applying the user's notification preferences and dismissals. */
export function visibleAlerts() {
  const st = state();
  const n = st.settings.notifications;
  if (!n.enabled || st.mode === 'empty') return [];
  const ym = monthOf(today());
  return alerts(cs(), today()).filter((a) => n.types[a.type] !== false && !st.settings.dismissed[ym + '|' + a.id]);
}

/** Optional OS notification for serious alerts, once per alert per day. */
export function maybeBrowserNotify() {
  const st = state();
  if (!st.settings.notifications.browser || !('Notification' in window) || Notification.permission !== 'granted' || st.mode === 'demo') return;
  const seenKey = 'tally.notified.' + today();
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch { /* ignore */ }
  const fresh = visibleAlerts().filter((a) => (a.severity === 'bad' || a.severity === 'warn' || a.type === 'recurring') && !seen.includes(a.id)).slice(0, 3);
  for (const a of fresh) { try { new Notification('Tally', { body: a.text, tag: a.id }); } catch { /* ignore */ } seen.push(a.id); }
  try { localStorage.setItem(seenKey, JSON.stringify(seen)); } catch { /* ignore */ }
}
