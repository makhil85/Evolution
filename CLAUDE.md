# Rocket Village: working instructions

## Models (always)

- **Main session: Opus 5.5** (`claude-opus-5-5`).
- **Subagents: Opus 5.5 at medium effort** (lead, 2026-10-02; replaces the
  earlier Sonnet 5.5 rule). Spawn them as `subagent_type: "opus-medium"`
  (`.claude/agents/opus-medium.md`: `model: opus`, `effort: medium`).
- Keep subagents few (2-3 at a time at most) so the work stays inside the
  5-hour usage window. Cap review rounds at 2; fix small findings in the main
  session instead of sending another agent round.

## Standing rules

- Only modify files in this project. (On the lead's PC,
  `C:\Users\dipal\Downloads\AI` is a read-only library.)
- On the lead's PC, keep `Rocket Village.bat` on the Desktop (it runs
  `RUN_GAME.bat`, which is local-only and not in the repo).
- Sound is parked: don't work on it unless asked.
- How everything works, how to test it, open issues: `HANDOFF.md`. Work list:
  `PLAN.md`; teaching lessons: `LESSONS_PLAN.md`.

## Repo and cloud sessions

- GitHub: private repo `Evolution`, branch `main`. Only the current version is
  in it (no old plans, screenshots or asset originals; see `.gitignore`).
- Fresh checkout / cloud: `npm ci`, then `npm run dev` (port 5173) and
  `npm test` (all seven suites). Browser checks use the lab helpers described in
  `HANDOFF.md` (the game exposes `window.__space`, `__science`, `__city`,
  `__game`).
- Cloud sessions work on a branch and open a pull request; the lead's PC pulls
  `main`.
