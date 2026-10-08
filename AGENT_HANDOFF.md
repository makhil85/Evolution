# Rocket Village: handoff for a new AI agent

Written 2026-10-08, at `main` after PR #16. Read this first, then the
detailed docs it points to. Where this file and an older note disagree, this
file and the newest `HANDOFF.md` session notes win.

| Doc | What it is |
|---|---|
| `AGENT_HANDOFF.md` (this) | The whole picture: vision, features, architecture, style, plan, bugs, lessons learned |
| `CLAUDE.md` | Standing rules for agents (models, subagents, folders, sound parked). Always loaded. |
| `HANDOFF.md` | Running log of every session: what changed, how things work, how to test. Newest sections at the bottom. |
| `PLAN.md` | The work list (older; "Next items" still valid, see section 8 below) |
| `LESSONS_PLAN.md` | The teaching-lesson design (films + questions) |
| `CHAPTER5_PLAN.md`, `CHAPTER6_PLAN.md` | Chapter designs (Ch6 restructured 10-07: see the note at its top) |

---

## 1. Game vision

A browser game for kids that teaches real science and maths by **doing**:
build a village, a city, a rocket, then fly it with real gravity to the
Moon, Mars, Jupiter, Saturn, the edge of the solar system, and finally plan
a trip to another star. One girl (or boy) hero the child names and designs,
in every chapter.

- **Two question Levels**: Level 1 = 1st-2nd grade, Level 4 = 4th-6th grade
  (Math Kangaroo / gifted-maths style). Every player-facing string exists in
  both: `t(level4Text, level1Text)`.
- **Real physics, kid-sized.** Orbits, transfers, slingshots, the Oberth
  effect, energy and momentum are real models (patched conics, two-body
  sums), with help layered on top for younger kids (Easy/Medium modes,
  autopilot, catch zones).
- **Watch, answer, try it.** Short animated lesson films with a question
  after each, then the child does the thing in the game.
- **Questions are earned, not thrown.** A question comes after a task, after
  a calm moment (5 s), never as a pop-up mid-action. Two wrong tries restart
  the act (the lead's rule: no skipping questions, except grown-up mode).
- **Calm, readable screens.** The lead repeatedly asks for less clutter:
  fewer streaks/particles, one goal at a time, a clear "Next goal" banner and
  a box round the target.
- The lead (the user, a parent) play-tests on a Windows PC and sends lists of
  fixes. They want short, plain answers, and one PR per batch of fixes.

## 2. Quick start

```
npm ci                 # once (close the game first on Windows, or EPERM)
npm run dev            # http://localhost:5173/   (chapters: /chapter1.html ... /chapter6.html)
npm test               # all ten suites; must pass before every commit
npm run build          # must pass too
npm run package        # build + release/RocketVillage.zip (double-click PLAY.bat to play)
```

- **Grown-up mode**: add `?unlock=all` to any page (`?unlock=off` undoes it).
  Unlocks every chapter, adds **Skip (grown-up)** on every question, lesson
  film and mini-game, and a **⏭ Jump** panel (bottom left) to go to any part.
- The lead's PC: `C:\Users\dipal\Downloads\rocket-village-mobile-rpg-build-v1`,
  started by `Rocket Village.bat` on the Desktop (runs `RUN_GAME.bat`, local
  only). They update with `git pull`.
- Repo: GitHub `makhil85/Evolution`, branch `main`. Cloud sessions work on a
  `claude/...` branch and open a PR; the lead merges.

## 3. What is built (all on `main`)

### Launcher and hero
`index.html` (`src/launcher/`), `character.html` (`src/character/`): name
and design the hero once (wardrobe, face, hair, girl or boy); chapter cards
unlock in order; difficulty buttons pick Level 1 or 4; Lessons list replays
any lesson; "Start everything over".

### Chapters 1-3: the villages (walking, building, questions)
| Ch | Page / code | What |
|---|---|---|
| 1 Science Village | `chapter1.html` -> `src/science/` | Gather resources, solve maths boards and science labs, build the Science Center; key-gate puzzle; lessons 1A (round Earth) and 1B (Eratosthenes) |
| 2 City Engineering | `chapter2.html` -> `src/city/` | Bridge, gears, power, tiles puzzles; build the workshop; Newton's apple tree; lessons 2A (truss bridges, with a green->red strain animation) and 2B (Archimedes) |
| 3 Rocket Village | `chapter3.html` -> `src/gameScene.js`, `src/game/` | A quest chain of questions and builds (QUEST_CHAIN in `src/game/quests.js`), build the rocket in 5 stages, Launch Tuner, launch; lessons 3A (push back, go forward), 3B (heavy rockets), 3C (energy never disappears, added 10-07) |

Shared: play modes (`src/play/`: Easy arrow+glow, Medium/Hard mining by E,
Hard treasure hunt), fun moves (H J K L U I B; `src/game/emotes.js`),
chapter openings/endings (`src/game/chapterStory.js`), the question modal
(`src/game/hud.js`), held-key guard (`src/game/heldKeys.js`).

### Chapters 4-6: space (one engine, `src/space/`)
| Ch | Page | What |
|---|---|---|
| 4 Voyage to Europa | `chapter4.html` | Earth orbit (2 laps, zero-g), satellite rescue (two-panel solar game), a lap with it, Flight School lesson, Moon transfer, get in Moon orbit -> circle it -> land, Moon walk, lift off, leave Earth (top-down view), Mars orbit, asteroid belt (mining claw, Ceres any time, upgrades), Jupiter (radiation, moons), Europa landing and walk, end card |
| 5 Rings to a Star | `chapter5.html` (`src/space/ch5/`) | Jupiter -> Saturn (hexagon pole pass, rings lesson, ring run shooter, momentum lesson), Uranus, Neptune, Kuiper belt, Space pool game, Pluto, the edge cutscene, fusion lesson; **ends at the edge** (10-07) |
| 6 The Long Trip | `chapter6.html` (`src/space/ch6/`) | **Starts back in the asteroid belt** (10-07): design the ship (design board), find Rock B (rock hunt), build/test the engine (workshop + test-fire cutscene); supply ship docks, meet the crew (2 kids, 2 robots); walk the habitat inside the rock (6 stations: shield, oxygen, water, farm, power, pack list); lesson 6A tiny Earth; Part E: lesson 6B energy (4 films), route planner (10 t then 100 t of fuel, 5 routes, speed far from the Sun), fly it (timing card), fusion drive on, lesson 6C light speed, years to a star, end |

Space features worth knowing: Easy/Medium/Hard flight modes (+ Level 1
tables), autopilot (P), auto-turn (T), freeze (F), time warp 1-4, Retry,
transfer panel and burn banners, minimap, markers with a pulsing "Next:" box,
"Next goal" banner (`hud.announce`), Easy/Medium **catch zone** (fly into the
blinking ring and you're put in a steady orbit; Hard keeps real captures),
"Landed on X!" card, two-tries rule, checkpoints.

**Controls (space, since 10-07):** Space (or W) fires the engine, S reverse,
← → (or A D) turn, Q steady/aim (Easy), Shift fine, 1-4 warp, E use, M map,
J mission card, P autopilot, T auto-turn, F freeze, R rewind, C camera, Esc
pause. On foot: WASD/arrows walk, Space jump, E use.

## 4. Architecture

Plain ES modules, Three.js 0.185, Vite 8. No framework, no other runtime
dependencies. Each chapter is its own HTML page (`vite.config.js` inputs),
`base: './'`.

### 4.1 Shared building blocks
- **Levels and text**: `src/space/level.js` exports `LEVEL`, `IS_LEVEL1`,
  `t(l4, l1)` (used by Ch1-6 lessons and space). Lesson/station data use
  `[L4, L1]` pairs.
- **Lessons** (`src/lesson/`): `card.js` plays a lesson (films of beats on an
  800x450 canvas stage, `draw.js` helpers), `lessonOnce(lesson)` plays it
  once per Level. Lessons live in `lessons/*.js`; `index.js` lists them for
  the launcher (order must match `scripts/test-lessons.mjs`).
- **Question modals**: Ch1-3 `src/game/hud.js` `askQuestion`; Ch4-6
  `src/space/hud/questionModal.js` (Promise). Banks: `src/game/questions.js`
  (+`questions.level1.js`), `src/science/questions.js`, `src/city/questions.js`,
  `src/space/questions.space.js` (Ch4 + Level 1 overlay; `selectBank()` picks
  Ch5's `ch5/questions.ch5.js` or Ch6's part B/E banks + `c5_deuterium`).
- **Grown-up tools**: `src/play/grownUp.js` (`isGrownUp`, `skipButton`,
  `addJumpPanel`, `addVillageJump`).
- **Play UI**: `src/play/ui.js` (`openLayer`, `el`), `modes.js`, `navArrow.js`.

### 4.2 The space engine (`src/space/`)
- `chapter.js`: `CHAPTER`, `IS_CH5`, `IS_CH6`, `OUTER` (Ch5/6 share Pluto,
  cruise warp, long windows).
- `contracts.js`: bodies (`BODIES`, `soi`, `radius`, `gm`), ship constants,
  `FLIGHT_MODES` / `FLIGHT_MODES_L1`, `BELT`, `RADIATION`, `UPGRADES`,
  store keys, `CALM_S`.
- `main.js`: the loop. Floating origin (the ship sits at the scene origin;
  bodies are drawn at `state - origin`), physics step, `catchZone.update`,
  camera (chase / top; escape top-down view), markers, HUD, `missions.update`.
  While a walk/mini scene runs (`game.runScene(scene)`), flight is frozen and
  only `activeScene.tick` + `missions.tickCalm` run.
  `runScene` contract: `{ scene, camera, start() -> Promise, tick(dt, input, mouse, modalOpen), dispose() }`.
- `gravity.js`: the one gravity model for flight and predicted path. In a
  moon's zone only the moon pulls (pure Kepler); in a planet's zone the
  planet + its moons (10% rule); between planets the Sun. `setMoonPulls(false)` in Ch6.
- `physics.js`: integrator, burns, landing, warp safety. `orbits.js`:
  `bodyState(id, t)`. `predictor.js`: the dotted path.
- `transferPlanner.js` + `autopilot.js`: burn windows and the autopilot
  (keyword-matches banner text; holds Q to aim, W to burn; `orbitFix`).
- `missions.js`: the step chain. A step is
  `{ id, act, title, objective, markers, transfer?, capture?, land?, escape?, aim?, enter(game), check(game, states, stepTime), beat?, bonusBeats?, after(game), calm?, doneEarly?() }`.
  On `check()` true: tick off, 5 s calm (if a question follows), ask `beat`
  and `bonusBeats`, run `after`, save, next step. `enterStep` shows the
  "Next goal" banner. Save = `stepId` + ship state + resources
  (`localStorage`, keys per chapter/Level). `jump(id)` (debug) and `jumpTo(id)`
  (grown-up: places the ship and reloads). `ask(beat, { calm })` for mid-step
  questions (Ch6 stations, Ceres).
- Steps: Ch4 `acts/act1..5.js`; Ch5 `ch5/steps.js` (partA-D); Ch6
  `ch6/steps.js` (partBuild, A, B, C, E). Mini-games are 2-D cards in the
  play layer (`playPool`, `playRockHunt`, `playWorkshop`, `playDesignBoard`,
  `playStation`, `playRoutePlanner`, `playSlingshots`), each with a
  `window.__x` test hook and a grown-up Skip.
- `catchZone.js`: Easy/Medium capture ring (Jupiter 1500 u/settle 1400,
  Saturn settles outside the rings, else ~3.5-8 R, settle 2.2 R).
- `hud/`: `hud.js` (mission card, toasts, `announce`), `markers.js`
  (`kind: 'goal'` = pulsing box), `transferPanel.js`, `minimap.js`,
  `toggleBar.js` (Autopilot/Auto-turn/Freeze pills), `touch.js`.
- `surface.js`, `surface/walker.js`: Moon/Europa walks; `ch6/habitat.js`
  uses `createWalker({ gait: 'earth' })` (no Moon lope).
- `controls.js`: flight keys via `src/game/heldKeys.js`; `input.fire` = Space.

### 4.3 Pure logic modules (node-testable, no drawing)
`ch6/routes.js` (two-body route model: 1,000 t ship, 300 km/s exhaust,
patched-conic flybys, Sun-dive Oberth burn), `ch6/stationsLogic.js`,
`ch5/poolLogic.js`, `ch5/ringRunLogic.js`, `ch5/lineup.js`, `src/*/rules.js`
(Ch1-2 rules), `src/game/quests.js` (Ch3 chain). Keep it this way: rules in
their own file, the card/scene draws them.

### 4.4 Saves (localStorage)
`rocket_village_profile` (difficulty 1/4, name), `rocket_village_unlock_all`,
`rocket_village_ch4_flight_mode`, `rocket_village_lesson_<id>_L<n>`,
`rocket_village_seen_*` / `_done_*`; Ch4/5/6 saves
`level4_voyage_europa_v1`, `level5_rings_to_a_star_v1`,
`level6_long_trip_v1` (+`_L1`, `_act`, `_ckpt`); Ch6 extras
`rocket_village_ch6_stations_L<n>`, `rocket_village_ch6_route_L<n>`;
Ch1-3 keys in each `contracts.js` / `quests.js`.

## 5. Coding style (match it)

- 2-space indent, single quotes, semicolons, `const`/`let`, arrow helpers,
  small pure functions; JSDoc on exported functions.
- **Every file starts with a header comment**: what it is, how it fits, and
  any lead decision with its date ("Lead 2026-10-07: ...").
- Comments explain **why**, often quoting a play-test ("lead playtest: the
  autopilot button was hidden under Chapters"). Keep that habit; it is how
  the next agent learns the history.
- Every player-facing string: `t(level4, level1)` or a `[L4, L1]` pair.
  Level 1 = short, simple words. Keep fixed command words the autopilot
  matches (BURN NOW, hold Space/W, Let go, Coast, On course, Too fast).
- No new dependencies. No sound (parked). No touch/tablet work unless asked.
- Lesson films: draw on the 800x450 stage, last frame still shows the answer
  (the question is asked over it), labels beside the picture, respect
  `opts.reduced`, films under 45 s, 3 choices with one right.
- Question choices must never be a bare number ("3") - the checker reads it
  as an index; write "3 parts".
- Numbers in questions are **re-derived from the game's own tables** in the
  tests (e.g. `test-ch6-route.mjs`), so a retune can't leave a question wrong.
- Test hooks: `window.__space`, `__science`, `__city`, `__game`, `__station`,
  `__route`, `__sling`, `__lesson`, scene `.debug`.
- Docs: append a dated section to `HANDOFF.md` per session; keep this file
  current when the big picture changes.

## 6. Testing and verifying

- `npm test`: ten suites (space physics, space questions, play, science,
  city, ch3 hunt, lessons, ch5 flight, ch5 games, ch6 route). Some load modules
  through Vite (`createServer().ssrLoadModule`) because `import.meta.env`.
- **Browser checks**: Playwright is at `/opt/node-tools/node_modules/playwright/index.mjs`
  (cloud), Chromium with `--use-gl=swiftshader --enable-unsafe-swiftshader`.
  Software GL is SLOW: use `waitUntil: 'commit'`, timeouts of 5+ min,
  `waitForFunction(..., { polling: 2000 })`. Seed `localStorage` with an
  init script (profile + `rocket_village_ch4_flight_mode`) to skip choosers.
- Useful in-page: `window.__space.missions.jump('step_id')`,
  `.jumpTo('step_id')`, `window.__space.debugRun(sec, dt)`,
  `import('/src/space/lab/playtest.js')` (`autoplay`, `skipIntro`, ...),
  `window.__science.controller.teleport(x, y, z)`, `__route.solve()/go()`,
  `__sling.solve()`, `activeScene.solve()` (panel game).
- What tests can't tell you: feel, frame rate on a real screen, whether a
  child understands. The lead's PC is the real test; say clearly what you
  did not check.

## 7. How the lead works with you

- They send numbered lists of play-test issues (often by voice: read
  generously). Fix them in one PR per batch; new requests mid-work go in the
  **next** PR (keep a task list).
- One PR per batch, branch `claude/<topic>`, title + body in plain language,
  "Checks" section saying what was and wasn't verified. Stacked PRs: after
  the parent merges, **retarget the child PR's base to `main`**.
- They merge themselves, then `git pull` on Windows. Watch PRs you open
  (subscribe) and keep them conflict-free (several PRs append to
  `HANDOFF.md`: merge `main` in and keep both sections).
- Subagents: `subagent_type: "opus-medium"`, 2-3 at most, give each a strict
  list of files it may edit, create the branch BEFORE dispatching, and tell
  them not to commit or kill processes by pattern.

## 8. Plan: what is next

From the lead and `PLAN.md`, roughly in order:
1. **A child plays every chapter**: watch where they get stuck.
2. **Real-screen pass** of everything built since 10-06 (none of it was seen
   on a real screen by an agent): Ch6 habitat frame rate and cutscenes, the
   Ch6 build steps in their new place, the route planner and flight card,
   Ch5 ring-run flicker fix, the edge/new Ch5 end, markers + "Next" box,
   escape top-down view, catch zone at Jupiter and Saturn, Hard mode (no catch
   zone), the full Moon lap -> land -> walk flow, the two-panel solar game.
3. **Level 1 tuning** of Chapters 5 and 6 (`npm run reading`; mini-games at Level 1).
4. **Level 1 Chapter 4 Medium/Hard re-runs.**
5. **Hard clue wording** review (treasure hunts in Ch1-3).
6. Open design questions left with the lead (10-07):
   - Sun dive closest pass: 4 Sun-widths is allowed (risky, heat warning);
     Parker Solar Probe got to ~10. Block 4, or keep?
   - "Sun dive + 2 planets" was built as Jupiter-then-Sun (planets wouldn't
     line up again after the Sun). Add a second planet?
   - The Sun dive wins at both 10 t and 100 t (true physics). OK as is?
7. Parked: touch/tablets, phone layout, sound.

## 9. Known bugs and risks

- **Chapter 1 "keeps walking after releasing the arrow"**: never reproduced
  in headless Chrome (she stops in ~0.4 s). `heldKeys.js` now drops a key
  whose auto-repeat goes quiet and clears on blur/hidden tab. Ask the lead if
  it still happens.
- **Old saves after the 10-07 restructure**: Ch5 saves sitting on removed
  steps (`c5_design_ship`, `c5_rock_hunt`, `c5_engine`) fall back to their
  saved index and may resume at the wrong step; Ch6 saves resume at their
  step id but the ship stays where it was saved (Kuiper belt) rather than in
  the asteroid belt. Fix if the lead reports it (or restart the chapter).
  Very old Ch4 saves without `stepId` (pre-10-02) may be off by one after
  `a1_ride` was inserted.
- **Catch zone glide**: for a few seconds after being caught, she is pinned
  to a circle (W does nothing). Intentional, but could confuse.
- **Lesson 6B film 4** is drawn for intuition, not to scale (both ships share
  one inbound path; the Sun pass isn't at 4 Sun-widths).
- Build warnings that are harmless: `new URL('../', import.meta.url)` in
  `src/science/main.js`, chunk > 500 kB, ineffective dynamic imports.
- `npm run package` needs Node (or Python) on the player's PC to serve the
  game; double-clicking `index.html` cannot work (browser file rules).
- Touch pad (Ch4-6) is simulated-only; AIM/JUMP now holds Q.

## 10. Lessons learned (read before you start)

**Tools and environment**
- **Never `pkill -f <pattern>`** where your own command line contains the
  pattern: it kills your own shell (happened 3 times). Use `pgrep` and skip
  `$$`, or kill by port/PID.
- Editing source files while a Playwright test runs makes **Vite reload the
  page mid-test**. Don't edit during browser checks (docs are fine).
- A helper's cleanup can stop the shared dev server; check with
  `curl -s -o /dev/null -w "%{http_code}" localhost:5173/` and restart
  `npm run dev` if needed.
- `.sp-modal` exists in the DOM even when no modal is open: detect modals by
  visible buttons or the HUD's `isModalOpen()`.
- Ch1-3 HUD (`.rv-hud *`) has `pointer-events: none`; new buttons inside it
  need `pointer-events: auto`.
- Python edits: `'\b'` in a normal string writes a backspace into JS; use raw
  strings. Bash heredocs with many quotes break: use the file tool.
- On Windows, `npm ci` fails with EPERM while the game (dev server) is
  running. Close it first.
- Windows `tar` zips store `./name` entries that Explorer shows as empty: the
  package script writes the zip itself in Node and reads it back to verify.

**Game and physics**
- The autopilot and tests match **banner words**; when you rename a key in
  text (W -> Space), update `autopilot.js` regexes too.
- Speed far from the Sun is not additive (it's sqrt of energy, and crosses
  zero): show per-stop **energy** ("energy points") and the final speed.
  A plain swing past a body that isn't moving relative to you gains nothing.
- Placing a ship: always place in a body's frame (`bodyState` + circular
  speed `sqrt(gm/r)`), and keep orbits inside half the SOI.
- Steps that build closures must be built once (don't call `partXSteps(game)`
  twice: you get two disconnected sets of state).
- When inserting a step, check everything that keys off step ids
  (`autopilot.js`, `lab/*`, `jumpTo`, tests' expected chain order).
- `test-lessons.mjs` expects 3 films unless listed in its `FILMS` map;
  `index.js` order must match its `LESSONS` list.
- Fuel has mass: for "more range" prefer `burnScale`/efficiency over a
  bigger tank.

**Working with the lead**
- Ask before big redesigns (use a short multiple-choice question with a
  recommended option); then build exactly what they chose.
- Admit what you couldn't reproduce or check; give them the exact steps to
  check on their PC.
- Keep replies short: what changed, what to test, what's open.
