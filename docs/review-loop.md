# Twice-daily research review

The local research loop is scheduled for 08:00 and 20:00 Pacific. The repository-only GitHub Action runs separately at 03:23 and 15:23 UTC. A scheduled review is a bounded pass, not continuous monitoring.

## Source pass

1. First reconcile any pending publication in the local state with its existing pull request and deployment. Resume that work instead of duplicating the same findings. Start from the current default branch in a clean checkout or isolated worktree. Preserve unfinished local work. Read the previous source results in `data/coverage.json` and the local source watermarks. Review each source from its last successful check with a 24-hour overlap. Do not advance a blocked source's watermark.
2. Use signed-in browser sessions to sample original researcher posts on X. Start with authors already cited by the tracker, then use a focused Latest search for new public iOS research and source releases. Follow useful leads to their original publication. Prefer source authors and maintainers over aggregators.
3. Check all watched repositories and open `upstream-review` issues. Run `npm run watch:upstream` for a read-only comparison. Inspect meaningful diffs and release artifacts. Add a new watched repository only after the source review below.
4. Record actual coverage, result, and timestamp for each source. Use a bounded pass of about 30 minutes; narrow to the strongest unresolved candidates when needed. Mark incomplete searches as partial. If sign-in or source access fails, report blocked coverage and continue with independent sources. Do not claim that a platform is unchanged after an unsuccessful check.

## Inclusion gate

The gate evaluates substance. It does not attempt to determine whether an author used AI.

For a repository, read actual source at a pinned commit. Trace the input, the affected component, and the reported effect. Confirm that the code contains the claimed mechanism rather than a stub, hard-coded success output, copied screenshots, or a wrapper around a missing exploit. Inspect relevant build inputs and scripts for unexpected downloads, credential access, or unrelated behavior. Do not execute untrusted PoCs during this review.

Require an exact target/build, clear preconditions, and supporting observations or a useful control for runtime claims. Identify the origin of logs and other evidence. Compare attribution with the original disclosure. Source inspection is not independent reproduction. Stars, age, polished writing, and a CVE in the repository name are not evidence.

A specific original-researcher announcement, a substantive technical disclosure, or an original demonstration can be tracked without public exploit code. Label it accurately and preserve what is unavailable. Do not promote an announcement into a released exploit, a crash into memory access, or kernel memory access into a full jailbreak.

Reject spam, duplicates, recycled releases presented as new, fake version support, README-only exploit claims, and source that does not implement its central claim. Keep plausible but unresolved items out of the main register. Use `held: true` and explain the exact missing evidence if an existing assessment needs to remain accessible. Record dismissed discovery leads locally to avoid re-reviewing unchanged material. Do not publicly label a person or repository as AI-generated based on writing style.

## Writing

Write every public field for a smart reader who is not a specialist. Use short sentences and the active voice, and put the result first. Define a specialist term the first time an entry uses it, for example MIE, SPTM, MTE, SEP or tfp0. Prefer plain words to compressed notation: write "device and build", not "device/build", and avoid chains of semicolons. Give each entry a `summary`: one plain sentence, under about 75 characters, that says what the item is for someone who has never heard of it. It is the line shown on the home page. Keep `update` to one short sentence about the latest change and `trackerScope` to a few words. Write "we" for this tracker's own review. Do not use em dashes. Plain wording must keep the same claims, attribution and limits.

## Update and publish

Only add material changes to `data/notes.json`. Each entry needs a short update, exact scope, an honest capability, an explicit `reviewBasis`, observations, limitations, public primary sources, and the reviewed commit or artifact. Update an existing item instead of creating duplicate entries for the same result.

Set each entry's `category` to `tools` (released jailbreaks and research setups), `chains` (demos that link several bugs into a full attack), `kernel`, `sandbox` (an app getting past its sandbox or permissions) or `input` (bugs set off by opening a file, image, video or link). The home page groups entries by category after the ranked jailbreak watch.

Rank by practical jailbreak relevance and demonstrated capability. A credible announced kernel exploit can lead the watchlist while its status remains announced. Keep low-evidence items outside the main register. Do not manufacture numerical confidence scores.

Update `data/upstream.json` only after reviewing the new commit or release. Update `data/coverage.json` with factual source results, including blocked and partial checks. Set each source's `state` to `checked` (the planned sample ran), `partial` (the sample was incomplete), or `blocked` (the source was inaccessible). The tests reject any other value. Keep source-specific watermarks and discovery notes under ignored `.local/`; store no credentials.

Follow the current workspace review instructions. Use lean-poc-review only after changes to proof-of-concept code or its direct build/test support. That review applies to code, not research conclusions. Run the existing tests and build. Make one branch and pull request for the pass, confirm the remote before pushing, merge only passing changes, and verify the Pages deployment. Do not push to `main`. Do not change the UI during a scheduled source pass unless a defect prevents correct use.

Every pass must update and publish `data/coverage.json` with each source’s actual check time and outcome, even when no material development qualifies. Publish coverage-only changes through a pull request and verify the new times on the live home and Sources pages. For a blocked source, record the attempt time and blocked state but preserve its last successful watermark. When no material development qualifies, leave the research review date unchanged. Notify only for a material addition, correction, source-access problem, or failed publication. Report a blocked source once and avoid repeating an unchanged request for sign-in on every pass.
