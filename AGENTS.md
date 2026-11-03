# Blendia agent instructions

Before every work unit, tool invocation, or other action, reopen [the canonical user instructions](.agents/user-instructions.md) and check compliance. That file owns the latest user requirements, including delegation, Draft-first delivery, meaningful tests, cleanup, and issue records. Keep it current when instructions change.

[docs/conventions.md](docs/conventions.md) records the AutoMovie adaptation and reference evidence. Read each skill whose trigger applies. Use the single canonical `.agents/skills` tree; `CLAUDE.md` delegates here.

## Skills

- [project](.agents/skills/project/SKILL.md): choosing product scope, package ownership, language boundaries, or workspace commands.
- [development](.agents/skills/development/SKILL.md): changing source, tests, package configuration, tooling, or CI.
- [contracts](.agents/skills/contracts/SKILL.md): writing or reviewing maintained declarations, tests, or Evidence configuration.
- [documentation](.agents/skills/documentation/SKILL.md): writing maintained documentation, comments, or examples.
- [prompting](.agents/skills/prompting/SKILL.md): changing canonical user instructions, agent routers, skills, or their supporting guides.
- [review](.agents/skills/review/SKILL.md): any review or self-review.
- [pull-request](.agents/skills/pull-request/SKILL.md): maintaining issues or preparing, opening, updating, and merging a pull request.
