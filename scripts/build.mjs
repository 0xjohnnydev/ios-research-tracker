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
// Status icons fill as more of a development becomes public: dashed (announced), half (demo), three-quarters (PoC), done (released).
const ring = '<circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>';
const glyphs = {
  announced: '<circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.6 1.55"/>',
  demo: `${ring}<path d="M7 7V3.5A3.5 3.5 0 0 1 7 10.5Z" fill="currentColor"/>`,
  poc: `${ring}<path d="M7 7V3.5A3.5 3.5 0 1 1 3.5 7Z" fill="currentColor"/>`,
  released: '<circle cx="7" cy="7" r="7" fill="currentColor"/><path class="knock" d="M4.3 7.2 6.2 9.1 9.8 5.3" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  held: `${ring}<path d="M5 5 9 9M9 5 5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  checked: '<circle cx="7" cy="7" r="7" fill="currentColor"/><path class="knock" d="M4.3 7.2 6.2 9.1 9.8 5.3" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  partial: `${ring}<path d="M7 7V3.5A3.5 3.5 0 0 1 7 10.5Z" fill="currentColor"/>`,
  blocked: `${ring}<path d="M5 5 9 9M9 5 5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  unknown: '<circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.6 1.55"/>',
};
const icon = kind => `<svg class="si si-${kind}" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">${glyphs[kind]}</svg>`;
const kindOf = entry => entry.held ? 'held' : entry.type;
const stageLabels = {announced: 'Announced', demo: 'Demo only', poc: 'Proof of concept', released: 'Released'};
// Home page groups, after the ranked jailbreak watch. Every entry needs one of these categories.
const categories = [
  ['tools', 'Jailbreaks and tools', 'Released jailbreaks and research setups you can run.'],
  ['chains', 'Exploit chains', 'Demos that link several bugs into a full attack.'],
  ['kernel', 'Kernel bugs', 'Bugs in the kernel, the core of iOS. Kernel access is the main step toward a jailbreak.'],
  ['sandbox', 'App sandbox', 'Bugs that let an app reach files or powers outside its sandbox.'],
  ['input', 'Files, images and messages', 'Bugs set off by opening a file, image, video or link. This is how an attack could first get in.'],
];
for (const entry of data.entries) if (!categories.some(([id]) => id === entry.category)) throw new Error(`${entry.id}: unknown category ${entry.category}`);
const categoryName = entry => categories.find(([id]) => id === entry.category)[1];
function stage(entry) {
  const level = entry.held ? 0 : levels[entry.type] ?? 0;
  return `<span class="stage" title="Public availability: ${levelNames[level]} (${level} of 4)">${icon(kindOf(entry))}${escape(entry.status)}</span>`;
}
const arrow = '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M4.5 9.5 9.5 4.5M5.5 4.5h4v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// A short fingerprint of the fields a reader scans, so returning visitors can see what changed.
const signature = entry => createHash('sha1').update([entry.type, entry.status, entry.update, entry.capability, entry.trackerScope, entry.artifact, entry.date, entry.priority ?? ''].join('\u0001')).digest('hex').slice(0, 10);
const tracked = entry => `data-id="${entry.id}" data-sig="${signature(entry)}"`;
const props = items => `<dl class="props">${items.filter(Boolean).map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl>`;

const sourceStates = {checked: 'Checked', partial: 'Partial', blocked: 'Blocked'};
const sourceState = source => sourceStates[source.state] ? source.state : 'unknown';
const lastPass = coverage.sources.map(source => source.checkedAt).sort().at(-1);

function shell({title, description, body, base = '', active = ''}) {
  const nav = [['record', base || './', 'Tracker'], ['coverage', `${base}coverage/`, 'Sources'], ['about', `${base}about/`, 'Criteria']];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | iOS Research Tracker</title><meta name="description" content="${escape(description)}">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#101113" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="${escape(title)} | iOS Research Tracker"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/atom+xml" title="iOS Research Tracker" href="${base}feed.xml">
<link rel="stylesheet" href="${base}assets/style.css?v=${assetVersion}"><script src="${base}assets/site.js?v=${assetVersion}" defer></script>
</head><body><a class="skip" href="#main">Skip to content</a>
<header class="topbar"><div class="wrap topbar-row">
<a class="brand" href="${base || './'}"><img src="${base}assets/favicon.svg" alt="" width="20" height="20">iOS Research Tracker</a>
<nav class="nav" aria-label="Main navigation">${nav.map(([key, href, label]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
<div class="topbar-end"><a href="${base}feed.xml">Feed</a>${external(repo, 'GitHub')}</div>
</div></header>
${body}
<footer class="footer"><div class="wrap footer-row">
<span>Last reviewed <time datetime="${data.reviewed}">${date(data.reviewed)}</time></span>
<span class="footer-links"><a href="${base}feed.xml">Atom feed</a>${external(repo, 'GitHub')}${external(`${repo}/issues/new?template=correction.md`, 'Suggest a correction')}</span>
</div></footer>
</body></html>`;
}

// Last pass time, plus any source that was not fully checked. A fully checked pass stays quiet.
function passStatus(base = '') {
  const flagged = coverage.sources.filter(source => source.state !== 'checked');
  return `<p class="pass"><a href="${base}coverage/">Sources checked <time datetime="${lastPass}" data-ago>${checkedTime(lastPass)}</time></a>${flagged.length
    ? flagged.map(source => `<span class="flag flag-${sourceState(source)}" title="${escape(source.result)}">${icon(sourceState(source))}${escape(source.name)} ${escape((sourceStates[source.state] ?? 'state not recorded').toLowerCase())}</span>`).join('')
    : `<span class="flag flag-checked">${icon('checked')}All sources fully checked</span>`}</p>`;
}

function row(entry, index) {
  return `<tr data-entry data-type="${entry.type}" data-rank="${index}" data-date="${entry.date}" ${tracked(entry)} data-search="${escape([entry.project, entry.summary, entry.title, entry.dek, entry.update, entry.scope, entry.trackerScope, entry.topic, entry.capability, entry.status, entry.artifact, entry.priorityNote, entry.nextStep, entry.cve, ...entry.observed].filter(Boolean).join(' '))}">
<td class="c-icon" title="${escape(entry.status)}">${icon(entry.type)}<span class="sr-only">${escape(entry.status)}</span></td>
<td class="c-main"><a class="row-link" href="${noteLink(entry)}">${escape(entry.project)}</a><span data-badge></span><span class="upd">${escape(entry.summary)}</span></td>
<td class="c-stage">${stageLabels[entry.type] ?? escape(entry.status)}</td>
<td class="c-date"><time datetime="${entry.date}">${shortDate(entry.date)}</time></td>
<td class="c-src"><a href="${escape(entry.sources[0].url)}" target="_blank" rel="noopener noreferrer" title="${escape(entry.artifact)}">${arrow}<span class="sr-only">${escape(entry.artifact)}</span></a></td>
</tr>`;
}

function home() {
  const watching = entries.filter(entry => entry.priority);
  const group = (label, blurb, list, attrs = '') => list.length ? `<tbody data-group ${attrs}><tr class="group"><th colspan="5" scope="rowgroup"><span class="group-name">${label}<span class="count">${list.length}</span></span><span class="blurb">${blurb}</span></th></tr>${list.map(entry => row(entry, entries.indexOf(entry))).join('')}</tbody>` : '';
  return shell({title:'iOS jailbreak research', description:'An evidence-led tracker of iOS jailbreak releases, demonstrations, and public vulnerability research.', active:'record', body:`
<main id="main" class="wrap page">
<div class="head home-head"><div><h1>iOS jailbreak research</h1>${passStatus()}</div>
<form class="search-form" role="search" data-filters hidden><label class="search"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span class="sr-only">Search</span><input type="search" name="q" placeholder="Search" autocomplete="off"><kbd aria-hidden="true">/</kbd></label></form></div>
<section id="record" aria-labelledby="record-title">
<h2 id="record-title" class="sr-only">Tracked research</h2>
<p class="sr-only" role="status" data-results></p>
<table class="list"><caption class="sr-only">Tracked research, reviewed ${date(data.reviewed)}</caption>
<thead class="sr-only"><tr><th scope="col">Status</th><th scope="col">Name and summary</th><th scope="col">Stage</th><th scope="col">Date</th><th scope="col">Primary source</th></tr></thead>
${group('Jailbreak watch', 'The closest things to a jailbreak right now, most important first.', watching, 'data-priorities')}
${categories.map(([id, label, blurb]) => group(label, blurb, entries.filter(entry => !entry.priority && entry.category === id))).join('\n')}
</table>
<div class="empty" data-empty hidden>Nothing matches. <button type="button" data-reset>Clear search</button></div>
${held.length ? `<p class="more"><a href="coverage/#pending">${held.length} more pending evidence</a></p>` : ''}
</section>
</main>`});
}

function article(entry) {
  const sources = entry.sources.map(source => `<li>${external(source.url, source.title)}<span>${escape(source.kind)}</span></li>`).join('');
  const back = entry.held ? ['../../coverage/#pending', 'Pending evidence'] : ['../../', 'Tracker'];
  return shell({title:entry.title, description:entry.dek, base:'../../', body:`
<main id="main" class="wrap page record">
<nav class="crumbs" aria-label="Breadcrumb"><a href="${back[0]}">${back[1]}</a><span aria-hidden="true">/</span><span>${escape(entry.project)}</span></nav>
<div class="record-grid">
<article class="record-main">
<h1>${escape(entry.project)}</h1>
<p class="dek">${escape(entry.dek)}</p>
${entry.held ? `<p class="callout">${icon('held')}<span><strong>Not on the main list yet.</strong> ${escape(entry.reviewBasis)}</span></p>` : ''}
<section><h2>What it means</h2><p>${escape(entry.meaning)}</p></section>
<section><h2>What the evidence shows</h2><ol>${entry.observed.map(value => `<li>${escape(value)}</li>`).join('')}</ol></section>
<section><h2>What it does not show</h2><ul>${entry.limits.map(value => `<li>${escape(value)}</li>`).join('')}</ul></section>
</article>
<aside class="record-side">
${props([['Category', escape(categoryName(entry))], ['Stage', stage(entry)], ['Latest', escape(entry.update)], entry.priority && !entry.held ? ['Priority', `Watching #${entry.priority}`] : null, entry.cve ? ['CVE', `<code>${escape(entry.cve)}</code>`] : null, ['Shows', escape(entry.capability)], ['Tested on', escape(entry.scope)], ['Published', `<time datetime="${entry.date}">${date(entry.date)}</time>`], ['Reviewed', `<time datetime="${entry.reviewed}">${date(entry.reviewed)}</time>`], entry.priority && !entry.held ? ['Next to watch', escape(entry.nextStep)] : null])}
<h2>Sources</h2><ol class="sources">${sources}</ol>
<h2>What we reviewed</h2>
${entry.held ? '' : `<p>${escape(entry.reviewBasis)}</p>`}
<p class="mono">${escape(entry.revision)}</p>
<p class="side-links"><a href="../../about/#terms">Terms</a>${external(`${repo}/issues/new?template=correction.md&title=${encodeURIComponent(`Correction: ${entry.id}`)}`, 'Suggest a correction')}</p>
</aside>
</div>
</main>`});
}

function coveragePage() {
  const trackedBy = repository => data.entries.find(entry => entry.sources.some(source => source.url.startsWith(`https://github.com/${repository}/`)));
  return shell({title:'Sources & checks', description:'Twice-daily research coverage, source checks, and developments awaiting better evidence.', base:'../', active:'coverage', body:`
<main id="main" class="wrap page">
<div class="head"><h1>Sources</h1><p class="sub">We check X and GitHub at 8:00 and 20:00 Pacific.</p></div>
<section class="block" aria-labelledby="pass-title"><h2 id="pass-title" class="group-title">Last check</h2>
${coverage.sources.map(source => `<details class="item"><summary>${icon(sourceState(source))}<strong>${escape(source.name)}</strong><span class="state">${escape(sourceStates[source.state] ?? 'State not recorded')}</span><span class="upd">${escape(source.result)}</span><time datetime="${source.checkedAt}">${checkedTime(source.checkedAt)}</time></summary><p>${escape(source.scope)}</p></details>`).join('')}
<p class="note">Each check reads a sample, not everything. A source we could not reach is marked blocked, never unchanged. Click a source for details.</p></section>
<section class="block" aria-labelledby="repo-title"><h2 id="repo-title" class="group-title">Watched repositories<span class="count">${upstream.repositories.length}</span>${external(`${repo}/actions/workflows/upstream.yml`, 'Checked twice a day', 'group-link')}</h2>
<table class="repos"><thead class="sr-only"><tr><th scope="col">Repository</th><th scope="col">Reviewed commit</th><th scope="col">Release</th><th scope="col">Tracked as</th></tr></thead><tbody>${upstream.repositories.map(item => {
  const entry = trackedBy(item.repository);
  return `<tr><td>${external(`https://github.com/${item.repository}`, item.repository)}</td><td><code>${item.commit.slice(0, 8)}</code></td><td>${item.release ? `<code>${escape(item.release.tag)}</code>` : '<span class="none">No release</span>'}</td><td>${entry ? `<a href="../${noteLink(entry)}">${escape(entry.project)}</a>` : '<span class="none">No entry yet</span>'}</td></tr>`;
}).join('')}</tbody></table></section>
<section id="pending" class="block" aria-labelledby="pending-title"><h2 id="pending-title" class="group-title">Pending evidence<span class="count">${held.length}</span></h2>
${held.length ? held.map(entry => `<a class="item item-link" href="../${noteLink(entry)}">${icon('held')}<strong>${escape(entry.project)}</strong><span class="upd">${escape(entry.reviewBasis)}</span></a>`).join('') : '<p class="note">Nothing is pending right now.</p>'}
<p class="note">These need more public evidence before they go on the main list. Holding one back is not a judgment about whether AI was used.</p></section>
</main>`});
}

function about() {
  const definitions = [
    ['released', 'Public release', 'Usable code or a working tool is out, within its stated limits.'],
    ['poc', 'Public PoC', 'Proof-of-concept code is public. It may only cause a crash or give limited memory access.'],
    ['demo', 'Private demonstration', 'The result has been shown, usually in a video. The code is private and nobody has reproduced it.'],
    ['announced', 'Release announced', 'The original researcher says a release is coming. Nothing is public yet.'],
  ];
  const legend = [...definitions.map(([type, status, text]) => [stage({type, status}), text]), [stage({held:true, status:'Pending evidence'}), 'Something important is missing, so it stays off the main list.']];
  return shell({title:'Review criteria', description:'Evidence standards and publication rules for the iOS Research Tracker.', base:'../', active:'about', body:`
<main id="main" class="wrap page prose-page">
<div class="head"><h1>Criteria</h1><p class="sub">How we decide what goes on the list.</p></div>
<section id="status" class="block"><h2 class="group-title">Stages</h2>
<dl class="legend">${legend.map(([chip, text]) => `<div><dt>${chip}</dt><dd>${text}</dd></div>`).join('')}</dl></section>
<section class="block prose"><h2>What gets listed</h2><p>New source code, a detailed bug report, a useful reproduction, or a specific announcement or demo from the original researcher. It has to change what we know about an attack, which devices it reaches, how it is delivered, or whether it is fixed.</p><p>We read source code at a fixed commit and follow it from the attacker’s input to the claimed effect. A convincing README with placeholder code does not count. Reposts, GitHub stars and polished writing are not evidence. Every entry links to a public, original source.</p></section>
<section class="block prose"><h2>What a claim has to show</h2><ul><li>The exact device and iOS build</li><li>Which process handles the attacker’s input</li><li>Which memory address and value the input can change</li><li>What effect survives the memory damage</li><li>Which protections and exploit steps are still in the way</li></ul><p>A crash is only a crash. Reading kernel memory is not a code-signing bypass, persistence or a full jailbreak. What code does when it runs stays credited to its author until someone else reproduces it.</p></section>
<section class="block prose"><h2>How updates happen</h2><ul><li><strong>Twice a day, at 8:00 and 20:00 Pacific,</strong> we check original posts on X and watched GitHub repositories. Leads are traced back to a public original source. Changes go through a pull request.</li><li><strong>Twice a day, at 03:23 and 15:23 UTC,</strong> a GitHub Action checks watched repositories for new commits or releases and opens a review issue when something changes.</li><li><strong>If we cannot reach a source,</strong> it is marked blocked. Private messages are never published.</li></ul><p>${external(`${repo}/issues?q=is%3Aissue+is%3Aopen+label%3Aupstream-review`, 'Changes waiting for review')}</p></section>
<section id="terms" class="block"><h2 class="group-title">Terms</h2><dl class="legend terms">
<div><dt>PoC</dt><dd>Proof of concept. Code that shows a bug is real by triggering it.</dd></div>
<div><dt>Kernel read/write</dt><dd>The ability to read and change the kernel’s memory. Which addresses and values you can reach still matters.</dd></div>
<div><dt>SPTM / TXM</dt><dd>Secure Page Table Monitor and Trusted Execution Monitor. Apple protections that sit above the kernel and control memory mappings and which code may run. Kernel access alone does not get past them.</dd></div>
<div><dt>PAC</dt><dd>Pointer authentication. A check that stops tampered code pointers and return addresses from being used.</dd></div>
<div><dt>MIE</dt><dd>Memory Integrity Enforcement. Apple’s memory protections on newer hardware: hardened memory allocators, memory tagging and related checks.</dd></div>
<div><dt>MTE</dt><dd>Memory Tagging Extension. A hardware feature that tags memory so that many out-of-bounds and use-after-free bugs are caught.</dd></div>
<div><dt>SEP</dt><dd>Secure Enclave. The separate security chip that handles passcodes and encryption keys.</dd></div>
<div><dt>Tethered boot</dt><dd>A boot that needs a computer attached every time the phone starts.</dd></div>
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
