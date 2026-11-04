import { readFile, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = 'https://jftechllc.com/ios-research-tracker/';
const repo = 'https://github.com/0xjohnnydev/ios-research-tracker';
const assetVersion = createHash('sha256')
  .update(await readFile(`${root}assets/style.css`))
  .update(await readFile(`${root}assets/site.js`))
  .digest('hex').slice(0, 12);
const data = JSON.parse(await readFile(`${root}data/notes.json`, 'utf8'));
const coverage = JSON.parse(await readFile(`${root}data/coverage.json`, 'utf8'));
const upstream = JSON.parse(await readFile(`${root}data/upstream.json`, 'utf8'));
data.entries.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || b.date.localeCompare(a.date));
const entries = data.entries.filter(entry => !entry.held);
const held = data.entries.filter(entry => entry.held);
const priority = entries.filter(entry => entry.priority);

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const format = options => value => new Intl.DateTimeFormat('en', {...options, timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const date = format({day:'numeric', month:'long', year:'numeric'});
const shortDate = format({day:'numeric', month:'short'});
const checkedTime = value => new Intl.DateTimeFormat('en', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZone:'America/Los_Angeles', timeZoneName:'short'}).format(new Date(value));
const host = url => new URL(url).hostname.replace(/^www\./, '');
const external = (url, title, className = '') => `<a${className ? ` class="${className}"` : ''} href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(title)}<span class="ext" aria-hidden="true">↗</span></a>`;
const noteLink = (entry, base = '') => `${base}notes/${entry.id}/`;

// Availability ladder: how much of a development is publicly usable. It mirrors the status types; it is not a capability score.
const levels = {announced: 1, demo: 2, poc: 3, released: 4};
const levelNames = ['Held', 'Announced', 'Demo', 'Public PoC', 'Released'];
function stage(entry) {
  const level = entry.held ? 0 : levels[entry.type] ?? 0;
  const kind = entry.held ? 'held' : entry.type;
  return `<span class="stage stage-${kind}" title="Public availability: ${levelNames[level]} (${level} of 4)"><span class="pips" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i${i <= level ? ' class="on"' : ''}></i>`).join('')}</span>${escape(entry.status)}</span>`;
}
// A short fingerprint of the fields a reader scans, so returning visitors can see what changed.
const signature = entry => createHash('sha1').update([entry.type, entry.status, entry.update, entry.capability, entry.trackerScope, entry.artifact, entry.date, entry.priority ?? ''].join('\u0001')).digest('hex').slice(0, 10);
const tracked = entry => `data-id="${entry.id}" data-sig="${signature(entry)}"`;
const facts = items => `<dl class="facts">${items.filter(Boolean).map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl>`;

const sourceStates = {checked: 'Checked', partial: 'Partial', blocked: 'Blocked'};
const sourceState = source => sourceStates[source.state] ? source.state : 'unknown';
const lastPass = coverage.sources.map(source => source.checkedAt).sort().at(-1);

function shell({title, description, body, base = '', active = ''}) {
  const nav = [['record', base || './', 'Tracker', entries.length], ['coverage', `${base}coverage/`, 'Sources'], ['about', `${base}about/`, 'Criteria']];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | iOS Research Tracker</title><meta name="description" content="${escape(description)}">
<meta name="theme-color" content="#f4f5f7" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0b0d10" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="${escape(title)} | iOS Research Tracker"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/atom+xml" title="iOS Research Tracker" href="${base}feed.xml">
<link rel="stylesheet" href="${base}assets/style.css?v=${assetVersion}"><script src="${base}assets/site.js?v=${assetVersion}" defer></script>
</head><body><a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap bar">
<a class="brand" href="${base || './'}"><img src="${base}assets/favicon.svg" alt="" width="22" height="22"><span>iOS Research Tracker</span></a>
<nav class="nav" aria-label="Main navigation">${nav.map(([key, href, label, count]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}${count ? `<span class="count">${count}</span>` : ''}</a>`).join('')}</nav>
<div class="bar-links"><a href="${base}feed.xml">Feed</a>${external(repo, 'GitHub')}</div>
</div></header>
${body}
<footer class="site-footer"><div class="wrap footer-row">
<span>Research reviewed <time datetime="${data.reviewed}">${date(data.reviewed)}</time></span>
<span>Source passes 08:00 &amp; 20:00 Pacific</span>
<span class="footer-links"><a href="${base}coverage/">Sources &amp; checks</a><a href="${base}feed.xml">Atom feed</a>${external(`${repo}/issues/new?template=correction.md`, 'Suggest a correction')}</span>
</div></footer>
</body></html>`;
}

function passStatus(base = '') {
  return `<div class="pass" aria-label="Latest source pass">
<div class="pass-time"><span class="label">Last source pass</span><a href="${base}coverage/"><time datetime="${lastPass}" data-ago>${checkedTime(lastPass)}</time></a></div>
<ul class="pass-sources">${coverage.sources.map(source => `<li class="src src-${sourceState(source)}" title="${escape(`${source.result} · ${checkedTime(source.checkedAt)}`)}"><i aria-hidden="true"></i>${escape(source.name)}${source.state === 'checked' ? '' : `<span class="src-note">${escape(sourceStates[source.state] ?? 'State not recorded')}</span>`}<span class="sr-only">: ${escape(source.result)}</span></li>`).join('')}</ul>
</div>`;
}

function leadCard(entry) {
  return `<article class="lead" ${tracked(entry)}>
<div class="lead-main">
<div class="card-top"><span class="rank">Priority 1</span><span class="topic">${escape(entry.topic)}</span><span data-badge></span><time datetime="${entry.date}">${shortDate(entry.date)}</time></div>
<h3><a href="${noteLink(entry)}">${escape(entry.project)}</a></h3>
${stage(entry)}
<p class="lead-note">${escape(entry.priorityNote)}</p>
<div class="actions"><a class="button button-primary" href="${noteLink(entry)}">Evidence record <span aria-hidden="true">→</span></a>${external(entry.sources[0].url, entry.artifact, 'button')}</div>
</div>
${facts([['Capability', escape(entry.capability)], ['Target', escape(entry.trackerScope)], ['Watching for', escape(entry.nextStep)]])}
</article>`;
}

function priorityCard(entry) {
  return `<article class="pcard" ${tracked(entry)}>
<div class="card-top"><span class="rank">Priority ${entry.priority}</span><time datetime="${entry.date}">${shortDate(entry.date)}</time></div>
<h3><a href="${noteLink(entry)}">${escape(entry.project)}</a><span data-badge></span></h3>
${stage(entry)}
<p class="pcard-note">${escape(entry.priorityNote)}</p>
${facts([['Capability', escape(entry.capability)], ['Target', escape(entry.trackerScope)], ['Watching for', escape(entry.nextStep)]])}
<div class="card-links"><a href="${noteLink(entry)}">Evidence record <span aria-hidden="true">→</span></a>${external(entry.sources[0].url, entry.artifact)}</div>
</article>`;
}

function home() {
  const filters = [['all', 'All'], ['released', 'Released'], ['poc', 'PoCs'], ['demo', 'Demos'], ['announced', 'Announced']];
  const rows = entries.map((entry, index) => `<tr data-entry data-type="${entry.type}" data-rank="${index}" data-date="${entry.date}" ${tracked(entry)} data-search="${escape([entry.project, entry.title, entry.dek, entry.update, entry.scope, entry.trackerScope, entry.topic, entry.capability, entry.status, entry.artifact, entry.priorityNote, entry.nextStep, entry.cve, ...entry.observed].filter(Boolean).join(' '))}">
<td class="c-date"><time datetime="${entry.date}">${shortDate(entry.date)}</time></td>
<td class="c-dev"><div class="dev-line">${entry.priority ? `<span class="prank" title="Priority ${entry.priority}">P${entry.priority}</span>` : ''}<a class="row-link" href="${noteLink(entry)}">${escape(entry.project)}</a>${entry.cve ? `<code>${escape(entry.cve)}</code>` : ''}<span data-badge></span></div><p>${escape(entry.update)}</p></td>
<td class="c-stage">${stage(entry)}</td>
<td class="c-cap" data-label="Capability">${escape(entry.capability)}</td>
<td class="c-target" data-label="Target">${escape(entry.trackerScope)}</td>
<td class="c-src">${external(entry.sources[0].url, entry.artifact)}</td>
</tr>`).join('');
  const [lead, ...rest] = priority;
  return shell({title:'Developments', description:'An evidence-led tracker of iOS jailbreak releases, demonstrations, and public vulnerability research.', active:'record', body:`
<main id="main" class="wrap page">
<section class="intro"><div><h1>iOS jailbreak &amp; security research</h1><p>Public developments, ranked by jailbreak relevance and linked to primary sources.</p></div>${passStatus()}</section>
${lead ? `<section class="priority" aria-labelledby="priority-title" data-priorities>
<div class="section-head"><h2 id="priority-title"><span class="dot" aria-hidden="true"></span>Priority watch</h2><a class="legend-link" href="about/#status">How stages work</a></div>
${leadCard(lead)}
${rest.length ? `<div class="pgrid">${rest.map(priorityCard).join('')}</div>` : ''}
</section>` : ''}
<section id="record" class="register" aria-labelledby="record-title">
<div class="section-head"><h2 id="record-title">All developments <span class="count">${entries.length}</span></h2>${held.length ? `<a href="coverage/#pending">${held.length} held for evidence <span aria-hidden="true">→</span></a>` : ''}</div>
<form class="tools" role="search" data-filters hidden>
<div class="segmented" role="group" aria-label="Filter by stage">${filters.map(([value, label]) => `<button type="button" data-filter="${value}" aria-pressed="${value === 'all'}">${label}<span>${value === 'all' ? entries.length : entries.filter(entry => entry.type === value).length}</span></button>`).join('')}</div>
<div class="tools-end"><label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span class="sr-only">Search developments</span><input type="search" name="q" placeholder="Search projects, CVEs, builds" autocomplete="off"><kbd aria-hidden="true">/</kbd></label>
<label class="sort"><span class="sr-only">Sort</span><select name="sort" data-sort><option value="relevance">By relevance</option><option value="newest">Newest first</option></select></label></div>
</form>
<p class="sr-only" role="status" data-results></p>
<div class="table-wrap"><table class="register-table"><caption class="sr-only">Research developments reviewed ${date(data.reviewed)}</caption>
<thead><tr><th scope="col" class="c-date">Date</th><th scope="col">Development</th><th scope="col">Stage</th><th scope="col">Capability</th><th scope="col">Target</th><th scope="col" class="c-src">Source</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="empty" data-empty hidden><strong>No matching developments</strong><span>Try another project, CVE, or build.</span><button type="button" data-reset>Clear filters</button></div></div>
<p class="footnote">Ranked by priority, then publication date. Author-supplied results are attributed; independent execution is stated explicitly. <a href="about/">Inclusion criteria</a></p>
</section>
</main>`});
}

function article(entry) {
  const sources = entry.sources.map(source => `<li>${external(source.url, source.title)}<span>${escape(source.kind)} · ${escape(host(source.url))}</span></li>`).join('');
  const back = entry.held ? ['../../coverage/#pending', 'Pending evidence'] : ['../../#record', 'All developments'];
  return shell({title:entry.title, description:entry.dek, base:'../../', body:`
<main id="main" class="wrap page record">
<a class="back" href="${back[0]}"><span aria-hidden="true">←</span> ${back[1]}</a>
<header class="record-head">
<div class="record-meta">${stage(entry)}${entry.priority && !entry.held ? `<span class="prank">Priority ${entry.priority}</span>` : ''}${entry.cve ? `<code>${escape(entry.cve)}</code>` : ''}<span>${escape(entry.topic)}</span></div>
<h1>${escape(entry.project)}</h1>
<p class="dek">${escape(entry.dek)}</p>
</header>
${entry.held ? `<div class="notice"><strong>Held from the main register.</strong> ${escape(entry.reviewBasis)}</div>` : ''}
${facts([['Capability', escape(entry.capability)], ['Device &amp; build', escape(entry.scope)], ['Primary artifact', external(entry.sources[0].url, entry.artifact)], ['Published', `<time datetime="${entry.date}">${date(entry.date)}</time>`], ['Reviewed', `<time datetime="${entry.reviewed}">${date(entry.reviewed)}</time>`]])}
${entry.priority && !entry.held ? `<div class="watching"><span class="label">Watching for</span><p>${escape(entry.nextStep)}</p></div>` : ''}
<div class="record-body">
<div class="record-main">
<section><h2>Observed</h2><ul class="points">${entry.observed.map(value => `<li>${escape(value)}</li>`).join('')}</ul></section>
<section><h2>Assessment</h2><p>${escape(entry.meaning)}</p></section>
<section class="limits"><h2>Limits</h2><ul>${entry.limits.map(value => `<li>${escape(value)}</li>`).join('')}</ul></section>
</div>
<aside class="record-side">
<section><h2>Sources</h2><ol class="sources">${sources}</ol></section>
${entry.held ? '' : `<section><h2>Review basis</h2><p>${escape(entry.reviewBasis)}</p></section>`}
<section><h2>Reviewed artifact</h2><p class="mono">${escape(entry.revision)}</p></section>
<p class="side-links"><a href="../../about/#terms">Technical terms</a>${external(`${repo}/issues/new?template=correction.md&title=${encodeURIComponent(`Correction: ${entry.id}`)}`, 'Suggest a correction')}</p>
</aside>
</div>
</main>`});
}

function coveragePage() {
  const trackedBy = repository => data.entries.find(entry => entry.sources.some(source => source.url.startsWith(`https://github.com/${repository}/`)));
  return shell({title:'Sources & checks', description:'Twice-daily research coverage, source checks, and developments awaiting better evidence.', base:'../', active:'coverage', body:`
<main id="main" class="wrap page info">
<header class="page-head"><h1>Sources &amp; checks</h1><p>Research passes run at 08:00 and 20:00 Pacific. The repository check runs at 03:23 and 15:23 UTC.</p></header>
<section><div class="section-head"><h2>Latest source pass</h2><span>Sampled coverage</span></div>
<div class="source-grid">${coverage.sources.map(source => `<article class="source-card src-${sourceState(source)}">
<div class="card-top"><span class="src"><i aria-hidden="true"></i>${escape(sourceStates[source.state] ?? 'State not recorded')}</span><time datetime="${source.checkedAt}">${checkedTime(source.checkedAt)}</time></div>
<h3>${escape(source.name)}</h3><strong>${escape(source.result)}</strong><p>${escape(source.scope)}</p></article>`).join('')}</div>
<p class="footnote">A check time records the coverage described above. It does not certify an entire platform or every post. An inaccessible source is recorded as blocked, never as unchanged.</p></section>
<section><div class="section-head"><h2>Watched repositories <span class="count">${upstream.repositories.length}</span></h2>${external(`${repo}/actions/workflows/upstream.yml`, 'Check runs')}</div>
<div class="table-wrap"><table class="repo-table"><thead><tr><th scope="col">Repository</th><th scope="col">Reviewed commit</th><th scope="col">Release</th><th scope="col">Tracked as</th></tr></thead><tbody>${upstream.repositories.map(item => {
  const entry = trackedBy(item.repository);
  return `<tr><td>${external(`https://github.com/${item.repository}`, item.repository)}</td><td data-label="Commit"><code>${item.commit.slice(0, 8)}</code></td><td data-label="Release">${item.release ? `<code>${escape(item.release.tag)}</code>` : '<span class="none">None</span>'}</td><td data-label="Entry">${entry ? `<a href="../${noteLink(entry)}">${escape(entry.project)}</a>` : '<span class="none">No entry yet</span>'}</td></tr>`;
}).join('')}</tbody></table></div>
<p class="footnote">A changed commit or release opens a review issue. The research pass reads the artifact before the tracker changes.</p></section>
<section id="pending"><div class="section-head"><h2>Pending evidence <span class="count">${held.length}</span></h2><span>Held from the main register</span></div>
${held.length ? `<div class="pending">${held.map(entry => `<article class="pending-card"><div class="card-top">${stage(entry)}${entry.cve ? `<code>${escape(entry.cve)}</code>` : ''}</div><h3><a href="../${noteLink(entry)}">${escape(entry.project)}</a></h3><p><span class="label">Missing</span>${escape(entry.reviewBasis)}</p><a href="../${noteLink(entry)}">Existing assessment <span aria-hidden="true">→</span></a></article>`).join('')}</div>` : '<p class="muted">Nothing is held right now.</p>'}
<p class="footnote">Holding an item means its public evidence is insufficient for the main register. It is not a judgment about whether AI was used.</p></section>
<section><div class="section-head"><h2>Publication gate</h2><a href="../about/">Full review criteria <span aria-hidden="true">→</span></a></div>
<div class="gate">
<div><h3>Required for a new repository</h3><ul><li>Inspectable code that implements the claimed behavior</li><li>An exact target and build</li><li>Useful supporting evidence or a control</li><li>Claims that match the artifact</li></ul></div>
<div><h3>Can qualify with explicit labels</h3><ul><li>Original researcher announcements</li><li>Demonstrations (not counted as public exploits)</li></ul><h3>Sourcing</h3><ul><li>Discord supplies leads; public entries cite public primary sources</li></ul></div>
<div><h3>Held out</h3><ul><li>Reposts and recycled code</li><li>Placeholder exploits</li><li>Screenshots without a verifiable claim</li><li>README-only repositories</li></ul><h3>Not evidence</h3><ul><li>Repository stars and writing style</li></ul></div>
</div></section>
</main>`});
}

function about() {
  const definitions = [
    ['released', 'Public release', 'A usable artifact or source release exists within the documented scope.'],
    ['poc', 'Public PoC', 'A proof of concept is available. Capability may stop at a crash or a limited read/write.'],
    ['demo', 'Private demonstration', 'A result is shown, with implementation or reproduction still unavailable.'],
    ['announced', 'Release announced', 'The original researcher has stated a publication plan. The artifact is pending.'],
  ];
  const legend = [...definitions.map(([type, status, text]) => [stage({type, status}), text]), [stage({held:true, status:'Pending evidence'}), 'A material gap keeps the item out of the main register.']];
  return shell({title:'Review criteria', description:'Evidence standards and publication rules for the iOS Research Tracker.', base:'../', active:'about', body:`
<main id="main" class="wrap page info about">
<header class="page-head"><h1>Review criteria</h1><p>Every entry is a dated assessment of a specific public artifact.</p></header>
<section id="status"><div class="section-head"><h2>Stages</h2><span>Public availability, not severity</span></div>
<dl class="legend">${legend.map(([chip, text]) => `<div><dt>${chip}</dt><dd>${text}</dd></div>`).join('')}</dl>
<p class="footnote">The four bars show how much of a development is publicly available. Capability is assessed separately in each entry.</p></section>
<div class="about-grid">
<section><h2>What qualifies</h2><p>A material source release, a substantive disclosure, a useful reproduction, or an original researcher’s specific announcement or demonstration. Each must change the understanding of a capability, support range, delivery path, patch, or release.</p><p>For source repositories, inspect the actual code at a frozen revision. Trace the path from attacker input to the reported effect. Check build requirements, supplied logs, controls, and attribution. A convincing README with a placeholder implementation does not qualify. Reposts and copied evidence do not provide independent confirmation.</p></section>
<section><h2>What the claim must establish</h2><ul class="checklist"><li>The exact device and build</li><li>The process that handles the input</li><li>The address and value the input can influence</li><li>The effect that survives the corruption</li><li>The protections and chain stages still needed</li></ul><p>A crash is a crash. A bounded file read is a bounded file read. Kernel memory access does not establish a code-signing bypass, persistence, or a complete jailbreak. Runtime claims remain attributed to their source until independently reproduced.</p></section>
<section><h2>How the loop works</h2><ul class="checklist"><li><strong>08:00 &amp; 20:00 Pacific.</strong> A research pass samples original X posts, accessible Discord research discussions, and repository changes. It follows leads to public primary sources and updates qualifying records through a branch and pull request.</li><li><strong>03:23 &amp; 15:23 UTC.</strong> A GitHub Actions check compares watched commits and published releases with reviewed baselines. Changes open or update a review issue. This check does not judge new capabilities.</li><li><strong>Access.</strong> The research pass needs the local computer, the app, and signed-in source sessions. When a source is inaccessible, its check is marked blocked. No full-platform coverage is implied. Private discussions and direct messages are never published.</li></ul><p class="inline-links">${external(`${repo}/issues?q=is%3Aissue+is%3Aopen+label%3Aupstream-review`, 'Changes awaiting review')}<a href="../coverage/">Latest source coverage</a></p></section>
</div>
<section id="terms"><div class="section-head"><h2>Technical terms</h2></div><dl class="terms">
<div><dt>PoC</dt><dd>Proof of concept: an artifact that reproduces a specific behavior.</dd></div>
<div><dt>Kernel read/write</dt><dd>The ability to read or change kernel memory. Address, value, and memory-region restrictions still matter.</dd></div>
<div><dt>SPTM / TXM</dt><dd>Apple’s Secure Page Table Monitor and Trusted Execution Monitor protect memory mappings and code policy beyond ordinary kernel authority.</dd></div>
<div><dt>PAC</dt><dd>Pointer authentication: checks that help protect code pointers and return addresses.</dd></div>
<div><dt>MIE</dt><dd>Memory Integrity Enforcement: Apple’s memory allocators, tagging, and related protections on supported hardware.</dd></div>
<div><dt>Tethered boot</dt><dd>A boot workflow that requires an attached computer each time the device starts.</dd></div>
</dl></section>
</main>`});
}

function feed() {
  const stamp = value => `${value}T12:00:00Z`;
  const updated = entries.map(entry => entry.reviewed).sort().at(-1) ?? data.reviewed;
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>iOS Research Tracker</title>
<subtitle>iOS jailbreak releases, demonstrations, and public vulnerability research, with evidence limits.</subtitle>
<link rel="self" href="${site}feed.xml"/><link rel="alternate" href="${site}"/>
<id>${site}</id><updated>${stamp(updated)}</updated><author><name>iOS Research Tracker</name></author>
${entries.map(entry => `<entry><title>${escape(`${entry.project}: ${entry.update}`)}</title><link rel="alternate" href="${site}${noteLink(entry)}"/><id>${site}${noteLink(entry)}</id><published>${stamp(entry.date)}</published><updated>${stamp(entry.reviewed)}</updated><category term="${entry.type}" label="${escape(entry.status)}"/><summary>${escape(`${entry.status} · ${entry.capability} · ${entry.trackerScope}. ${entry.dek}`)}</summary></entry>`).join('\n')}
</feed>
`;
}

await rm(`${root}dist`, {recursive:true, force:true});
await mkdir(`${root}dist/assets`, {recursive:true});
await cp(`${root}assets`, `${root}dist/assets`, {recursive:true});
await writeFile(`${root}dist/index.html`, home());
await writeFile(`${root}dist/feed.xml`, feed());
for (const [route, render] of [['about', about], ['coverage', coveragePage]]) {
  await mkdir(`${root}dist/${route}`, {recursive:true});
  await writeFile(`${root}dist/${route}/index.html`, render());
}
for (const entry of data.entries) {
  await mkdir(`${root}dist/notes/${entry.id}`, {recursive:true});
  await writeFile(`${root}dist/notes/${entry.id}/index.html`, article(entry));
}
await writeFile(`${root}dist/.nojekyll`, '');
console.log(`Built ${entries.length} tracked developments, ${held.length} pending record, source coverage, and the feed.`);
