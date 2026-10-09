# Evolution (formerly Rocket Village): handoff for a new AI agent

The game is called **Evolution** (lead, 2026-10-09): from a village's first
science to the stars, and later the evolution of life itself. Save keys and
file names keep `rocket_village` so no progress is lost.

Written 2026-10-08 at `main` after PR #16; updated 2026-10-08 (late) for the
open PRs #22-#34 and Chapter 7. Read this first (section 11 lists the
mistakes the lead keeps catching: read it before every PR), then the
detailed docs it points to. Where this file and an older note disagree, this
file and the newest `HANDOFF.md` session notes win.

| Doc | What it is |
|---|---|
| `AGENT_HANDOFF.md` (this) | The whole picture: vision, features, architecture, style, plan, bugs, lessons learned |
| `CLAUDE.md` | Standing rules for agents (models, subagents, folders, sound parked). Always loaded. |
| `HANDOFF.md` | Running log of every session: what changed, how things work, how to test. Newest sections at the bottom. |
| `PLAN.md` | The work list (older; "Next items" still valid, see section 8 below) |
| `LESSONS_PLAN.md` | The teaching-lesson design (films + questions) |
| `CHAPTER5_PLAN.md`, `CHAPTER6_PLAN.md`, `CHAPTER7_PLAN.md` | Chapter designs (Ch6 restructured 10-07: see the note at its top; Ch7 is being built, section 8) |

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
npm test               # every suite (15 now); must pass before every commit
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
| 2 Forces and Machines (was City Engineering) | `chapter2.html` -> `src/city/` | Bridge, gears, power, tiles puzzles; build the workshop; Newton's apple tree; lessons 2A (truss bridges, with a green->red strain animation) and 2B (Archimedes) |
| 3 Ready for Lift-off (was Rocket Village) | `chapter3.html` -> `src/gameScene.js`, `src/game/` | A quest chain of questions and builds (QUEST_CHAIN in `src/game/quests.js`), build the rocket in 5 stages, Launch Tuner, launch; lessons 3A (push back, go forward), 3B (heavy rockets), 3C (energy never disappears, added 10-07) |

Shared: play modes (`src/play/`: Easy arrow+glow, Medium/Hard mining by E,
Hard treasure hunt), fun moves (H J K L U I B; `src/game/emotes.js`),
chapter openings/endings (`src/game/chapterStory.js`), the question modal
(`src/game/hud.js`), held-key guard (`src/game/heldKeys.js`).

### Chapters 4-6: space (one engine, `src/space/`)
| Ch | Page | What |
|---|---|---|
| 4 Voyage to Europa | `chapter4.html` | Earth orbit (2 laps, zero-g), satellite rescue (two-panel solar game), a lap with it, Flight School lesson, Moon transfer, get in Moon orbit -> circle it -> land, Moon walk, lift off, leave Earth (top-down view), Mars orbit, asteroid belt (mining claw, Ceres any time, upgrades), Jupiter (radiation, moons), Europa landing and walk, end card |
| 5 Rings to a Star | `chapter5.html` (`src/space/ch5/`) | Jupiter -> Saturn (hexagon pole pass, rings lesson, ring run shooter, momentum lesson), Uranus, Neptune, Kuiper belt, Space pool game, Pluto, the edge cutscene, fusion lesson; **ends at the edge** (10-07) |
| 6 The Long Trip | `chapter6.html` (`src/space/ch6/`) | **Starts back in the asteroid belt** (10-07): design the ship (design board), find Rock B (rock hunt), build/test the engine (workshop + test-fire cutscene); supply ship docks, meet the crew (2 kids, 2 robots); walk the ship's four Star Trek-style decks, joined by a lift (6 stations: shield, oxygen, water, farm, power, pack list); lesson 6A tiny Earth; Part E: lesson 6B energy (4 films), route planner (10 t then 100 t of fuel, 5 routes, speed far from the Sun), fly it (timing card), fusion drive on, lesson 6C light speed, years to a star, end |
| 7 Toward Tau Ceti (being built) | `chapter7.html` (`src/space/ch7/`) | Full power out of the Sun's family toward Tau Ceti: feel the push, zero-g float game, chemistry and biology room tasks, a holodeck quasar and the lens game, the cruise to 90% of light. See section 8 and `CHAPTER7_PLAN.md` |

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
- `surface.js`, `surface/walker.js`: Moon/Europa walks; `ch6/interior/` (the ship's decks; `ship-lab.html` to look at them)
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

- `npm test`: 15 suites (space physics, space questions, play, science,
  city, ch3 hunt, lessons, ch5 flight, ch5 games, ch6 route, ch6 interior,
  ch6 quests, minimap, flight asks, ch7 chain). Some load modules
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
- Subagents (lead, 10-08): `subagent_type: "haiku-high"` makers AND critics,
  **up to 10 at a time** (lead 10-09), the coordinator (main session) writes the plan and the
  metric. Loop: maker -> critic (checks against the plan's metrics) -> one fix
  round (send it back to the same maker with SendMessage) -> coordinator
  commits and opens the PR. Give each agent only its task, the files it owns
  and the metric; tell it not to commit, stash, `git add -A` or kill by pattern.
- Many open PRs at once: build an integration branch (`claude/check-all`:
  main + every open PR merged) and run `npm test` there before saying a batch
  is ready; base new work on it and say so in the PR body.

## 8. Plan: what is next

**Now: Chapter 7, Toward Tau Ceti** (lead 2026-10-08; full spec, numbers and
metrics in `CHAPTER7_PLAN.md`). Chapter 6 ended at 10% of light; at that
speed Tau Ceti (11.9 light-years, a Sun-like star that may have planets: a
place to look for life one day) would take 119 years, so the fusion drive goes
to full power. Lead decisions: the quasar is a **holodeck** visit (real
quasars are billions of light-years away); **no sleep pods**: the drive
pushes at 1 g for about 1.4 years to **90% of light**, coasts, then flips and
brakes; **no relativity lesson**, only a story line at the end (clocks: about
7.4 years on the ship, 14.4 on Earth); the drive is called pretend in a parent
hint. Mostly inside the ship.
- Part A (WP-A): opening cutscene (full power, the Sun shrinks to a star, a
  star map of the neighbours with Tau Ceti ringed), the bridge star map.
- Part B (WP-B): lesson 7A *How do you know you are speeding up?* (steady
  speed: you can't tell, Galileo's ship; speeding up: the floor comes up to
  meet a dropped ball); drop test at the gentle push (1/100 g, ~4.5 s for 1 m)
  and at full push (1 g, ~0.45 s); a zero-g **float game** in the engine check
  (push off walls, throw a tool backwards to go forwards); a low-g walk gait.
- Part C (WP-C): lessons 7B atoms and 7C tiny life; four room tasks built on
  Chapter 6's recycling: split water (2 H2O -> 2 H2 + O2), the plants' air
  swap (photosynthesis atom count), the recycler's microbes doubling, bones
  in zero g (about 1% a month without exercise).
- Part D (WP-D): the holodeck quasar (shadow, glowing disk, jets, bent
  starlight, Einstein ring), lesson 7D black holes, the game *Where is it
  really?* (a point lens shows a star at theta = (beta + sqrt(beta^2 + 4))/2
  Einstein radii; the kid finds the true place beta = theta - 1/theta).
- Part E (WP-A): the 1 g cruise to 90% of light, the clocks story, the end.
- Built as the scaffold PR #34 (`claude/ch7-scaffold`: page, hooks, chain,
  stubs, `scripts/test-ch7.mjs`) plus four stacked PRs (`claude/ch7-voyage`,
  `-push`, `-science`, `-holodeck`), each maker -> critic -> one fix round.
  Merge order: #22-#33 (fixes), #34, then the four.

**Also now (lead 2026-10-09): chapter cutscenes.** Every chapter gets a story
opening and ending scene that fits its content (Chapters 1-3 only had the
generic camera sweep, title card and confetti; Chapter 6 had no opening):
Ch1 opening and ending, Ch2 opening and ending, Ch3 opening (its ending is the
launch, plus a short arrival in orbit), Ch6 opening (back in the asteroid
belt). Chapter 2 is renamed **Forces and Machines** (was City Engineering),
Chapter 3 **Ready for Lift-off** (was Rocket Village), and the game
**Evolution**.

**Later: genetics and evolution** (lead 2026-10-09; the game's name). Chapters
after Tau Ceti about life itself, built on Chapter 4's lesson 4G (cells, DNA,
proteins) and Chapter 7's tiny-life lesson: genes and inheritance (why
children look like their parents; Mendel's peas: counting traits), mutation
and variation, natural selection (who survives and has young; a game where a
population changes over generations), how all life on Earth shares one
family tree (fossils, common ancestors), and what alien life on a Tau Ceti
planet might share with us or not. Plan it like Chapter 7 (CHAPTERx_PLAN.md
with the numbers, a chain, work packages and metrics) when the lead says go.

After that, from the lead and `PLAN.md`, roughly in order:
1. **A child plays every chapter**: watch where they get stuck.
2. **Real-screen pass** of everything built since 10-06 (none of it was seen
   on a real screen by an agent): Ch6 deck frame rates (ship-lab info())  and cutscenes, the
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

## 11. Mistakes the lead keeps catching (check these before every PR)

Compressed from the lead's play-test reports of 2026-10-02 to 10-08 and the
bugs reviews found in our own PRs. Each line is a rule; the bracket says what
went wrong once.

**Trajectories and orbital mechanics**
- Draw the predicted path as one line joined at each zone crossing, running
  to where a body WILL be, not hung off where it is now [the "weird
  trajectory after every burn" was the drawing, not the maths].
- Near a moon or planet only that body pulls; two-body sums only for
  transfers between systems; the autopilot must plan from wherever she is
  [the Moon never caught the ship; the path ignored the Moon].
- The plan must follow the kid's own burns, and a hand burn must always work
  [Saturn escape plan stayed at 11,000 after she burned to 20,000].
- Physics of the story must be right: don't fly inwards from the edge to
  slingshot (costs more fuel); compare routes by speed far from the Sun
  (energy, not added km/s) [the ship was built at the edge; moved to the belt].
- Sizes and counting: belt rocks always smaller than Ceres; a visit counts in
  any order [rocks half Ceres' size; a Ceres flyby didn't tick].
- Place a ship in a body's frame with circular speed sqrt(gm/r), orbits inside
  half the SOI; time waits in REAL seconds, not warped game time.

**Camera and point of view**
- Gameplay is always from the girl/rocket chase view; only cutscenes cut away
  [automatic top-down camera when leaving Jupiter and Saturn].
- The chase camera stays behind the ship and never loses it (ring run with
  Space held pushed it out of view); left/right must turn the way the arrow says.
- Side map: closed orbit -> that system; escape -> zoom out smoothly to a Sun
  view with the target AND a guessed next stop; odd path -> planets only; no
  moons drawn during an escape; no jumps when the view changes.
- Interior camera: ease its distance, never inside a wall or through a low roof.

**Visual clutter and look**
- Less is more: few streaks/particles/meteors; no belt or Kuiper/Oort ring on
  the horizon while flying; hide the asteroid belt near Jupiter/Saturn; atom
  films show atoms only (no star dots).
- Interiors must look AAA, not "cheap JS boxes": real CC0 kit models mixed
  with code-built hero props, Star Trek flight-deck style, large walkable
  rooms, soft (not over-bright) light, lively robots and crew; keep only the
  models you use [dull room; too-strong light; 180 unused models].
- Story pictures must match the words and scale: the rock is only a thin
  front cap after drilling, the starship is not dwarfed by it; Saturn's
  hexagon looks real.

**Rendering and flicker**
- Bloom threshold is 1.25 linear: only things meant to glow go above it; cap
  anything that can drift over it (ring colour facing the Sun, hull emissive
  plus sunlight made a cross glare in the test fire).
- No flicker: no coplanar faces (polygonOffset or a real gap), no per-frame
  random camera shake, no white flash on every hit [ring run flicker on single
  shots; mining flash].
- Toon materials, not PBR without an environment (too dark). Budget per view:
  <= ~120 draw calls, <= 250k triangles, no per-frame allocations, dispose
  everything.
- Headless checks: grab frames with canvas.toDataURL (page.screenshot times out
  on software GL), and Read every screenshot yourself.

**Pacing, controls and HUD**
- Calm: no question while she steers; after steering stops wait 10-20 s in a
  stable orbit; a "Ready for the next adventure?" button instead of guessed
  waits; let her look round a new planet (Saturn 1 lap/20 s, Uranus 20-30 s,
  Neptune) before asking. One card at a time (a shared queue), never a frozen
  screen with nothing on it.
- Pace: x1 is 0.75 sim s per real s; the autopilot starts OFF.
- Every HUD control is a real clickable button (`.sp-hud *` and `.rv-hud *`
  have pointer-events: none: whitelist new buttons) [auto-turn "not working"
  was an unclickable pill]; time warp Slow/Fast while the autopilot flies;
  folded info boxes; show cargo only when there is cargo.
- Kid-friendly keys: Space fires the engine; arrows stop when released (no
  sliding); walking looks natural (Chapter 1's gait).
- Grown-up mode (`?unlock=all`, never the default) can skip questions, lessons
  and mini-games and jump to any part, in every chapter.

**Games**
- Skill must matter: a do-nothing or hold-one-key player must not win on Hard
  (check with a bot sweep); Easy is winnable by a 6-year-old.
- Clear goals per level, a success moment, fail -> play again, success ->
  choose play again or continue; never a vague message like "Too big".

**Questions and lessons**
- Questions must be intuitive for kids [the "planet in a bathtub" question].
- Both levels everywhere: Level 1 short words and sums a 6-year-old can do;
  made-up numbers say "pretend" [Chapter 5 had no Level 1 questions].
- Re-derive every number from the game's own tables in a test; check units
  and one-way vs round trip [light delay used the reply time; a Level 1 rate
  was 2x wrong; coal 10 vs 20 million; ship 600,000 t vs 1,000 t].
- Fair choices: the right one is never the longest; hints guide but never
  contain the answer; no bare-number choices; no three questions in a row
  (a watch-only film between); no repeats across lessons and banks.
- When the story changes, grep every old word ("rock ship", "inside a rock")
  in questions, lessons, cards and the launcher.

**Engineering and process**
- Never `git add -A` in a worktree (a node_modules symlink reached main);
  add files by name.
- After renaming a constant, grep for the old name everywhere [AP_SLOW froze
  the game when the autopilot came on]; scan changed files for undefined names.
- Guard optional assets (models can fail to load: every kit call behind
  `if (M)`, and a test that builds with no models).
- Many PRs at once: test them merged together (an integration branch) and fix
  the conflicts there first (steps.js between #24 and #25).
- Agents: stop one that loops its report; check what an agent staged before
  committing; they must not create cloud sessions or commit; remove stale
  worktrees when done.
- New lead requests mid-batch go to the next PR; at the end of a batch, audit
  every ask the lead made (DONE / PARTIAL / MISSING with file:line) before
  calling it finished.
