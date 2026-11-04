---
name: issue-campaign
description: Runs Blendia's issue campaign through repeated full discovery, issue publication, and one pull request per accepted cycle. Use for broad audits or repeated issue-to-pull-request work, not one defined issue.
---

# Issue Campaign

A cycle audits its named scope on one target baseline until a complete discovery round finds nothing meaningful, then lands every accepted issue in one pull request whose merge starts the next cycle. Follow only the phases the user authorized; an audit-only request publishes and pushes nothing. Report any necessary expansion beyond the named scope. The coordinator supervises subagents doing inspection, implementation, execution and review, with explicit path ownership and one Git/issue writer.

## Discovery

1. Run a complete round under the [Review Law](../review/SKILL.md#review-law) across the declared surface, its actual consumers and workflows, related open and closed issues/PRs, and [applicable contracts](../contracts/SKILL.md), even where tests pass.
2. Check each candidate's owner, history and duplicates under the [issue-record rules](../pull-request/issues.md), then accept, merge, split or reject it. Distinguish reproduced defects, source counterexamples and unobserved validation rather than manufacturing issues from speculation.
3. Repeat complete rounds on the same baseline until one finds nothing meaningful. That freezes the accepted set; a target-branch change restarts discovery.

## Issues

With publication authority, write each accepted issue so a fresh agent can start from it alone: problem, reproduction and root cause, consequence surface and case matrix, invariant to restore, acceptance cases with commands, dependencies and evidence limits. Apply the [general issue-quality and consolidation rules](../pull-request/issues.md); reuse existing records rather than duplicating a campaign or erasing accepted history.

## Pull Request

1. Follow [pull-request](../pull-request/SKILL.md) in the original checkout: branch `codex/` from the baseline, push an empty commit (`git commit --allow-empty`), and open one Draft PR listing every cycle issue, with no closing keywords.
2. Implement every accepted issue in dependency order with meaningful affected tests or actual-host observations. Follow the [project](../project/SKILL.md) and [testing](../development/testing.md) boundaries; do not add MCP E2E, upstream typia revalidation or static framework/configuration tests. Drop an issue only as duplicate, invalid, out of scope or externally blocked, explaining that disposition and any remaining work on the issue.
3. End each resolving commit with `Close #n: <title>` per issue. A revert must not retain the reverted commit's closing line; squash history can still carry that original line, so closing text alone never proves the fix survives.
4. After every pushed commit, run [Individual Self-Review](../review/SKILL.md#individual-self-review) and record it as a `COMMENT` review.
5. On the integrated head, run [Overall Self-Review](../review/SKILL.md#overall-self-review) while CI runs. Collect and fix every failed configured check by cause, pre-existing failures included, and repeat the affected round on the new head without bypassing requirements.
6. Select checks and formatting through [Blendia validation](../development/validation.md), preserving public `ttsc`/`ttsx`, normal plugins, the native guard and source-first execution without a prebuild. Before merging a green, review-clean exact head under the standing mandate, read `git log origin/master..HEAD` to confirm every issue claimed closed retains its fix; reopen any that does not. Follow the existing PR delivery rules rather than copying another repository's build, formatting or release policy.
7. After merge, comment on each resolved issue with its fix, checked revision and verification. Mention a released version only if a separately authorized release actually occurred; a campaign does not authorize publication, tagging or version bumps.
8. Fast-forward `master` with `git pull --ff-only`, remove the merged topic branch only when no other work owns it, and clean only verified disposable paths this campaign owns under [AGENTS.md](../../../AGENTS.md#windows-cleanup-without-force). Preserve user artifacts, evidence, stashes and uncertain/live scratch, recording their retention instead of assuming cleanup or descendant termination. Start the next cycle from the new baseline.

The campaign is complete when a full round on the latest baseline finds nothing meaningful, no accepted issue remains open, and no campaign branch, PR or verified disposable temporary asset remains to retire. Retained artifacts and uncertain paths stay explicitly recorded with their ownership and observation limits; they are not permission to erase evidence or claim an unknown outcome succeeded.
