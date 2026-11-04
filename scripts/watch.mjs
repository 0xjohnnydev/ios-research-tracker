import { readFile, appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function changed(baseline, current) {
  return baseline.commit !== current.commit || (baseline.release?.id ?? null) !== (current.release?.id ?? null);
}

export function reviewBody(baseline, current, reviewed) {
  const repository = baseline.repository;
  const snapshot = `${current.commit}:${current.release?.id ?? 'none'}`;
  const tag = current.release?.tag.replace(/`/g, "'");
  return `<!-- upstream:${repository} -->
<!-- snapshot:${snapshot} -->
A watched repository differs from the research baseline reviewed on ${reviewed}.

| Artifact | Reviewed | Current |
| --- | --- | --- |
| Default-branch commit | [${baseline.commit.slice(0, 8)}](https://github.com/${repository}/commit/${baseline.commit}) | [${current.commit.slice(0, 8)}](https://github.com/${repository}/commit/${current.commit}) |
| Latest published release | ${baseline.release ? `\`${baseline.release.tag.replace(/`/g, "'")}\`` : 'None'} | ${tag ? `\`${tag}\`` : 'None'} |

[Compare commits](https://github.com/${repository}/compare/${baseline.commit}...${current.commit})${current.release ? ` · [Current release](https://github.com/${repository}/releases/tag/${encodeURIComponent(current.release.tag)})` : ''}

Review the changed artifact, exact device/build scope, and any new capability evidence. A code change or release does not by itself establish a new exploit primitive.

After review, update the relevant entry in \`data/notes.json\` and this repository’s baseline in \`data/upstream.json\` through a pull request. Leave the baseline unchanged if the change is still unreviewed. The watcher will not repeat this notification unless the upstream snapshot changes.
`;
}

export async function syncReviewIssue(api, target, baseline, current, reviewed, issues) {
  const marker = `<!-- upstream:${baseline.repository} -->`;
  const existing = issues.find(issue => !issue.pull_request && issue.body?.includes(marker));
  if (!changed(baseline, current)) {
    if (existing) await api(`/repos/${target}/issues/${existing.number}`, {method:'PATCH', body:{state:'closed',state_reason:'completed'}});
    return 'current';
  }
  const body = reviewBody(baseline, current, reviewed);
  if (existing?.body === body) return 'already flagged';
  if (existing) {
    await api(`/repos/${target}/issues/${existing.number}`, {method:'PATCH', body:{body}});
    return 'updated review issue';
  }
  await api(`/repos/${target}/issues`, {method:'POST', body:{title:`Upstream review: ${baseline.repository}`,body,labels:['upstream-review']}});
  return 'opened review issue';
}

async function main() {
  const write = process.argv.includes('--write');
  const token = process.env.GITHUB_TOKEN;
  const target = process.env.GITHUB_REPOSITORY;
  if (write && (!token || !target)) throw new Error('--write requires GITHUB_TOKEN and GITHUB_REPOSITORY.');
  const baseline = JSON.parse(await readFile(new URL('../data/upstream.json', import.meta.url), 'utf8'));
  async function api(path, {method='GET',body}={}) {
    const response = await fetch(`https://api.github.com${path}`, {
      method, headers:{'Content-Type':'application/json','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{'Authorization':`Bearer ${token}`}:{})},
      ...(body?{body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}: ${method} ${path}`);
    return response.status === 204 ? null : response.json();
  }
  let issues = [];
  if (write) {
    await api(`/repos/${target}/labels/upstream-review`).catch(async error => {
      if (!error.message.startsWith('GitHub 404:')) throw error;
      await api(`/repos/${target}/labels`, {method:'POST',body:{name:'upstream-review',color:'D6E8D8',description:'Watched upstream artifacts need research review'}});
    });
    for (let page=1;;page++) {
      const batch = await api(`/repos/${target}/issues?state=open&labels=upstream-review&per_page=100&page=${page}`);
      issues.push(...batch);
      if (batch.length < 100) break;
    }
  }
  const report = [];
  let failures = 0;
  for (const repo of baseline.repositories) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo.repository)) throw new Error('Invalid repository in baseline.');
    try {
      const [commits,releases] = await Promise.all([
        api(`/repos/${repo.repository}/commits?per_page=1`),
        api(`/repos/${repo.repository}/releases?per_page=10`)
      ]);
      if (!/^[a-f0-9]{40}$/.test(commits[0]?.sha)) throw new Error(`No valid commit returned for ${repo.repository}`);
      const release = releases.filter(value => !value.draft && value.published_at).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))[0];
      const current = {commit:commits[0].sha, release:release?{id:release.id,tag:release.tag_name}:null};
      const result = write ? await syncReviewIssue(api,target,repo,current,baseline.reviewed,issues) : changed(repo,current)?'needs review':'current';
      report.push(`${repo.repository}: ${result}`);
    } catch (error) {
      failures++;
      report.push(`${repo.repository}: CHECK FAILED (${error.message})`);
    }
  }
  console.log(report.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,`## Upstream review check\n\n${report.map(line=>`- ${line}`).join('\n')}\n\nPublished research entries were not changed.\n`);
  if (failures) process.exitCode=1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
