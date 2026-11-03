---
name: pull-request
description: Maintains Blendia issue records and delivers scoped pull requests under the user's standing merge mandate. Use for issue updates and branch, commit, push, PR, or merge work.
---

# Pull request

Open the Draft PR before implementation: establish its issue, branch, scope, and URL first, using a minimal policy/planning seed if a first commit is required. Keep it a Draft during implementation. Once the change is ready, complete a fresh clean [self-review](../review/SKILL.md) and verify configured required CI checks are green on the exact current head. Mark the PR ready and merge immediately without another permission request. Never bypass failing checks or branch protection.

Read [issues.md](issues.md) before maintaining scope or research records. Associate the change with existing relevant issues, keep unrelated work out of its diff, and use a `codex/` branch for new branches unless the user specifies otherwise. Stage an explicit source/configuration/documentation/lockfile allowlist in the shared checkout and inspect the staged diff before committing. Never commit or push generated tarballs, `lib` output, `node_modules`, scratch artifacts, temporary binaries, or personal records under `.agents/local/`. Use commit subjects shaped as `<type>(<scope>): <imperative subject>`.

Write the PR for a reviewer without the conversation: the concrete problem and resulting behavior, scope, linked issue IDs, applicable verification and outcomes, limitations, and deferred work. Use a UTF-8 body file and `--body-file` for `gh` multiline bodies, preserving real newlines; read the published body back to catch encoding damage. Keep descriptions aligned with the final implementation.

Wait for the current head's checks to finish before pushing a correction that would cancel them. Gather all failures and review findings in one round, fix by cause, then rerun the complete affected round. Record self-review as a `COMMENT` review rather than approving one's own PR. Confirm the current head and check conclusions again immediately before merging; a green superseded commit is insufficient.

Use the repository's allowed merge method, preferring squash when available. After merging, update issue acceptance and verification records, preserve unrelated open work, and continue the next authorized issue without another approval checkpoint. Open its Draft before starting implementation. PR delivery does not authorize package publication, version bumps, release tags, or unrelated deployment.
