# Independent recovery audit — Flagged for Review

Date: 2026-11-20 UTC. Session: arena-123364cd.

## Scope and decision

This is an audit of the **uploaded snapshot**, not an assertion that its baseball statistics, quoted rules, model metrics, previous tests, or upstream functionality are verified. Those claims cannot be certified from the files provided. No replacement model, historical event data, or guessed values were introduced.

Another concurrent session owns application restoration and final publication. This audit intentionally changes no application or deployment files. Coordination/handoff: https://github.com/snapquast73-boop/ERLIVE/issues/1 .

## Evidence ledger

All snapshot references below are immutable links to the repository owner's source on GitHub. These are primary evidence of what was uploaded, **not official MLB confirmation of README claims**.

| Item examined | Confirmed observation | Source for manual review | Disposition |
|---|---|---|---|
| Uploaded tree | Seven tracked files; no docs, tools, tests, data, or GitHub workflows present | [GitHub tree API](https://api.github.com/repos/snapquast73-boop/ERLIVE/git/trees/3e8733a836153b4cecf0ee4a2d0f8104be63fbdd?recursive=1) | Confirmed from API on audit date |
| index.html, all 13 lines | Immediate redirect, canonical and only body link point to previous owner's ErrorsLive site | [Uploaded index](https://github.com/snapquast73-boop/ERLIVE/blob/3e8733a836153b4cecf0ee4a2d0f8104be63fbdd/index.html#L1-L13) | Functional blocker: not an independent local application |
| package.json, all 9 lines | Test command references three absent test files; only declared dependency is development dependency jsdom | [Uploaded package manifest](https://github.com/snapquast73-boop/ERLIVE/blob/3e8733a836153b4cecf0ee4a2d0f8104be63fbdd/package.json#L1-L9) | Confirmed missing-file test failure locally |
| package-lock.json, all 542 lines (machine-parsed) | Valid JSON; 40 package entries including root; installation completed using npm ci | [Uploaded lockfile](https://github.com/snapquast73-boop/ERLIVE/blob/3e8733a836153b4cecf0ee4a2d0f8104be63fbdd/package-lock.json) | Installation is not application validation |
| requirements.txt, all 5 lines | Three pinned Python dependencies and a reproducibility assertion referring to absent tools/train_model.py and docs/data/model.json | [Uploaded requirements](https://github.com/snapquast73-boop/ERLIVE/blob/3e8733a836153b4cecf0ee4a2d0f8104be63fbdd/requirements.txt#L1-L5) | Reproducibility assertion unverified; Python packages not installed |
| .gitignore, all 5 lines | Excludes Python caches, virtual environment and node_modules | [Uploaded ignore file](https://github.com/snapquast73-boop/ERLIVE/blob/3e8733a836153b4cecf0ee4a2d0f8104be63fbdd/.gitignore) | No blocker identified in these patterns |
| .gitattributes, both lines | CSV whitespace handling rule and explanatory comment | [Uploaded attributes](https://github.com/snapquast73-boop/ERLIVE/blob/3e8733a836153b4cecf0ee4a2d0f8104be63fbdd/.gitattributes) | No CSV data supplied to validate |
| README.md, 409 lines | Describes an application and prior research not present in uploaded tree; historical claims cannot serve as current verification | [Uploaded README](https://github.com/snapquast73-boop/ERLIVE/blob/3e8733a836153b4cecf0ee4a2d0f8104be63fbdd/README.md) | All model/data/MLB-rule claims remain unverified in this audit |
| Referenced upstream repository | GitHub API returned HTTP 404 for buffedlizard55-lab/ErrorsLive | [Upstream API](https://api.github.com/repos/buffedlizard55-lab/ErrorsLive) | Unavailable to this session; 404 does not distinguish private, renamed or deleted |
| Alternate historical repository name | GitHub API returned HTTP 404 for buffedlizard55-lab/LiveScoringErrors | [Alternate API](https://api.github.com/repos/buffedlizard55-lab/LiveScoringErrors) | Same limitation; do not infer repository contents |
| Original owner | GitHub API returned HTTP 404 for buffedlizard55-lab | [Owner API](https://api.github.com/users/buffedlizard55-lab) | Do not infer why unavailable |
| Pages configuration at audit time | Legacy branch deployment, main, root path; API status built; public URL assigned to this repository | [Pages API](https://api.github.com/repos/snapquast73-boop/ERLIVE/pages) | Build status alone does not prove correct application behavior |
| Earliest concurrent integration claim | Published at 22:12:52 UTC on assigned session branch | [Claim commit](https://github.com/snapquast73-boop/ERLIVE/commit/c5896a8529fbcc2396786ad76b0e53e533d2282b) | Application scope yielded; no duplicate implementation |

## Reproduced checks

- `npm ci`: succeeded; npm reported 39 packages installed, 40 audited, zero reported vulnerabilities at execution time. This is an npm report, not a security guarantee. One deprecated-package warning for whatwg-encoding was emitted.
- `npm test`: **failed**, reporting `Could not find 'tests/pbp-integration.test.cjs'`. Later suites did not run because the script uses `&&`.
- `JSON.parse(package-lock.json)`: succeeded.
- Enumerated README path-like references with a conservative regular expression: 54 unique matches, none present. Some matches are directories or prose fragments (for example `data/RBI`), so **54 is not a missing-file count**.
- Inspected both original commits via GitHub: initial commit adds README only; upload commit supplies the seven-file snapshot. No complete application was recovered from those commits.
- No live MLB requests or GitHub Pages HTTP requests were made: sandbox outbound hosts exclude MLB and github.io. Browser access may differ. Do not label external endpoints or browser CORS behavior verified based on this audit.

## Integration acceptance requirements

1. Remove the previous-owner redirect and provide a repository-local working entry point.
2. Do not describe a newly implemented approximation as an exact recovery of the missing application or retain unsupported model percentages as verified data.
3. Show official per-game/per-play MLB source links on each rendered data row. Leave absent values blank rather than substituting predictions or fixture values.
4. Publish missing-source/model/history limitations on a clearly labeled Flagged for Review page and preserve original-source provenance.
5. Test actual replacement code, project-subpath URLs, failure/loading/empty states, and absent API fields. Report separately what was tested offline and what was verified against live official services.
6. Final integration session must reconcile concurrent scopes, verify checks, merge its PR, and confirm the resulting Pages deployment. This audit has not performed those steps and must not be used as proof that they occurred.
