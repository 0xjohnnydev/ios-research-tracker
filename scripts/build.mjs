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
const others = entries.filter(entry => !entry.priority);

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const format = options => value => new Intl.DateTimeFormat('en-GB', {...options, timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const date = format({day:'numeric', month:'short', year:'numeric'});
const shortDate = format({day:'numeric', month:'short'});
function checkedTime(value) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23', timeZone:'America/Los_Angeles', timeZoneName:'short'}).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
}
const host = url => new URL(url).hostname.replace(/^www\./, '');
const external = (url, title) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(title)}<span class="ext" aria-hidden="true">↗</span></a>`;
const noteLink = (entry, base = '') => `${base}notes/${entry.id}/`;
const correction = (title = '') => `${repo}/issues/new?template=correction.md${title ? `&title=${encodeURIComponent(title)}` : ''}`;
const dot = '&nbsp;· ';
const and = names => names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
// A short fingerprint of the fields a reader scans, so returning visitors can see what changed.
const signature = entry => createHash('sha1').update([entry.type, entry.status, entry.update, entry.capability, entry.trackerScope, entry.artifact, entry.date, entry.priority ?? ''].join('\u0001')).digest('hex').slice(0, 10);
const sourceStates = ['checked', 'partial', 'blocked'];
const stateOf = source => sourceStates.includes(source.state) ? source.state : 'state not recorded';
const lastPass = coverage.sources.map(source => source.checkedAt).sort().at(-1);
const facts = rows => `<dl class="facts">${rows.filter(Boolean).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
const section = (label, content, id = '') => `<section class="block"${id ? ` id="${id}"` : ''}><h2 class="label">${label}</h2>${content}</section>`;

function shell({title, description, body, base = '', active = ''}) {
  const nav = [['coverage', `${base}coverage/`, 'Sources'], ['about', `${base}about/`, 'Criteria']];
  const brand = `<a class="brand" href="${base || './'}">iOS Research Tracker</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | iOS Research Tracker</title><meta name="description" content="${escape(description)}">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="${escape(title)} | iOS Research Tracker"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/atom+xml" title="iOS Research Tracker" href="${base}feed.xml">
<link rel="preload" href="${base}assets/fonts/inter-400.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="${base}assets/fonts/inter-500.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/style.css?v=${assetVersion}"><script src="${base}assets/site.js?v=${assetVersion}" defer></script>
</head><body><a class="skip" href="#main">Skip to content</a>
<div class="page">
<header class="top">${active === 'home' ? `<h1>${brand}</h1>` : brand}
<nav aria-label="Main navigation">${nav.map(([key, href, label]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></header>
${body}
<footer class="foot"><span>Reviewed <time datetime="${data.reviewed}">${date(data.reviewed)}</time></span>
<span class="foot-links"><a href="${base}feed.xml">Feed</a>${external(repo, 'GitHub')}${external(correction(), 'Corrections')}</span></footer>
</div>
</body></html>`;
}

function item(entry) {
  const lead = entry === priority[0];
  const tier = entry.priority ? ` p${Math.min(entry.priority, 3)}` : '';
  const search = [entry.project, entry.title, entry.dek, entry.update, entry.scope, entry.trackerScope, entry.topic, entry.capability, entry.status, entry.artifact, entry.priorityNote, entry.nextStep, entry.cve, ...entry.observed].filter(Boolean).join(' ');
  const meta = [entry.status, entry.capability, entry.trackerScope].map(escape);
  return `<li data-entry data-type="${entry.type}" data-id="${entry.id}" data-sig="${signature(entry)}" class="item${tier}${lead ? ' lead' : ''}" data-search="${escape(search)}">
<div class="head">${entry.priority ? `<span class="rank"><span class="sr-only">Priority </span>${entry.priority}</span>` : ''}<a class="title" href="${noteLink(entry)}">${escape(entry.project)}</a><span data-badge></span><time datetime="${entry.date}">${shortDate(entry.date)}</time></div>
${entry.priority ? `<p class="text">${escape(entry.update)}${lead ? ` ${escape(entry.priorityNote)}` : ''}</p>
<p class="meta">${[...meta, external(entry.sources[0].url, entry.artifact)].join(dot)}</p>
<p class="meta watch">Watching for: <span>${escape(entry.nextStep)}</span></p>` : `<p class="meta">${meta.join(dot)}</p>`}
</li>`;
}

function home() {
  const filters = [['all', 'All'], ['released', 'Released'], ['poc', 'PoC'], ['demo', 'Demo'], ['announced', 'Announced']];
  const group = (label, list, key) => list.length ? `<section class="block" data-group aria-labelledby="g-${key}"><h2 class="label" id="g-${key}">${label}</h2><ol class="items${key === 'priority' ? ' ranked' : ''}">${list.map(item).join('')}</ol></section>` : '';
  const byState = state => coverage.sources.filter(source => stateOf(source) === state).map(source => escape(source.name));
  const states = [...sourceStates, 'state not recorded'].map(state => byState(state).length ? `${and(byState(state))} ${state}` : '').filter(Boolean).join(', ');
  return shell({title:'Developments', description:'An evidence-led tracker of iOS jailbreak releases, demonstrations, and public vulnerability research.', active:'home', body:`
<main id="main">
<div class="intro">
<p>Public iOS jailbreak and security research, ranked by significance. Each entry cites its primary evidence and states what it does not show.</p>
<p class="pass">Last source pass <a href="coverage/"><time datetime="${lastPass}" data-ago>${checkedTime(lastPass)}</time></a>: ${states}.</p>
</div>
<form class="tools" role="search" data-filters hidden>
<div class="filters" role="group" aria-label="Filter by stage">${filters.map(([value, label]) => `<button type="button" data-filter="${value}" aria-pressed="${value === 'all'}">${label} <span>${value === 'all' ? entries.length : entries.filter(entry => entry.type === value).length}</span></button>`).join('')}</div>
<label class="search"><span class="sr-only">Search developments</span><input type="search" name="q" placeholder="Search" autocomplete="off" title="Press / to search"></label>
</form>
<p class="sr-only" role="status" data-results></p>
${group('Priority', priority, 'priority')}${group('Also tracked', others, 'other')}
<p class="empty" data-empty hidden>No matching developments. <button type="button" data-reset>Clear filters</button></p>
<p class="after">${held.length ? `<a href="coverage/#pending">${held.length} held for more evidence</a> · ` : ''}<a href="about/">How entries qualify</a></p>
</main>`});
}

function article(entry) {
  const back = entry.held ? ['../../coverage/#pending', 'Pending evidence'] : ['../../', 'All developments'];
  const listed = !entry.held;
  return shell({title:entry.title, description:entry.dek, base:'../../', body:`
<main id="main" class="doc">
<a class="back" href="${back[0]}"><span aria-hidden="true">←</span> ${back[1]}</a>
<header class="doc-head"><h1>${escape(entry.project)}</h1><p class="sub">${[entry.status, listed && entry.priority ? `Priority ${entry.priority}` : '', entry.topic].filter(Boolean).map(escape).join(' · ')}</p></header>
<p class="lede">${escape(entry.dek)}</p>
${facts([
  entry.held && ['Status', `Held from the main tracker. ${escape(entry.reviewBasis)}`],
  ['Capability', escape(entry.capability)],
  ['Device &amp; build', escape(entry.scope)],
  listed && entry.priority && ['Watching for', escape(entry.nextStep)],
  ['Primary artifact', external(entry.sources[0].url, entry.artifact)],
  entry.cve && ['CVE', escape(entry.cve)],
  ['Published', `<time datetime="${entry.date}">${date(entry.date)}</time>`],
  ['Reviewed', `<time datetime="${entry.reviewed}">${date(entry.reviewed)}</time>`],
  listed && ['Review basis', escape(entry.reviewBasis)],
])}
${section('Observed', `<ol class="num">${entry.observed.map(value => `<li>${escape(value)}</li>`).join('')}</ol>`)}
${section('Assessment', `<p>${escape(entry.meaning)}</p>`)}
${section('Limits', `<ul class="dash">${entry.limits.map(value => `<li>${escape(value)}</li>`).join('')}</ul>`)}
${section('Sources', `<ol class="num sources">${entry.sources.map(source => `<li>${external(source.url, source.title)}<span class="meta">${escape(source.kind)} · ${escape(host(source.url))}</span></li>`).join('')}</ol>`)}
${section('Reviewed artifact', `<p>${escape(entry.revision)}</p><p class="meta"><a href="../../about/#terms">Technical terms</a> · ${external(correction(`Correction: ${entry.id}`), 'Suggest a correction')}</p>`)}
</main>`});
}

function coveragePage() {
  const trackedBy = repository => data.entries.find(entry => entry.sources.some(source => source.url.startsWith(`https://github.com/${repository}/`)));
  return shell({title:'Sources & checks', description:'Twice-daily research coverage, source checks, and developments awaiting better evidence.', base:'../', active:'coverage', body:`
<main id="main" class="doc">
<header class="doc-head"><h1>Sources &amp; checks</h1></header>
<p class="lede">Research passes run at 08:00 and 20:00 Pacific. A repository check runs at 03:23 and 15:23 UTC.</p>
${section('Latest source pass', `<ul class="items">${coverage.sources.map(source => `<li class="item"><div class="head"><span class="title">${escape(source.name)}</span><span class="state s-${stateOf(source).replace(/ /g, '-')}">${escape(stateOf(source))}</span><time datetime="${source.checkedAt}">${checkedTime(source.checkedAt)}</time></div><p class="text">${escape(source.result)}.</p><p class="meta">${escape(source.scope)}</p></li>`).join('')}</ul>
<p class="note">A check time records the coverage described above. It does not certify an entire platform or every post. An inaccessible source is recorded as blocked, never as unchanged.</p>`)}
${section('Watched repositories', `<ul class="items">${upstream.repositories.map(repository => {
  const entry = trackedBy(repository.repository);
  return `<li class="item"><div class="head">${external(`https://github.com/${repository.repository}`, repository.repository)}<span class="aside">${repository.release ? `Release ${escape(repository.release.tag)}` : 'No release'}</span></div><p class="meta">Commit <span class="mono">${repository.commit.slice(0, 8)}</span> · ${entry ? `<a href="../${noteLink(entry)}">${escape(entry.project)}</a>` : 'no entry yet'}</p></li>`;
}).join('')}</ul>
<p class="note">A changed commit or release opens a review issue. The research pass reads the artifact before the tracker changes. ${external(`${repo}/actions/workflows/upstream.yml`, 'Check runs')}</p>`)}
${section('Pending evidence', `${held.length ? `<ul class="items">${held.map(entry => `<li class="item"><div class="head"><a class="title" href="../${noteLink(entry)}">${escape(entry.project)}</a><time datetime="${entry.date}">${shortDate(entry.date)}</time></div><p class="text">${escape(entry.reviewBasis)}</p><p class="meta">${[entry.status, entry.capability, entry.cve].filter(Boolean).map(escape).join(dot)}</p></li>`).join('')}</ul>` : '<p>Nothing is held right now.</p>'}
<p class="note">Holding an item means its public evidence is insufficient for the main tracker. It is not a judgment about whether AI was used.</p>`, 'pending')}
${section('Publication gate', `${facts([
  ['Required', 'Inspectable code that implements the claimed behavior. An exact target and build. Useful supporting evidence or a control. Claims that match the artifact.'],
  ['Labeled', 'Original researcher announcements and demonstrations can qualify with explicit labels. They are not counted as public exploits.'],
  ['Sourcing', 'Discord supplies leads. Public entries cite public primary sources.'],
  ['Held out', 'Reposts, recycled code, placeholder exploits, screenshots without a verifiable claim, and README-only repositories.'],
  ['Not evidence', 'Repository stars and writing style.'],
])}<p class="note"><a href="../about/">Full review criteria</a></p>`)}
</main>`});
}

function about() {
  const stages = [
    ['Public release', 'A usable artifact or source release exists within the documented scope.'],
    ['Public PoC', 'A proof of concept is available. Capability may stop at a crash or a limited read/write.'],
    ['Private demonstration', 'A result is shown, with implementation or reproduction still unavailable.'],
    ['Release announced', 'The original researcher has stated a publication plan. The artifact is pending.'],
    ['Pending evidence', 'A material gap keeps the item out of the main tracker.'],
  ];
  const terms = [
    ['PoC', 'Proof of concept: an artifact that reproduces a specific behavior.'],
    ['Kernel read/write', 'The ability to read or change kernel memory. Address, value, and memory-region restrictions still matter.'],
    ['SPTM / TXM', 'Apple’s Secure Page Table Monitor and Trusted Execution Monitor protect memory mappings and code policy beyond ordinary kernel authority.'],
    ['PAC', 'Pointer authentication: checks that help protect code pointers and return addresses.'],
    ['MIE', 'Memory Integrity Enforcement: Apple’s memory allocators, tagging, and related protections on supported hardware.'],
    ['Tethered boot', 'A boot workflow that requires an attached computer each time the device starts.'],
  ];
  return shell({title:'Review criteria', description:'Evidence standards and publication rules for the iOS Research Tracker.', base:'../', active:'about', body:`
<main id="main" class="doc">
<header class="doc-head"><h1>Review criteria</h1></header>
<p class="lede">Every entry is a dated assessment of a specific public artifact.</p>
${section('Stages', `${facts(stages)}<p class="note">Stage records what is publicly available. Capability is assessed separately in each entry.</p>`, 'stages')}
${section('What qualifies', `<p>A material source release, a substantive disclosure, a useful reproduction, or an original researcher’s specific announcement or demonstration. Each must change the understanding of a capability, support range, delivery path, patch, or release.</p><p>For source repositories, inspect the actual code at a frozen revision. Trace the path from attacker input to the reported effect. Check build requirements, supplied logs, controls, and attribution. A convincing README with a placeholder implementation does not qualify. Reposts and copied evidence do not provide independent confirmation.</p>`)}
${section('What a claim must establish', `<ol class="num"><li>The exact device and build.</li><li>The process that handles the input.</li><li>The address and value the input can influence.</li><li>The effect that survives the corruption.</li><li>The protections and chain stages still needed.</li></ol><p>A crash is a crash. A bounded file read is a bounded file read. Kernel memory access does not establish a code-signing bypass, persistence, or a complete jailbreak. Runtime claims remain attributed to their source until independently reproduced.</p>`)}
${section('How the loop works', `${facts([
  ['08:00 / 20:00 PT', 'A research pass samples original X posts, accessible Discord research discussions, and repository changes. It follows leads to public primary sources and updates qualifying records through a branch and pull request.'],
  ['03:23 / 15:23 UTC', 'A GitHub Actions check compares watched commits and published releases with reviewed baselines. Changes open or update a review issue. This check does not judge new capabilities.'],
  ['Access', 'The research pass needs the local computer, the app, and signed-in source sessions. When a source is inaccessible, its check is marked blocked. No full-platform coverage is implied. Private discussions and direct messages are never published.'],
])}<p class="note">${external(`${repo}/issues?q=is%3Aissue+is%3Aopen+label%3Aupstream-review`, 'Changes awaiting review')} · <a href="../coverage/">Latest source coverage</a></p>`)}
${section('Technical terms', facts(terms), 'terms')}
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
