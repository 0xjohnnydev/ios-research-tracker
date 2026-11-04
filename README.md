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

## Daily repository checks

The `Check upstream repositories` workflow runs at 16:23 UTC daily and supports manual dispatch. It checks the default-branch commit and newest published release for six repositories. Pre-releases count as published releases; drafts do not.

A change opens one `upstream-review` issue per repository. Later changes update that issue. An identical snapshot stays quiet. Once the reviewed baseline catches up, the workflow closes the matching issue. Failed source checks fail the workflow instead of being reported as current.

The workflow does not change public entries or infer a new exploit capability. It does not monitor X, Discord, or vendor advisories. Those need a separate research review. No custom access token is required; the workflow uses GitHub’s repository-scoped token with read access to contents and write access to this repository’s issues.

To inspect current upstream state locally without creating or editing issues:

```sh
npm run watch:upstream
```

## Publication

GitHub Pages uses the `Publish site` Actions workflow. All internal paths are relative so the site works under a project URL such as `/ios-research-tracker/`. The site makes no visitor-side API calls and uses no external fonts, analytics, or client framework.
