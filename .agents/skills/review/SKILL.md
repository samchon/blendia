---
name: review
description: Reviews a complete Blendia change and its real consumers, evidence, tests, and CI. Use for every review and self-review before delivery.
---

# Review

Review the entire base-to-head diff and uncommitted work in scope. Follow the change into actual consumers, permitted first-party unit cases, workflows, and affected platforms. Inspect artifact exclusions and the staged file allowlist. A file-by-file split does not replace the complete review.

Apply the repository-wide batch-by-cause rule: collect a round's findings before changes, fix identified causes together, and perform a fresh complete affected round. Finish only after a complete round finds no actionable defect. Check that [contract](../contracts/SKILL.md) answers are true and complete, selectors reach their intended declarations, dependencies belong to their owners, and verification observes real behavior.

Check applicability before checking answers: each selected Evidence requirement must be material to its respondent. Remove copied `N/A` or type-only complexity rituals and correct overbroad contracts without discarding real obligations. Review package and CI changes against the [local source invariant](../development/SKILL.md#local-source-and-distribution).

Record the reviewed head, clean round, checks performed, unavailable checks, and claims not proven on a real host. Review alone does not make CI green. The [pull-request skill](../pull-request/SKILL.md) owns exact-head check confirmation and immediate merge under the user's standing mandate.
