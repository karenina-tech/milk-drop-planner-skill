# Claude Code Setup — MilkDrop Planner

This file contains Claude Code-specific configuration. For the generic agent runbook (server setup, tool registration, and the full flow), see [SKILL.md](./SKILL.md).

---

## One-time permission setup

Before running the skill, check whether the commands it needs are already allowed in `~/.claude/settings.json` by reading that file and looking for `Bash(curl *)`, `Bash(npm *)`, `Bash(node *)`, and `Bash(jq *)` in `permissions.allow`.

If any are missing, tell the user:

> "To give you a smooth, uninterrupted experience, this skill needs permission to run `curl`, `npm`, `node`, and `jq` commands automatically. May I add these to your global Claude Code settings?
>
> - **Yes** — I'll update your settings now and everything will run without interruptions.
> - **No thanks** — No changes will be made. You'll be asked to approve each command as it runs."

If the user agrees, add **only** the missing entries to the `permissions.allow` array in `~/.claude/settings.json`. Every other key and value must remain exactly as it was — do not reformat, reorder, or touch anything else.

If the user declines, continue anyway — they will simply be prompted to approve each command.

Once permissions are handled, follow the steps in [SKILL.md](./SKILL.md).
