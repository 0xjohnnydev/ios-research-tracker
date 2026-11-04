import { readFile, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
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
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const date = value => new Intl.DateTimeFormat('en', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const shortDate = value => new Intl.DateTimeFormat('en', {day:'2-digit', month:'short', timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const checkedTime = value => new Intl.DateTimeFormat('en', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZone:'America/Los_Angeles', timeZoneName:'short'}).format(new Date(value));
const repo = 'https://github.com/0xjohnnydev/ios-research-tracker';
const external = (url, title) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(title)} <span aria-hidden="true">↗</span></a>`;
const paragraphs = values => values.map(value => `<p>${escape(value)}</p>`).join('');
const status = entry => `<span class="status status-${entry.held ? 'held' : entry.type}">${escape(entry.status)}</span>`;
const noteLink = (entry, base = '') => `${base}notes/${entry.id}/`;

function shell({title, description, body, base = '', active = 'record'}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | iOS Research Tracker</title><meta name="description" content="${escape(description)}"><meta name="theme-color" content="#f8f9fa">
<meta property="og:title" content="${escape(title)} | iOS Research Tracker"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}assets/style.css?v=${assetVersion}"><script src="${base}assets/site.js?v=${assetVersion}" defer></script>
</head><body><a class="skip" href="#main">Skip to content</a>
<div class="workspace"><aside class="sidebar">
<a class="wordmark" href="${base || './'}"><span class="brand-mark" aria-hidden="true">i</span><span>iOS Research<span class="brand-sub">Development tracker</span></span></a>
<nav aria-label="Main navigation">
<a ${active === 'record' ? 'aria-current="page"' : ''} href="${base || './'}"><span class="nav-icon" aria-hidden="true">≡</span>Developments<span class="nav-count">${entries.length}</span></a>
<a ${active === 'coverage' ? 'aria-current="page"' : ''} href="${base}coverage/"><span class="nav-icon" aria-hidden="true">◷</span>Sources &amp; checks</a>
<a ${active === 'about' ? 'aria-current="page"' : ''} href="${base}about/"><span class="nav-icon" aria-hidden="true">⊞</span>Review criteria</a>
</nav>
<div class="sidebar-section"><span class="label">Research scope</span><p>Jailbreaks<br>Kernel &amp; platform security<br>Public PoCs &amp; disclosures</p></div>
<div class="sidebar-bottom"><span class="label">Research loop</span><strong>08:00 / 20:00</strong><span>Pacific time · twice daily</span><a href="${base}coverage/">X, Discord &amp; GitHub <span aria-hidden="true">→</span></a><div class="sidebar-links">${external(repo, 'Source repository')}${external(`${repo}/issues/new?template=correction.md`, 'Suggest a correction')}</div></div>
</aside><div class="main-panel"><header class="topbar"><div><span class="topbar-parent">Research</span><span aria-hidden="true">/</span><span>${active === 'record' ? 'Developments' : active === 'coverage' ? 'Sources & checks' : active === 'about' ? 'Review criteria' : 'Evidence record'}</span></div><a href="${base}coverage/">Review loop <span class="cadence">2× daily</span></a></header>
<div class="content">${body}<footer class="footer"><span>Research reviewed ${date(data.reviewed)}</span><a href="${base}coverage/">Sources &amp; latest checks <span aria-hidden="true">→</span></a></footer></div></div></div>
</body></html>`;
}

function priorityWatch() {
  const priority = entries.filter(entry => entry.priority);
  return `<section class="watchlist" aria-labelledby="priority-title" data-priorities>
<div class="section-heading"><h2 id="priority-title"><span class="priority-marker" aria-hidden="true"></span>Priority watch</h2><span>Jailbreak relevance</span></div>
<ol class="priority-list">${priority.map((entry, index) => `<li class="priority-item ${index === 0 ? 'priority-first' : ''}">
<span class="priority-index">${String(index + 1).padStart(2, '0')}</span>
<div class="priority-main"><div class="priority-title-line"><a href="${noteLink(entry)}"><h3>${escape(entry.project)}</h3></a>${status(entry)}</div><p>${escape(entry.priorityNote)}</p></div>
<div class="priority-next"><span class="label">Watching for</span><p>${escape(entry.nextStep)}</p><a href="${noteLink(entry)}">Evidence &amp; scope <span aria-hidden="true">↗</span></a></div>
</li>`).join('')}</ol></section>`;
}

function home() {
  const filters = [['all', 'All developments'], ['released', 'Released'], ['poc', 'Public PoCs'], ['demo', 'Demos'], ['announced', 'Announced']];
  const rows = entries.map(entry => `<tr data-entry data-type="${entry.type}" data-search="${escape([entry.project, entry.title, entry.dek, entry.scope, entry.topic, entry.cve || ''].join(' '))}">
<td class="development"><a class="project-link" href="${noteLink(entry)}">${escape(entry.project)}</a><p>${escape(entry.update)}</p><div class="row-meta">${entry.cve ? `<code>${escape(entry.cve)}</code><span aria-hidden="true">·</span>` : ''}<time datetime="${entry.date}">${shortDate(entry.date)}</time></div></td>
<td class="status-cell" data-label="Status">${status(entry)}</td>
<td class="capability" data-label="Capability">${escape(entry.capability)}</td>
<td class="tracker-scope" data-label="Device / version">${escape(entry.trackerScope)}</td>
<td class="artifact-cell" data-label="Evidence">${external(entry.sources[0].url, entry.artifact)}<a class="evidence-link" href="${noteLink(entry)}">Review &amp; limitations <span aria-hidden="true">→</span></a><span class="reviewed-date">Reviewed ${shortDate(entry.reviewed)}</span></td>
</tr>`).join('');
  return shell({title:'Developments', description:'An evidence-led tracker of iOS jailbreak releases, demonstrations, and public vulnerability research.', body:`
<main id="main" class="tracker-page">
<header class="page-heading"><div><h1>Development tracker</h1><p>iOS jailbreaks, public research, and the evidence behind them.</p></div><div class="review-date"><span class="label">Last research review</span><time datetime="${data.reviewed}">${date(data.reviewed)}</time></div></header>
${priorityWatch()}
<section id="record" aria-labelledby="record-title"><div class="section-heading record-heading"><h2 id="record-title">Research register <span class="total-count">${entries.length}</span></h2><a href="coverage/#pending">${held.length} pending evidence <span aria-hidden="true">↗</span></a></div>
<form class="record-tools" role="search" data-filters hidden><div class="filters" aria-label="Filter entries">${filters.map(([value, label]) => `<button type="button" data-filter="${value}" aria-pressed="${value === 'all'}">${label}<span>${value === 'all' ? entries.length : entries.filter(entry => entry.type === value).length}</span></button>`).join('')}</div>
<label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span class="sr-only">Search developments</span><input type="search" name="q" placeholder="Search projects, CVEs, builds…" autocomplete="off"></label></form>
<p class="sr-only" role="status" data-results></p><div class="table-wrap"><table class="tracker-table"><caption class="sr-only">Research developments reviewed ${date(data.reviewed)}</caption><thead><tr><th scope="col">Development</th><th scope="col">Status</th><th scope="col">Capability</th><th scope="col">Device / version</th><th scope="col">Evidence</th></tr></thead><tbody>${rows}</tbody></table></div>
<div class="empty" data-empty hidden><h2>No matching developments</h2><p>Try another project, CVE, or build.</p><button type="button" class="text-link" data-reset>Clear filters</button></div>
<div class="register-note"><p>Ordered by priority, then publication date. Author-supplied results are attributed. Independent execution is identified explicitly.</p><a href="about/">Inclusion criteria <span aria-hidden="true">↗</span></a></div>
</section></main>`});
}

function article(entry) {
  const sources = entry.sources.map((source, i) => `<li><span class="source-index">${String(i + 1).padStart(2, '0')}</span><div>${external(source.url, source.title)}<p>${escape(source.kind)} · ${escape(new URL(source.url).hostname)}</p></div></li>`).join('');
  return shell({title:entry.title, description:entry.dek, base:'../../', active:'', body:`
<main id="main" class="article-page"><a class="back-link" href="../../${entry.held ? 'coverage/#pending' : '#record'}"><span aria-hidden="true">←</span> ${entry.held ? 'Pending evidence' : 'All developments'}</a>
<header class="article-heading"><div class="entry-meta">${status(entry)}<span>${escape(entry.topic)}</span></div><h1>${escape(entry.title)}</h1><p class="article-dek">${escape(entry.dek)}</p><div class="article-dateline">Published ${date(entry.date)}<span aria-hidden="true">/</span>Reviewed ${date(entry.reviewed)}</div></header>
<div class="article-layout"><aside class="article-rail"><span class="label">Device &amp; build scope</span><p>${escape(entry.scope)}</p>${entry.cve ? `<code>${escape(entry.cve)}</code>` : ''}<span class="label rail-label">Review basis</span><p>${escape(entry.reviewBasis)}</p><a href="../../about/#terms">Technical terms <span aria-hidden="true">↗</span></a></aside>
<div class="article-copy"><section><h2>What the record establishes</h2>${paragraphs(entry.observed)}</section><section><h2>Why it matters</h2><p>${escape(entry.meaning)}</p></section><section class="limits"><h2>Where the evidence stops</h2><ul>${entry.limits.map(value => `<li>${escape(value)}</li>`).join('')}</ul></section><section class="sources"><h2>Source record</h2><ol>${sources}</ol></section><div class="revision"><span class="label">Reviewed artifact</span><p>${escape(entry.revision)}</p></div><div class="correction">${external(`${repo}/issues/new?template=correction.md&title=${encodeURIComponent(`Correction: ${entry.id}`)}`, 'Suggest a correction')}</div></div></div></main>`});
}

function coveragePage() {
  return shell({title:'Sources & checks', description:'Twice-daily research coverage, source checks, and developments awaiting better evidence.', base:'../', active:'coverage', body:`
<main id="main" class="info-page"><header class="page-heading"><div><h1>Sources &amp; checks</h1><p>What is checked, what passed review, and where coverage stops.</p></div><span class="cadence">08:00 / 20:00 Pacific</span></header>
<section class="coverage-section"><div class="section-heading"><h2>Latest source pass</h2><span>Sampled coverage</span></div><div class="coverage-list">${coverage.sources.map(source => `<div class="coverage-row"><h3>${escape(source.name)}</h3><div><strong>${escape(source.result)}</strong><p>${escape(source.scope)}</p></div><time datetime="${source.checkedAt}">${checkedTime(source.checkedAt)}</time></div>`).join('')}</div><p class="section-note">A check time records the coverage described above. It does not certify an entire platform or every post. An inaccessible source is recorded as blocked, never as unchanged.</p></section>
<section class="coverage-section"><div class="section-heading"><h2>Watched repositories</h2>${external(`${repo}/actions/workflows/upstream.yml`, 'Check runs')}</div><p class="section-intro">The repository check runs twice daily. A changed commit or release enters review. The research loop reads the artifact before updating the tracker.</p><ul class="repository-list">${upstream.repositories.map(item => `<li>${external(`https://github.com/${item.repository}`, item.repository)}<code>${item.commit.slice(0, 8)}</code></li>`).join('')}</ul></section>
<section id="pending" class="coverage-section"><div class="section-heading"><h2>Pending evidence</h2><span>${held.length} held from the main register</span></div>${held.map(entry => `<article class="pending-item"><div><a href="../${noteLink(entry)}"><h3>${escape(entry.project)}</h3></a>${status(entry)}</div><p>${escape(entry.reviewBasis)}</p><a href="../${noteLink(entry)}">Read the existing assessment <span aria-hidden="true">→</span></a></article>`).join('')}<p class="section-note">Holding an item means its public evidence is insufficient for the main register. It is not a judgment about whether AI was used.</p></section>
<section class="coverage-section coverage-policy"><h2>Publication gate</h2><p>New repositories need inspectable code that implements the claimed behavior, an exact target and build, and useful supporting evidence or a control. Claims must match the artifact. Researcher announcements and demonstrations can qualify with explicit labels; they are not counted as public exploits.</p><p>Discord supplies leads. Public entries cite public primary sources. Reposts, recycled code, placeholder exploits, screenshots without a verifiable claim, and README-only repositories are held out. Repository stars and writing style are not evidence.</p><a href="../about/">Full review criteria <span aria-hidden="true">→</span></a></section>
</main>`});
}

function about() {
  return shell({title:'Review criteria', description:'Evidence standards and publication rules for the iOS Research Tracker.', base:'../', active:'about', body:`
<main id="main" class="info-page about-page"><header class="page-heading"><div><h1>Review criteria</h1><p>Every entry is a dated assessment of a specific public artifact.</p></div></header>
<div class="about-layout"><section><h2>What qualifies</h2><p>A material source release, a substantive disclosure, a useful reproduction, or an original researcher’s specific announcement or demonstration. Each must change the understanding of a capability, support range, delivery path, patch, or release.</p><p>For source repositories, inspect the actual code at a frozen revision. Trace the path from attacker input to the reported effect. Check build requirements, supplied logs, controls, and attribution. A convincing README with a placeholder implementation does not qualify. Reposts and copied evidence do not provide independent confirmation.</p><h2>What the claim must establish</h2><p>The exact device and build. The process that handles the input. The address and value the input can influence. The effect that survives the corruption. The protections and chain stages still needed.</p><p>A crash is a crash. A bounded file read is a bounded file read. Kernel memory access does not establish a code-signing bypass, persistence, or a complete jailbreak. Runtime claims remain attributed to their source until independently reproduced.</p><h2>How the loop works</h2><p>A research pass is scheduled for 08:00 and 20:00 Pacific. It samples original X posts, accessible Discord research discussions, and repository changes. It follows leads to public primary sources and updates qualifying records through a branch and pull request.</p><p>A separate GitHub Actions check runs at 03:23 and 15:23 UTC. It compares watched commits and published releases with reviewed baselines. Changes open or update a review issue. This check does not judge new capabilities.</p><p>The research pass needs the local computer, the app, and signed-in source sessions. When a source is inaccessible, its check is marked blocked. No full-platform coverage is implied. Private discussions and direct messages are never published.</p><p>${external(`${repo}/issues?q=is%3Aissue+is%3Aopen+label%3Aupstream-review`, 'Changes awaiting review')} · <a href="../coverage/">Latest source coverage</a></p></section><aside><h2>Status definitions</h2><dl class="definitions"><dt>Public release</dt><dd>A usable artifact or source release exists within the documented scope.</dd><dt>Public PoC</dt><dd>A proof of concept is available. Capability may stop at a crash or a limited read/write.</dd><dt>Private demonstration</dt><dd>A result is shown, with implementation or reproduction still unavailable.</dd><dt>Release announced</dt><dd>The original researcher has stated a publication plan. The artifact is pending.</dd><dt>Pending evidence</dt><dd>A material gap keeps the item out of the main register.</dd></dl></aside></div>
<section id="terms" class="terms"><h2>Technical terms</h2><dl><div><dt>PoC</dt><dd>Proof of concept: an artifact that reproduces a specific behavior.</dd></div><div><dt>Kernel read/write</dt><dd>The ability to read or change kernel memory. Address, value, and memory-region restrictions still matter.</dd></div><div><dt>SPTM / TXM</dt><dd>Apple’s Secure Page Table Monitor and Trusted Execution Monitor protect memory mappings and code policy beyond ordinary kernel authority.</dd></div><div><dt>PAC</dt><dd>Pointer authentication: checks that help protect code pointers and return addresses.</dd></div><div><dt>MIE</dt><dd>Memory Integrity Enforcement: Apple’s memory allocators, tagging, and related protections on supported hardware.</dd></div><div><dt>Tethered boot</dt><dd>A boot workflow that requires an attached computer each time the device starts.</dd></div></dl></section></main>`});
}

await rm(`${root}dist`, {recursive:true, force:true});
await mkdir(`${root}dist/assets`, {recursive:true});
await cp(`${root}assets`, `${root}dist/assets`, {recursive:true});
await writeFile(`${root}dist/index.html`, home());
for (const [route, render] of [['about', about], ['coverage', coveragePage]]) {
  await mkdir(`${root}dist/${route}`, {recursive:true});
  await writeFile(`${root}dist/${route}/index.html`, render());
}
for (const entry of data.entries) {
  await mkdir(`${root}dist/notes/${entry.id}`, {recursive:true});
  await writeFile(`${root}dist/notes/${entry.id}/index.html`, article(entry));
}
await writeFile(`${root}dist/.nojekyll`, '');
console.log(`Built ${entries.length} tracked developments, ${held.length} pending record, and source coverage.`);
