# Coordination

In progress — session 94900775, sole integration claim: review imported files, Pages deployment, review page and validation. Scope: repository-wide. No other remote task branches present at claim.

Done — reconstructed root Pages scoreboard and primary ruling feed. GitHub Pages API confirmed main:/ publishing. Checked official [MLB schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30), [empty day](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-11-20) and [play record](https://statsapi.mlb.com/api/v1/game/775296/playByPlay); DOM regression and local site link checks via npm test. Static deployment, no compile step.

Needs review — [published limitations](review.html): missing upstream application, research artifacts, change tracking and parity; historical README claims are not confirmed. No unsupported model or historical table values published in the application.

[PR #2](https://github.com/snapquast73-boop/ERLIVE/pull/2) merged to main at b8ff758. [Pages build and deployment succeeded](https://github.com/snapquast73-boop/ERLIVE/actions/runs/44827242700).

In progress — session 505d0103, independent deployed-site verification only: `verification/session-505d0103.md` and this coordination entry. The original integration claim (82fb8df) overlapped the earlier claim from 94900775; yielded in [tracking issue #1](https://github.com/snapquast73-boop/ERLIVE/issues/1#issuecomment-7051901792). During rebase, resolved the `COORDINATION.md` add/add conflict by retaining the integrator's entries and recording this narrower claim. No application files changed by this session.

Rebase log — the deployment closeout from [PR #3](https://github.com/snapquast73-boop/ERLIVE/pull/3) overlapped the audit claim at end of this file. Both entries were preserved.

Done — independent verification by session 505d0103: [evidence and official source links](verification/session-505d0103.md). Tests passed; verified merge [#2](https://github.com/snapquast73-boop/ERLIVE/pull/2), successful [Pages build/deploy](https://github.com/snapquast73-boop/ERLIVE/actions/runs/44827242700) and public [Flagged for Review](https://snapquast73-boop.github.io/ERLIVE/review.html).

Needs review — primary-pending filter mismatch reproduced against a synthetic fixture and checked against [MLB’s event registry](https://statsapi.mlb.com/api/v1/eventTypes); [requested integration or handoff in issue #1](https://github.com/snapquast73-boop/ERLIVE/issues/1#issuecomment-7051901792). Game 823490 was [cancelled due to rain](https://statsapi.mlb.com/api/v1.1/game/823490/feed/live?fields=gamePk,gameData,status,detailedState,reason) and [has no linescore runs](https://statsapi.mlb.com/api/v1/game/823490/linescore). Other historical counts and model claims are unverified.
