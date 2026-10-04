import { boot } from './app.js';
boot().catch((e) => {
  console.error(e);
  document.getElementById('app').textContent = 'Tally could not start: ' + (e?.message || e);
});
