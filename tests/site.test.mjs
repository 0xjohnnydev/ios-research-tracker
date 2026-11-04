import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { changed, reviewBody, syncReviewIssue } from '../scripts/watch.mjs';

const data = JSON.parse(await readFile(new URL('../data/notes.json',import.meta.url)));
test('every entry has a unique route, public sources, scope, and evidence boundary', () => {
  assert.equal(new Set(data.entries.map(entry=>entry.id)).size,data.entries.length);
  for (const entry of data.entries) {
    assert.match(entry.id,/^[a-z0-9-]+$/);
    for (const key of ['project','update','capability','trackerScope','artifact','reviewed','scope','meaning','revision','reviewBasis']) assert.ok(entry[key],`${entry.id}: missing ${key}`);
    assert.ok(entry.limits.length && entry.observed.length && entry.sources.length);
    for (const source of entry.sources) assert.equal(new URL(source.url).protocol,'https:');
  }
});
test('the static build resolves every internal page and asset under a Pages subpath', async () => {
  execFileSync(process.execPath,['scripts/build.mjs']);
  async function walk(directory) {
    for (const item of await readdir(directory,{withFileTypes:true})) {
      const file=path.join(directory,item.name);
      if(item.isDirectory()) await walk(file);
      else if(file.endsWith('.html')) {
        const html=await readFile(file,'utf8');
        assert.match(html,/<html lang="en">/);
        for (const [,target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
          if (/^https?:/.test(target)||target.startsWith('#')) continue;
          assert.ok(!target.startsWith('/'),`Root-relative link breaks project Pages hosting: ${target}`);
          let resolved=path.resolve(path.dirname(file),target.split(/[?#]/)[0]);
          if(target.split(/[?#]/)[0].endsWith('/')) resolved=path.join(resolved,'index.html');
          await access(resolved);
        }
      }
    }
  }
  await walk('dist');
});
test('held records remain accessible but cannot enter the main register or its filter counts', async () => {
  const home = await readFile('dist/index.html', 'utf8');
  const coverage = await readFile('dist/coverage/index.html', 'utf8');
  const accepted = data.entries.filter(entry => !entry.held);
  assert.equal([...home.matchAll(/<tr data-entry /g)].length, accepted.length);
  for (const entry of data.entries.filter(entry => entry.held)) {
    assert.ok(!home.includes(`notes/${entry.id}/`));
    assert.ok(coverage.includes(`notes/${entry.id}/`));
    const detail = await readFile(`dist/notes/${entry.id}/index.html`, 'utf8');
    assert.ok(detail.includes('Pending evidence'));
    assert.ok(detail.includes(entry.reviewBasis));
  }
});
const old={repository:'owner/research',commit:'a'.repeat(40),release:null};
const fresh={commit:'b'.repeat(40),release:{id:123,tag:'v1'}};
test('watcher detects a first release even when code does not change',()=> {
  assert.equal(changed(old,{commit:old.commit,release:null}),false);
  assert.equal(changed(old,{commit:old.commit,release:{id:1,tag:'v1'}}),true);
  assert.equal(changed(old,fresh),true);
});
test('watcher creates one issue, stays quiet for the same snapshot, and updates a changed snapshot',async()=>{
  const calls=[];
  const api=async(url,options)=>{calls.push({url,options});return {};};
  const result=await syncReviewIssue(api,'owner/tracker',old,fresh,'2026-11-03',[]);
  assert.equal(result,'opened review issue');assert.equal(calls.length,1);
  assert.equal(calls[0].options.method,'POST');
  const body=reviewBody(old,fresh,'2026-11-03');
  calls.length=0;
  assert.equal(await syncReviewIssue(api,'owner/tracker',old,fresh,'2026-11-03',[{number:4,body}]),'already flagged');
  assert.equal(calls.length,0);
  await syncReviewIssue(api,'owner/tracker',old,{...fresh,commit:'c'.repeat(40)},'2026-11-03',[{number:4,body}]);
  assert.equal(calls.length,1);assert.equal(calls[0].options.method,'PATCH');
});
test('reviewed baselines close their own review issue, without modifying another repository issue',async()=>{
  const calls=[];const api=async(url,options)=>{calls.push({url,options});};
  await syncReviewIssue(api,'owner/tracker',old,{commit:old.commit,release:null},'2026-11-03',[{number:4,body:'<!-- upstream:owner/other -->'}]);
  assert.equal(calls.length,0);
  await syncReviewIssue(api,'owner/tracker',old,{commit:old.commit,release:null},'2026-11-03',[{number:5,body:'<!-- upstream:owner/research -->'}]);
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/repos/owner/tracker/issues/5');
  assert.equal(calls[0].options.body.state,'closed');
});
test('priority items lead the page, and every accepted entry appears once in the register', async () => {
  const home = await readFile('dist/index.html', 'utf8');
  const accepted = data.entries.filter(entry => !entry.held);
  const priority = accepted.filter(entry => entry.priority).sort((a, b) => a.priority - b.priority);
  const watch = home.slice(home.indexOf('data-priorities'), home.indexOf('id="record"'));
  for (const entry of priority) {
    for (const key of ['priorityNote', 'nextStep']) assert.ok(entry[key], `${entry.id}: priority entries need ${key}`);
    assert.ok(watch.includes(`notes/${entry.id}/`), `${entry.id} missing from priority watch`);
  }
  if (priority.length) assert.match(watch, new RegExp(`class="lead" data-id="${priority[0].id}"`));
  for (const entry of accepted) assert.equal([...home.matchAll(new RegExp(`<tr data-entry [^>]*data-id="${entry.id}"`, 'g'))].length, 1);
});
test('source checks record an explicit state, and the feed lists only accepted entries', async () => {
  const coverage = JSON.parse(await readFile(new URL('../data/coverage.json', import.meta.url)));
  for (const source of coverage.sources) {
    assert.ok(['checked', 'partial', 'blocked'].includes(source.state), `${source.name}: state must be checked, partial, or blocked`);
    assert.ok(!Number.isNaN(Date.parse(source.checkedAt)));
  }
  const feed = await readFile('dist/feed.xml', 'utf8');
  assert.match(feed, /^<\?xml version="1.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www.w3.org\/2005\/Atom">/);
  assert.equal([...feed.matchAll(/<entry>/g)].length, data.entries.filter(entry => !entry.held).length);
  for (const entry of data.entries.filter(entry => entry.held)) assert.ok(!feed.includes(`notes/${entry.id}/`));
});
