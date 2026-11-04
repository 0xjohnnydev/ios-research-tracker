# iOS Research Tracker

A static tracker for iOS jailbreak research, PoCs, demonstrations, and releases.

The main view compares status, capability, device/build scope, public artifacts, and review dates. Each entry links to a full evidence record and primary sources.

## Local use

Requires Node.js 22 or newer. No package installation or third-party runtime dependency is needed.

```sh
npm test
npm run build
python3 -m http.server 4173 --directory dist
```

## Updating the record

Edit `data/notes.json`. Keep observed effects, interpretation, and unresolved steps separate. Set the entry’s `reviewed` date and the top-level review date when a research review is complete. Dates displayed by the site are Pacific calendar dates unless an entry says otherwise.

For a watched repository, update `data/upstream.json` only after reviewing the new commit or release. Submit changes through a branch and pull request. A merge to `main` runs the build checks and publishes through GitHub Pages.

## Twice-daily research loop

A local Codex research loop checks X, Discord, and GitHub at 08:00 and 20:00 Pacific. It follows public leads, inspects actual source, and publishes qualifying updates through passing pull requests. See [the review procedure](docs/review-loop.md). The local computer, app, and signed-in sessions must be available. Blocked or incomplete source checks remain visible on the coverage page.

The `Check upstream repositories` workflow runs at 03:23 and 15:23 UTC daily and supports manual dispatch. It checks the default-branch commit and newest published release for six repositories. Pre-releases count as published releases; drafts do not.

A change opens one `upstream-review` issue per repository. Later changes update that issue. An identical snapshot stays quiet. Once the reviewed baseline catches up, the workflow closes the matching issue. Failed source checks fail the workflow instead of being reported as current.

The repository workflow does not change public entries or infer a new exploit capability. The local research loop performs that review and the social-source checks. It records source inspection separately from independent reproduction. Low-evidence items can be retained with `held: true` outside the main register; new entries need a concrete `reviewBasis`. No custom access token is required; the workflow uses GitHub’s repository-scoped token with read access to contents and write access to this repository’s issues.

To inspect current upstream state locally without creating or editing issues:

```sh
npm run watch:upstream
```

## Publication

GitHub Pages uses the `Publish site` Actions workflow. All internal paths are relative so the site works under a project URL such as `/ios-research-tracker/`. The site makes no visitor-side API calls and uses no external fonts, analytics, or client framework.
