# Evolution

(Formerly "Rocket Village"; renamed by the lead on 2026-10-09. Save keys keep their `rocket_village_` prefix so no one loses progress.)

A Three.js + Vite educational adventure game for children (about 6-10). The
player builds her own girl character, then plays seven chapters at two question
levels (Level 1 and Level 4) and three play modes (Easy / Medium / Hard):

| Chapter | Page | What happens |
|---|---|---|
| 1. Science Village | `chapter1.html` | Gather wood, stone, iron and science; number puzzles; build the Science Center |
| 2. Forces and Machines | `chapter2.html` | Quests open the bridge; build the Engineering Workshop; Newton's apple tree |
| 3. Ready for Lift-off | `chapter3.html` | Science questions build the rocket stage by stage; launch |
| 4. Voyage to Europa | `chapter4.html` | Real-gravity spaceflight: Earth orbit, the Moon, Mars, the asteroid belt, Jupiter, Europa |
| 5. Rings to a Star | `chapter5.html` | Saturn's rings, the ice giants, Pluto and the edge of the Sun's family; fusion |
| 6. The Long Trip | `chapter6.html` | Build a starship from an asteroid, life on board, slingshots and the fastest way out |
| 7. Toward Tau Ceti | `chapter7.html` | Full power toward Tau Ceti: feel the push, zero g, chemistry and life on board, a holodeck quasar |

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
npm test          # every suite (the list is in package.json); for example:
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
