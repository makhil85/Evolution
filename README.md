# Rocket Village

A Three.js + Vite educational adventure game for children (about 6-10). The
player builds her own girl character, then plays four chapters at two question
levels (Level 1 and Level 4) and three play modes (Easy / Medium / Hard):

| Chapter | Page | What happens |
|---|---|---|
| 1. Science Village | `chapter1.html` | Gather wood, stone, iron and science; number puzzles; build the Science Center |
| 2. City Engineering | `chapter2.html` | Quests open the bridge; build the Engineering Workshop; Newton's apple tree |
| 3. Rocket Village | `chapter3.html` | Science questions build the rocket stage by stage; launch |
| 4. Voyage to Europa | `chapter4.html` | Real-gravity spaceflight: Earth orbit, the Moon, Mars, the asteroid belt, Jupiter, Europa |

`index.html` is the chapter menu (name, look, difficulty, unlocks);
`character.html` builds her look.

## Run

```bash
npm ci
npm run dev
```

Open the URL Vite prints (normally http://localhost:5173/). Menu shortcuts:
`/?unlock=all` opens every chapter; "Start everything over" wipes all saves.

## Test

```bash
npm test          # all seven suites below
node scripts/test-space-physics.mjs
node scripts/test-space-questions.mjs
node scripts/test-play.mjs
node scripts/test-science.mjs
node scripts/test-city.mjs
node scripts/test-ch3-hunt.mjs
node scripts/test-lessons.mjs
npm run build     # production build into dist/
```

## Where to read next

- `CLAUDE.md`: working rules for Claude sessions (models, standing rules).
- `HANDOFF.md`: how everything works, what changed each session, how to test
  in the browser (lab helpers under `src/**/lab/`), open issues.
- `PLAN.md`: the work list. `LESSONS_PLAN.md`: the teaching-lessons plan.
