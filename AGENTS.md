# Blendia agent instructions

Before every work unit, tool invocation, or other action, reopen this file and the applicable skills, and check compliance. These tracked files contain the durable project rules and must work in a fresh clone. Optional current-session context may exist in the ignored `.agents/local/user-instructions.md`; consult it when present, but its absence never blocks or replaces the rules here.

[docs/conventions.md](docs/conventions.md) records the AutoMovie adaptation and reference evidence. Read each skill whose trigger applies. Use the single canonical `.agents/skills` tree; `CLAUDE.md` delegates here.

## Fix by cause, in one batch

Never fix one symptom, re-check, then chase the next. For any tests, CI, review, render, or debugging work:

1. Gather all the evidence in one inspection round: every relevant test result, render, measurement, and log.
2. List every phenomenon with its root cause and its contributing factors.
3. Fix them all by cause in one change, then verify with the next full round.

Each fix-and-recheck loop costs usage and time, so batching by cause is what fits the work into the weekly limit.

## Windows cleanup without force

For already-authorized cleanup of verified task-owned paths, use PowerShell `Remove-Item -LiteralPath` without `-Force` by default. If a deletion containing `-Force` is rejected with `blocked by policy`, retry the same verified target without `-Force` before asking the user to perform cleanup. Remove a junction itself before recursively removing its owning temporary directory, and preserve the junction target. Do not treat this as permission to ignore a refusal that still applies without `-Force`.

## Skills

- [project](.agents/skills/project/SKILL.md): choosing product scope, package ownership, language boundaries, or workspace commands.
- [development](.agents/skills/development/SKILL.md): changing source, tests, package configuration, tooling, or CI.
- [contracts](.agents/skills/contracts/SKILL.md): writing or reviewing maintained declarations, tests, or Evidence configuration.
- [documentation](.agents/skills/documentation/SKILL.md): writing maintained documentation, comments, or examples.
- [prompting](.agents/skills/prompting/SKILL.md): changing agent routers, skills, or the storage of session instructions.
- [review](.agents/skills/review/SKILL.md): any review or self-review.
- [issue-campaign](.agents/skills/issue-campaign/SKILL.md): broad audits or repeated discovery, issue publication, implementation, and delivery cycles.
- [pull-request](.agents/skills/pull-request/SKILL.md): maintaining issues or preparing, opening, updating, and merging a pull request.
