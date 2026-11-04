---
name: review
description: Reviews Blendia's declared audit scope or complete change and its real consumers, evidence, tests, and CI, including campaign per-commit reviews. Use for every review and self-review.
---

# Review

## Review Law

For an audit, read the whole declared surface on its named baseline. For a change, review the entire base-to-head diff and uncommitted work in scope. Follow the surface into actual consumers, meaningful first-party units, affected actual Blender scenarios, workflows and platforms. Inspect artifact exclusions and the staged file allowlist. Reconcile delegated inspections into one complete review; a file-by-file split does not replace it.

Apply the repository-wide batch-by-cause rule: collect a round's findings before changes, fix identified causes together, and perform a fresh complete affected round. Finish only after a complete round finds no actionable defect. Check that [contract](../contracts/SKILL.md) answers are true and complete, selectors reach their intended declarations, dependencies belong to their owners, and verification observes real behavior.

Check applicability before checking answers: each selected Evidence requirement must be material to its respondent. Remove copied `N/A` or type-only complexity rituals and correct overbroad contracts without discarding real obligations. Review package and CI changes against the [local source invariant](../development/SKILL.md#local-source-and-distribution).

## Overall Self-Review

An unqualified review request means Overall Self-Review: apply the Review Law to the whole declared audit or complete change, not only its latest commit. Record the reviewed head, clean round, checks performed, unavailable checks and claims not proven on a real host. Review alone does not make CI green. The [pull-request skill](../pull-request/SKILL.md) owns exact-head check confirmation and immediate merge under the user's standing mandate.

## Individual Self-Review

In an [issue campaign](../issue-campaign/SKILL.md), apply the Review Law to one pushed commit's diff and its affected consumers, then record the result as a `COMMENT` review. This per-commit review never replaces Overall Self-Review of the integrated head.
