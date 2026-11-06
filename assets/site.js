// Relative age of the latest source pass. Passes run every 12 hours, so anything older is flagged.
for (const time of document.querySelectorAll('time[data-ago]')) {
  const then = Date.parse(time.dateTime);
  const minutes = Math.round((Date.now() - then) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) continue;
  const ago = minutes < 60 ? `${Math.max(minutes, 1)} min ago` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} days ago`;
  time.title = time.textContent;
  time.textContent = ago;
  if (minutes > 13 * 60) time.closest('.pass')?.classList.add('stale');
}

// Mark developments that are new or changed since the reader's previous visit.
// A visit ends after 30 idle minutes, so badges stay put while browsing records.
(function markChanges() {
  const items = [...document.querySelectorAll('[data-sig]')];
  if (!items.length) return;
  const key = 'ios-research-tracker:seen:v2'; // v2: entry wording was rewritten without research changes.
  const now = Date.now();
  const current = Object.fromEntries(items.map(item => [item.dataset.id, item.dataset.sig]));
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
  const baseline = !saved?.current ? current : now - saved.at > 30 * 60000 ? {...saved.baseline, ...saved.current} : saved.baseline;
  try { localStorage.setItem(key, JSON.stringify({baseline, current: {...saved?.current, ...current}, at: now})); } catch {}
  for (const item of items) {
    const before = baseline[item.dataset.id];
    if (before === item.dataset.sig) continue;
    const badge = item.querySelector('[data-badge]');
    if (!badge) continue;
    badge.className = 'badge';
    badge.textContent = before ? 'Updated' : 'New';
    badge.title = 'Since your last visit';
  }
})();

const form = document.querySelector('[data-filters]');
if (form) {
  form.hidden = false;
  const rows = [...document.querySelectorAll('[data-entry]')];
  const groups = [...document.querySelectorAll('[data-group]')];
  const input = form.querySelector('input');
  const empty = document.querySelector('[data-empty]');
  input.value = new URLSearchParams(location.search).get('q') || '';
  function update() {
    const query = input.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const row of rows) {
      row.hidden = !row.dataset.search.toLocaleLowerCase().includes(query);
      if (!row.hidden) count++;
    }
    for (const group of groups) group.hidden = !group.querySelector('[data-entry]:not([hidden])');
    empty.hidden = count !== 0;
    document.querySelector('[data-results]').textContent = `${count} ${count === 1 ? 'entry' : 'entries'} shown.`;
    const next = new URL(location.href);
    query ? next.searchParams.set('q', input.value.trim()) : next.searchParams.delete('q');
    for (const old of ['type', 'sort']) next.searchParams.delete(old);
    history.replaceState(null, '', next);
  }
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  input.addEventListener('input', update);
  document.querySelector('[data-reset]').addEventListener('click', () => { input.value = ''; update(); input.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    input.focus();
  });
  update();
}
