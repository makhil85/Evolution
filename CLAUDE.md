# Evolution (formerly Rocket Village): working instructions

## Models (always)

- **Main session: Opus 5.5** (`claude-opus-5-5`).
- **Coordinator (main session, Opus 5.5 high):** makes the level-1 and
  level-2 plans, writes each task's metric, integrates, tests and commits.
- **Subagents: Haiku 5.5 at high effort** (`claude-haiku-5-5`; lead,
  2026-10-08; replaces the Opus-medium rule). Makers and critics both. Spawn
  them as `subagent_type: "haiku-high"` (`.claude/agents/haiku-high.md`).
- **5 subagents at a time** (lead). Each gets only the context it needs: its
  task, the files it owns, the metric. Loop: maker -> critic -> one fix round.
- Keep each PR small enough to finish inside one session.

## Standing rules

- Only modify files in this project. (On the lead's PC,
  `C:\Users\dipal\Downloads\AI` is a read-only library.)
- On the lead's PC, keep `Rocket Village.bat` on the Desktop (it runs
  `RUN_GAME.bat`, which is local-only and not in the repo).
- Sound is parked: don't work on it unless asked.
- **New agent? Read `AGENT_HANDOFF.md` first** (vision, features, architecture,
  style, plan, known bugs, lessons learned).
- How everything works, how to test it, open issues: `HANDOFF.md`. Work list:
  `PLAN.md`; teaching lessons: `LESSONS_PLAN.md`.

## Repo and cloud sessions

- GitHub: private repo `Evolution`, branch `main`. Only the current version is
  in it (no old plans, screenshots or asset originals; see `.gitignore`).
- Fresh checkout / cloud: `npm ci`, then `npm run dev` (port 5173) and
  `npm test` (all eleven suites). Browser checks use the lab helpers described in
  `HANDOFF.md` (the game exposes `window.__space`, `__science`, `__city`,
  `__game`).
- Cloud sessions work on a branch and open a pull request; the lead's PC pulls
  `main`.
