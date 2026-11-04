const form = document.querySelector('[data-filters]');
if (form) {
  form.hidden = false;
  const rows = [...document.querySelectorAll('[data-entry]')];
  const buttons = [...form.querySelectorAll('[data-filter]')];
  const input = form.querySelector('input');
  const empty = document.querySelector('[data-empty]');
  const params = new URLSearchParams(location.search);
  let filter = buttons.some(button => button.dataset.filter === params.get('type')) ? params.get('type') : 'all';
  input.value = params.get('q') || '';
  function update() {
    const query = input.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const row of rows) {
      row.hidden = !((filter === 'all' || row.dataset.type === filter) && row.dataset.search.toLocaleLowerCase().includes(query));
      if (!row.hidden) count++;
    }
    for (const button of buttons) button.setAttribute('aria-pressed', button.dataset.filter === filter);
    empty.hidden = count !== 0;
    document.querySelector('[data-priorities]').hidden = filter !== 'all' || Boolean(query);
    document.querySelector('[data-results]').textContent = `${count} ${count === 1 ? 'entry' : 'entries'} shown.`;
    const next = new URL(location.href);
    filter === 'all' ? next.searchParams.delete('type') : next.searchParams.set('type', filter);
    query ? next.searchParams.set('q', input.value.trim()) : next.searchParams.delete('q');
    history.replaceState(null, '', next);
  }
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  input.addEventListener('input', update);
  for (const button of buttons) button.addEventListener('click', () => { filter = button.dataset.filter; update(); });
  document.querySelector('[data-reset]').addEventListener('click', () => { filter = 'all'; input.value = ''; update(); input.focus(); });
  update();
}
