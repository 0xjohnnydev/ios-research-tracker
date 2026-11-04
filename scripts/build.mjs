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
const stage = entry => `<span class="stage s-${entry.held ? 'held' : entry.type}"><i aria-hidden="true"></i>${escape(entry.status)}</span>`;
// A short fingerprint of the fields a reader scans, so returning visitors can see what changed.
const signature = entry => createHash('sha1').update([entry.type, entry.status, entry.update, entry.capability, entry.trackerScope, entry.artifact, entry.date, entry.priority ?? ''].join('\u0001')).digest('hex').slice(0, 10);
const sourceStates = {checked: 'checked', partial: 'partial', blocked: 'blocked'};
const lastPass = coverage.sources.map(source => source.checkedAt).sort().at(-1);
const row = (label, content, modifier = '') => `<div class="sheet-row${modifier ? ` ${modifier}` : ''}"><dt>${label}</dt><dd>${content}</dd></div>`;

function shell({title, description, body, base = '', active = ''}) {
  const nav = [['record', base || './', 'Tracker'], ['coverage', `${base}coverage/`, 'Sources'], ['about', `${base}about/`, 'Criteria']];
  const brand = `<a class="brand" href="${base || './'}">iOS Research Tracker</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | iOS Research Tracker</title><meta name="description" content="${escape(description)}">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="${escape(title)} | iOS Research Tracker"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/atom+xml" title="iOS Research Tracker" href="${base}feed.xml">
<link rel="preload" href="${base}assets/fonts/plex-sans-400.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="${base}assets/fonts/plex-sans-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/style.css?v=${assetVersion}"><script src="${base}assets/site.js?v=${assetVersion}" defer></script>
</head><body><a class="skip" href="#main">Skip to content</a>
<header class="masthead"><div class="wrap">
<div class="mast-row">${active === 'record' ? `<h1 class="brand-title">${brand}</h1>` : brand}
<nav class="nav" aria-label="Main navigation">${nav.map(([key, href, label]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
<div class="mast-links"><a href="${base}feed.xml">Feed</a>${external(repo, 'GitHub')}</div></div>
<div class="dateline">
<span>Reviewed <time datetime="${data.reviewed}">${date(data.reviewed)}</time></span>
<span class="pass">Last source pass <a href="${base}coverage/"><time datetime="${lastPass}" data-ago>${checkedTime(lastPass)}</time></a></span>
<span class="sources-state">${coverage.sources.map(source => `<span class="src src-${sourceStates[source.state] ?? 'unknown'}" title="${escape(`${source.result} · ${checkedTime(source.checkedAt)}`)}"><i aria-hidden="true"></i>${escape(source.name)}${source.state === 'checked' ? '<span class="sr-only"> checked</span>' : ` <em>${escape(sourceStates[source.state] ?? 'state not recorded')}</em>`}</span>`).join('')}</span>
<span class="cadence">Passes 08:00 &amp; 20:00 PT</span>
</div></div></header>
${body}
<footer class="foot"><div class="wrap foot-row">
<span>Research reviewed <time datetime="${data.reviewed}">${date(data.reviewed)}</time></span>
<a href="${base}coverage/">Sources &amp; checks</a><a href="${base}about/">Criteria</a><a href="${base}feed.xml">Atom feed</a>${external(repo, 'Source')}${external(`${repo}/issues/new?template=correction.md`, 'Suggest a correction')}
</div></footer>
</body></html>`;
}

function ledgerRow(entry) {
  const tier = entry.priority ? ` p${Math.min(entry.priority, 3)}` : '';
  const lead = entry === priority[0];
  return `<tr data-entry data-type="${entry.type}" data-id="${entry.id}" data-sig="${signature(entry)}" class="row${tier}${lead ? ' lead' : ''}" data-search="${escape([entry.project, entry.title, entry.dek, entry.update, entry.scope, entry.trackerScope, entry.topic, entry.capability, entry.status, entry.artifact, entry.priorityNote, entry.nextStep, entry.cve, ...entry.observed].filter(Boolean).join(' '))}">
<td class="c-date">${entry.priority ? `<span class="rank" title="Priority ${entry.priority}">${entry.priority}</span>` : ''}<time datetime="${entry.date}">${shortDate(entry.date)}</time></td>
<td class="c-dev"><div class="title-line"><a class="name" href="${noteLink(entry)}">${escape(entry.project)}</a><span data-badge></span></div>
<p class="update">${escape(entry.update)}</p>${lead ? `<p class="why">${escape(entry.priorityNote)}</p>` : ''}${entry.priority ? `<p class="next"><span>Watching for</span>${escape(entry.nextStep)}</p>` : ''}</td>
<td class="c-stage">${stage(entry)}</td>
<td class="c-cap" data-label="Capability">${escape(entry.capability)}</td>
<td class="c-target" data-label="Target">${escape(entry.trackerScope)}</td>
<td class="c-src">${external(entry.sources[0].url, entry.artifact)}${entry.cve ? `<span class="cve">${escape(entry.cve)}</span>` : ''}</td>
</tr>`;
}

function home() {
  const filters = [['all', 'All'], ['released', 'Released'], ['poc', 'PoC'], ['demo', 'Demo'], ['announced', 'Announced']];
  const group = (label, list, className) => list.length ? `<tbody data-group class="${className}"><tr class="group-head"><th colspan="6" scope="colgroup">${label}</th></tr>${list.map(ledgerRow).join('')}</tbody>` : '';
  return shell({title:'Developments', description:'An evidence-led tracker of iOS jailbreak releases, demonstrations, and public vulnerability research.', active:'record', body:`
<main id="main" class="wrap home">
<section id="record" aria-label="Developments">
<form class="tools" role="search" data-filters hidden>
<div class="filters" role="group" aria-label="Filter by stage">${filters.map(([value, label]) => `<button type="button" data-filter="${value}" aria-pressed="${value === 'all'}">${label}<span>${value === 'all' ? entries.length : entries.filter(entry => entry.type === value).length}</span></button>`).join('')}</div>
<label class="search"><span class="sr-only">Search developments</span><input type="search" name="q" placeholder="Search projects, CVEs, builds" autocomplete="off"><kbd aria-hidden="true">/</kbd></label>
</form>
<p class="sr-only" role="status" data-results></p>
<table class="ledger"><caption class="sr-only">Research developments reviewed ${date(data.reviewed)}, ranked by priority then date</caption>
<colgroup><col class="k-date"><col class="k-dev"><col class="k-stage"><col class="k-cap"><col class="k-target"><col class="k-src"></colgroup>
<thead><tr><th scope="col">Date</th><th scope="col">Development</th><th scope="col"><a href="about/#stages">Stage</a></th><th scope="col">Capability</th><th scope="col">Target</th><th scope="col" class="c-src">Source</th></tr></thead>
${group('Priority', priority, 'g-priority')}${group('Also tracked', others, 'g-other')}
</table>
<div class="empty" data-empty hidden><p>No matching developments.</p><button type="button" data-reset>Clear filters</button></div>
<p class="ledger-foot">${held.length ? `<a href="coverage/#pending">${held.length} held for evidence</a>` : ''}<span>Ranked by priority, then date. Author-supplied results are attributed; independent execution is stated explicitly.</span><a href="about/">Inclusion criteria</a></p>
</section>
</main>`});
}

function article(entry) {
  const back = entry.held ? ['../../coverage/#pending', 'Pending evidence'] : ['../../#record', 'All developments'];
  const sources = entry.sources.map(source => `<li>${external(source.url, source.title)}<span>${escape(source.kind)} · ${escape(host(source.url))}</span></li>`).join('');
  return shell({title:entry.title, description:entry.dek, base:'../../', body:`
<main id="main" class="wrap record">
<a class="crumb" href="${back[0]}"><span aria-hidden="true">←</span> ${back[1]}</a>
<header class="rec-head">
<p class="kicker">${stage(entry)}${entry.priority && !entry.held ? `<span class="kick-rank">Priority ${entry.priority}</span>` : ''}${entry.cve ? `<span class="cve">${escape(entry.cve)}</span>` : ''}<span>${escape(entry.topic)}</span></p>
<h1>${escape(entry.project)}</h1>
<p class="dek">${escape(entry.dek)}</p>
</header>
<dl class="sheet">
${entry.held ? row('Status', `<strong>Held from the main register.</strong> ${escape(entry.reviewBasis)}`, 'held-row') : ''}
${row('Capability', escape(entry.capability))}
${row('Device &amp; build', escape(entry.scope))}
${entry.priority && !entry.held ? row('Watching for', escape(entry.nextStep), 'watch-row') : ''}
${row('Primary artifact', external(entry.sources[0].url, entry.artifact))}
${row('Dates', `Published <time datetime="${entry.date}">${date(entry.date)}</time><span class="sep">·</span>Reviewed <time datetime="${entry.reviewed}">${date(entry.reviewed)}</time>`)}
${entry.held ? '' : row('Review basis', escape(entry.reviewBasis))}
</dl>
<div class="sheet sections">
<section class="sheet-row"><h2>Observed</h2><ol class="numbered">${entry.observed.map(value => `<li>${escape(value)}</li>`).join('')}</ol></section>
<section class="sheet-row"><h2>Assessment</h2><p>${escape(entry.meaning)}</p></section>
<section class="sheet-row limits"><h2>Limits</h2><ul>${entry.limits.map(value => `<li>${escape(value)}</li>`).join('')}</ul></section>
<section class="sheet-row"><h2>Sources</h2><ol class="numbered sources">${sources}</ol></section>
<section class="sheet-row"><h2>Reviewed artifact</h2><div><p class="mono">${escape(entry.revision)}</p><p class="aside-links"><a href="../../about/#terms">Technical terms</a>${external(`${repo}/issues/new?template=correction.md&title=${encodeURIComponent(`Correction: ${entry.id}`)}`, 'Suggest a correction')}</p></div></section>
</div>
</main>`});
}

function coveragePage() {
  const trackedBy = repository => data.entries.find(entry => entry.sources.some(source => source.url.startsWith(`https://github.com/${repository}/`)));
  return shell({title:'Sources & checks', description:'Twice-daily research coverage, source checks, and developments awaiting better evidence.', base:'../', active:'coverage', body:`
<main id="main" class="wrap info">
<header class="page-head"><h1>Sources &amp; checks</h1><p>Research passes run at 08:00 and 20:00 Pacific. The repository check runs at 03:23 and 15:23 UTC.</p></header>
<div class="sheet sections">
<section class="sheet-row"><h2>Latest source pass</h2><div>
<table class="plain"><thead><tr><th scope="col">Source</th><th scope="col">State</th><th scope="col">Checked</th><th scope="col">Result</th></tr></thead><tbody>${coverage.sources.map(source => `<tr><th scope="row">${escape(source.name)}</th><td><span class="src src-${sourceStates[source.state] ?? 'unknown'}"><i aria-hidden="true"></i>${escape(sourceStates[source.state] ?? 'not recorded')}</span></td><td class="mono nowrap"><time datetime="${source.checkedAt}">${checkedTime(source.checkedAt)}</time></td><td><strong>${escape(source.result)}</strong><p>${escape(source.scope)}</p></td></tr>`).join('')}</tbody></table>
<p class="note">A check time records the coverage described above. It does not certify an entire platform or every post. An inaccessible source is recorded as blocked, never as unchanged.</p></div></section>
<section class="sheet-row"><h2>Watched repositories</h2><div>
<table class="plain"><thead><tr><th scope="col">Repository</th><th scope="col">Reviewed commit</th><th scope="col">Release</th><th scope="col">Entry</th></tr></thead><tbody>${upstream.repositories.map(item => {
  const entry = trackedBy(item.repository);
  return `<tr><td class="repo">${external(`https://github.com/${item.repository}`, item.repository)}</td><td class="mono" data-label="Commit">${item.commit.slice(0, 8)}</td><td class="mono" data-label="Release">${item.release ? escape(item.release.tag) : '<span class="faint">none</span>'}</td><td data-label="Entry">${entry ? `<a href="../${noteLink(entry)}">${escape(entry.project)}</a>` : '<span class="faint">no entry yet</span>'}</td></tr>`;
}).join('')}</tbody></table>
<p class="note">A changed commit or release opens a review issue. The research pass reads the artifact before the tracker changes. ${external(`${repo}/actions/workflows/upstream.yml`, 'Check runs')}</p></div></section>
<section class="sheet-row" id="pending"><h2>Pending evidence</h2><div>
${held.length ? `<table class="plain"><thead><tr><th scope="col">Development</th><th scope="col">Stage</th><th scope="col">Missing</th></tr></thead><tbody>${held.map(entry => `<tr><td><a href="../${noteLink(entry)}">${escape(entry.project)}</a>${entry.cve ? `<span class="cve block">${escape(entry.cve)}</span>` : ''}</td><td class="nowrap">${stage(entry)}</td><td>${escape(entry.reviewBasis)}</td></tr>`).join('')}</tbody></table>` : '<p>Nothing is held right now.</p>'}
<p class="note">Holding an item means its public evidence is insufficient for the main register. It is not a judgment about whether AI was used.</p></div></section>
<section class="sheet-row"><h2>Publication gate</h2><div>
<dl class="gate">
<div><dt>Required</dt><dd>Inspectable code that implements the claimed behavior. An exact target and build. Useful supporting evidence or a control. Claims that match the artifact.</dd></div>
<div><dt>Labeled</dt><dd>Original researcher announcements and demonstrations can qualify with explicit labels. They are not counted as public exploits.</dd></div>
<div><dt>Sourcing</dt><dd>Discord supplies leads. Public entries cite public primary sources.</dd></div>
<div><dt>Held out</dt><dd>Reposts, recycled code, placeholder exploits, screenshots without a verifiable claim, and README-only repositories.</dd></div>
<div><dt>Not evidence</dt><dd>Repository stars and writing style.</dd></div>
</dl>
<p class="note"><a href="../about/">Full review criteria</a></p></div></section>
</div>
</main>`});
}

function about() {
  const definitions = [
    [{type:'released', status:'Public release'}, 'A usable artifact or source release exists within the documented scope.'],
    [{type:'poc', status:'Public PoC'}, 'A proof of concept is available. Capability may stop at a crash or a limited read/write.'],
    [{type:'demo', status:'Private demonstration'}, 'A result is shown, with implementation or reproduction still unavailable.'],
    [{type:'announced', status:'Release announced'}, 'The original researcher has stated a publication plan. The artifact is pending.'],
    [{held:true, status:'Pending evidence'}, 'A material gap keeps the item out of the main register.'],
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
<main id="main" class="wrap info">
<header class="page-head"><h1>Review criteria</h1><p>Every entry is a dated assessment of a specific public artifact.</p></header>
<div class="sheet sections">
<section class="sheet-row" id="stages"><h2>Stages</h2><div><table class="plain defs"><tbody>${definitions.map(([entry, text]) => `<tr><th scope="row">${stage(entry)}</th><td>${text}</td></tr>`).join('')}</tbody></table><p class="note">Stage records what is publicly available. Capability is assessed separately in each entry.</p></div></section>
<section class="sheet-row"><h2>What qualifies</h2><div class="prose"><p>A material source release, a substantive disclosure, a useful reproduction, or an original researcher’s specific announcement or demonstration. Each must change the understanding of a capability, support range, delivery path, patch, or release.</p><p>For source repositories, inspect the actual code at a frozen revision. Trace the path from attacker input to the reported effect. Check build requirements, supplied logs, controls, and attribution. A convincing README with a placeholder implementation does not qualify. Reposts and copied evidence do not provide independent confirmation.</p></div></section>
<section class="sheet-row"><h2>What a claim must establish</h2><div class="prose"><ol class="numbered"><li>The exact device and build.</li><li>The process that handles the input.</li><li>The address and value the input can influence.</li><li>The effect that survives the corruption.</li><li>The protections and chain stages still needed.</li></ol><p>A crash is a crash. A bounded file read is a bounded file read. Kernel memory access does not establish a code-signing bypass, persistence, or a complete jailbreak. Runtime claims remain attributed to their source until independently reproduced.</p></div></section>
<section class="sheet-row"><h2>How the loop works</h2><div class="prose"><dl class="gate">
<div><dt class="mono">08:00 / 20:00 PT</dt><dd>A research pass samples original X posts, accessible Discord research discussions, and repository changes. It follows leads to public primary sources and updates qualifying records through a branch and pull request.</dd></div>
<div><dt class="mono">03:23 / 15:23 UTC</dt><dd>A GitHub Actions check compares watched commits and published releases with reviewed baselines. Changes open or update a review issue. This check does not judge new capabilities.</dd></div>
<div><dt>Access</dt><dd>The research pass needs the local computer, the app, and signed-in source sessions. When a source is inaccessible, its check is marked blocked. No full-platform coverage is implied. Private discussions and direct messages are never published.</dd></div>
</dl><p class="note">${external(`${repo}/issues?q=is%3Aissue+is%3Aopen+label%3Aupstream-review`, 'Changes awaiting review')}<span class="sep">·</span><a href="../coverage/">Latest source coverage</a></p></div></section>
<section class="sheet-row" id="terms"><h2>Technical terms</h2><dl class="gate">${terms.map(([term, text]) => `<div><dt>${term}</dt><dd>${text}</dd></div>`).join('')}</dl></section>
</div>
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
