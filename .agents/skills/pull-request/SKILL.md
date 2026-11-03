---
name: pull-request
description: Maintains Blendia issue records and delivers scoped pull requests under the user's standing merge mandate. Use for issue updates and branch, commit, push, PR, or merge work.
---

# Pull request

Read the [canonical user instructions](../../user-instructions.md) before each action. Open the Draft PR before implementation: establish its issue, branch, scope, and URL first, using a minimal policy/planning seed if a first commit is required. Keep it a Draft during implementation. The canonical instructions own the ready/self-review/CI/immediate-merge mandate.

Read [issues.md](issues.md) before maintaining scope or research records. Associate the change with existing relevant issues, keep unrelated work out of its diff, and use a `codex/` branch for new branches unless the user specifies otherwise. Stage an explicit source/configuration/documentation/lockfile allowlist in the shared checkout and inspect the staged diff against the canonical artifact exclusions before committing. Use commit subjects shaped as `<type>(<scope>): <imperative subject>`.

Write the PR for a reviewer without the conversation: the concrete problem and resulting behavior, scope, linked issue IDs, applicable verification and outcomes, limitations, and deferred work. Use a UTF-8 body file and `--body-file` for `gh` multiline bodies, preserving real newlines; read the published body back to catch encoding damage. Keep descriptions aligned with the final implementation.

Wait for the current head's checks to finish before pushing a correction that would cancel them. Gather all failures and review findings in one round, fix by cause, then rerun the complete affected round. Record self-review as a `COMMENT` review rather than approving one's own PR. Confirm the current head and check conclusions again immediately before merging; a green superseded commit is insufficient.

Use the repository's allowed merge method, preferring squash when available. After merging, update issue acceptance and verification records, preserve unrelated open work, and choose the next staged issue under the canonical autonomy mandate. Open its Draft before starting implementation without another approval checkpoint. The mandate does not authorize package publication, version bumps, release tags, or unrelated deployment.
