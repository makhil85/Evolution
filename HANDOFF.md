# Rocket Village: handoff

Updated 2026-09-29. Start here, then `PLAN.md` for the list of items (done
and next). Rules for working in this repo (models, folders, sound parked):
`CLAUDE.md`. Everything is committed on `master`.

## The game in one screen

A kids' science game in the browser (Three.js + Vite), two question Levels
(Level 1 = 1st-2nd grade, Level 4 = 4th-6th grade), keyboard and mouse.

| Part | Page / code | State |
|---|---|---|
| Launcher + girl builder | `index.html`, `character.html` (`src/launcher/`, `src/character/`) | Name and build the girl once (wardrobe, face, hair); she appears in every chapter, smiling. |
| Chapter 1 Science Village | `chapter1.html` -> `src/science/` | 3-D, plays end to end at both Levels and all play modes. |
| Chapter 2 City Engineering | `chapter2.html` -> `src/city/` | 3-D, same. Built structures and bridges are solid/walkable. |
| Chapter 3 Rocket Village | `chapter3.html` -> `src/gameScene.js`, `src/game/` | Same. |
| Chapter 4 Voyage to Europa | `chapter4.html` -> `src/space/` | Flight game; plays end to end at Level 4 Easy/Medium/Hard and Level 1. |
| Chapter 5 Rings to a Star | `chapter5.html` -> `src/space/ch5/` (same engine) | Saturn, ring run, ice giants, Space pool, Pluto, the edge, fusion, the rock ship's engine half. Level 4 built; Level 1 not tuned. |
| Play modes (Ch1-3) | `src/play/` | Easy arrow + glow, Medium/Hard mining by E, Hard treasure hunt. |
| Fun moves (Ch1-3) | `src/game/emotes.js`, clips in `src/character/clips.js` | H handstand, J jumping jacks, K dance, L forward roll, U moonwalk, I splits, B back walkover. |
| Chapter openings / endings (Ch1-3) | `src/game/chapterStory.js` | Opening camera sweep + title card (full once per chapter and Level, then a short card); ending with confetti and a "Chapter complete" card with Next. |

Controls (Ch1-3): WASD/arrows move, Shift run, Space jump, E use, M mission
card, mouse drag turns the camera, H/J/K/L/U/I/B fun moves. Chapter 4: W thrust, S
reverse thrust, A/D turn, Shift fine control, Space steady (Easy: auto-aim),
1-4 time warp, E interact/scan, R rewind, C camera, J mission card.

Tests (all must pass before a commit): `node scripts/test-science.mjs`,
`test-city.mjs`, `test-play.mjs`, `test-ch3-hunt.mjs`,
`test-space-physics.mjs`, `test-space-questions.mjs`, and `npx vite build`.
Browser QA helper for Chapters 1-3: `src/lab/qa.js` (`playChapter1/2/3`,
`probeSolids`); Chapter 4 autopilot: see "Testing (the lab)" below.

## Chapter 4 detail (from the 2026-09-28 build session)

Chapter 4 is **built and plays from a fresh save to the end card** in every
flying mode, at both question levels, verified by the autopilot (see Testing).

| Area | State |
|---|---|
| Level 4 (4th grade) Easy / Medium / Hard | Play through end to end, 0 crashes. Hard proven with the cues forced on for the test (players on Hard see no hints). |
| Level 1 (1st grade) | Easy plays through end to end with Level 1 questions and wording. Medium/Hard reuse Level 4 Easy/Medium flight settings (not re-run since the last changes). |
| Questions | 31 per level (25 original + 6 hard maths/pattern ones). Level 1 is an overlay of the same ids. 875 test checks pass. |
| Fuel | Engine 3x more efficient than first tuned: every leg uses well under half a tank. Level 1 Easy has 2x Easy's range. |
| Top-down inset map | Bottom right, always on (N hides, click opens the M map). |
| Orbit transfer panel | Bottom centre on every transfer step, all modes: WHEN (countdown), POINT (dial, degrees off, which key), PUSH (bar filling while W is held). Hard shows the panel but no banner and no auto engine cut-off. |
| Easy transfers | Ship steers itself (no Space); one tap of W starts the booster and it stops itself when the push is done; S stops it early. |
| Touch controls | Tablets (tested at 1024x768 with simulated touch). Not tried on a real device. |
| Sound | Deliberately skipped (lead's call). |

## How to run

- **Desktop shortcut:** `C:\Users\dipal\OneDrive\Desktop\Rocket Village.bat` calls
  `RUN_GAME.bat` in this folder, which starts the Vite dev server on port 5173
  (serves live source, so edits show on reload).
- Chapter menu: `http://localhost:5173/` (all chapters unlocked by "grown-up
  mode": `?unlock=all` / `?unlock=off`, on any page). Difficulty buttons pick
  Level 1 or 4. In grown-up mode every chapter also shows (`src/play/grownUp.js`):
  a **Skip (grown-up)** button on every question, lesson film and Ch5/Ch6
  mini-game card (answers it right, moves on), and a **⏭ Jump** panel (bottom
  left): Ch1-2 teleport to any puzzle/lab/build site plus "Fill my bag";
  Ch3 replays the real quest chain up to the chosen step (`?jumpTo=<id>`);
  Ch4-6 list every mission step by act, and `missions.jumpTo(id)` restarts
  the chapter at it with the ship landed on / in orbit round the body the
  steps before it end at, a full tank and 50 of each build resource.
- Chapter 4 directly: `http://localhost:5173/chapter4.html` (`?touch=1` forces
  the touch pad on a desktop, `?touch=0` hides it).
- Build: `npx vite build`. Tests: `node scripts/test-space-physics.mjs` (23),
  `node scripts/test-space-questions.mjs` (875 checks).

## Saves and settings (localStorage)

- `level4_voyage_europa_v1`: Level 4 save. `level4_voyage_europa_v1_L1`: Level 1 save.
- `rocket_village_profile`: launcher profile; `difficulty: 1` means Level 1.
- `rocket_village_ch4_flight_mode`: easy / medium / hard.
- `rocket_village_lesson_<id>_L<level>`: a Chapters 1-3 lesson was seen (cleared by "Start everything over").
- `ch4_ckpt_<stepId>`: lab checkpoints the autopilot writes at each step (copy
  one into the save key and reload to replay a leg).

## Code map (src/space)

- `contracts.js`: shared constants: bodies, ship (thrust 70, fuelBurn 0.29),
  `FLIGHT_MODES` (Level 4) and `FLIGHT_MODES_L1` (one notch gentler; Level 1
  Easy uses `burnScale: 0.5` for 2x range without a heavier tank).
- `level.js`: `LEVEL`, `IS_LEVEL1`, and `t(level4Text, level1Text)`, used by
  every player-facing string. Keep Level 1 lines short and keep the fixed
  commands (BURN NOW, hold W, Let go, Coast, Too fast): the autopilot matches them.
- `main.js`: loop, camera, cues (the green/orange banners: capture, landing,
  escape, impact, transfer), crash rescue, tow-back, touch pad wiring.
- `transferPlanner.js`: burn planner. Grid search, precise closest pass
  (golden section), target-gravity periapsis, sibling-moon avoidance, capture
  cost in the score, forward-only Jupiter arrival, **ring target** for the belt.
- `gravity.js`: the one gravity model for flight AND path (all chapters):
  inside a planet's zone the planet and all its moving moons pull together
  (the Moon tugs her the whole way from Earth); the Sun alone between planets.
  Any pull under 10% of the home body's is ignored (lead's rule), so low
  Moon/Europa orbits are clean ellipses and the Moon pulls from ~155 u out.
  `setMoonPulls(false)` = Sun + one planet only (Chapter 6 slingshots).
- `physics.js`: flight (frame = dominant body, forces from `gravity.js`), burn computer (`burnBudget`), flight
  assist (spin cap), warp rules (`safeBody` allows warp closer on safe orbits).
- `missions.js` + `acts/act1..5.js`: story steps. A step can have `beat` (its
  question) and `bonusBeats` (extra maths questions at that moment).
- `acts/mining.js`: belt claw and rock markers (only in `MINING_STEPS`).
- `questions.space.js`: Level 4 bank, `LEVEL1_SPACE_QUESTIONS` overlay, `level1Bank()`.
- `hud/`: `transferPanel.js` (orbit transfer help; fed by `xfer` in main.js `updateBurnCue`), `minimap.js` (inset), `touch.js` (touch pad), `markers.js`
  (on-screen markers, layout-thrash fix), `questionModal.js`, `instruments.js`.
- `controls.js`: key state; `press(code, down)` lets the touch pad press keys.
- `surface.js`: Moon and Europa walks.

## Testing (the lab)

In the browser console on `chapter4.html`:

```js
const P = await import('/src/space/lab/playtest.js');
await P.skipIntro();            // fresh save only
await P.autoplay(30);           // flies by the cues for 30 s real time; returns a step log
P.cueLog                        // every banner change with time, fuel, step
window.__space.debugCues = true // force banners on (to test Hard)
const S = await import('/src/space/lab/fullshot.js');
await S.fullShot('name')        // full in-game screenshot (3D + HUD + inset) -> docs/progress/name.png
```

A full run takes ~6-10 autoplay slices. Keep each call under ~30 s (the
browser tool times out at 45 s; the run keeps going in the page).

## Pending

Moved to `PLAN.md` ("Next items"), the one list for the whole game.

## Gotchas learned the hard way

- **Python edits:** `'\b'` in a normal Python string writes a backspace
  character into JS (it happened once, in `lab/fullshot.js`, fixed). Use raw
  strings or the editor. Scan: `grep -rlP '[\x00-\x08]' src`.
- **Bash heredocs** with many quotes and apostrophes break; write long text
  with a file tool instead.
- Question choices must not be bare numbers ("3"): the answer checker reads a
  bare number as a choice index. Use "3 parts".
- Banners are matched by keyword in the autopilot (`playtest.js`): if wording
  changes, keep BURN NOW / hold W / Let go / Coast / On course / Too fast /
  Turn to point, and never start a waiting banner with "BURN NOW".
- The browser pane only renders when visible; tests drive frames with
  `window.__space.debugRun(seconds, dt)`.
- **Lesson films** (`src/lesson/`): the question is asked over the film's
  LAST frame, so nothing may leave the stage at the end and labels/arrows stay
  on. Keep arrows off figures. Look at frames with `window.__lesson.seek()`.
- `src/game/rocket.js` imports `contracts.js`, which reads `import.meta.env`:
  plain node can't import it. Node checks load it through Vite
  (`createServer().ssrLoadModule`, see `scripts/test-lessons.mjs`).
- Chapter 3: `engine.launch()` marks the rocket flown for good. Anything the
  child chooses (the Launch Tuner) must come before it, and only a build that
  reached space may be launched, or the chapter never ends.
- Fuel has mass in the physics (the Mass lesson): for "more fuel" prefer
  `burnScale` / engine efficiency over a bigger tank, or the ship gets sluggish.

## Chapter 2 (City Engineering), 3-D version (2026-09-29)

Plan and design: `CHAPTER2_PLAN.md`. Page `chapter2.html` -> `src/city/main.js`;
the launcher now opens it (the old 2-D files stay in `docs/legacy-chapters/`).

- `src/city/contracts.js` (tile <-> world, 1 old tile = 2.5 units), `layout.js`
  (the old map, 1:1), `rules.js` + `questions.js` (old logic, wording and save
  format; same save keys, so old saves load and `builtFinal` still unlocks
  Chapter 3), `world*.js` (the 3-D town, built by a Sonnet agent), `main.js`
  (girl, controller, camera, E to use, questions, piece-by-piece building).
- Tests: `node scripts/test-city.mjs` (354 checks). Played through at Level 4
  and Level 1 in the browser (all pickups, quests, bridge, crossing, workshop).
- Lab: `city-lab.html` (orbit camera, `?built=all|none`, `?level=1`).
- Test hooks: `window.__city` (rules, world, controller, interact),
  `__cityRun(seconds)`, `__citySetYaw(radians)`; `?reset` wipes the save.
- (The rank chip and marker legend were later turned off for Chapters 1-2 via
  Hud options `rank` / `signpostKey`.) Touch controls not added (lead: not yet).

## Chapter 1 (Science Village), 3-D version (2026-09-29)

Same method and shape as Chapter 2 (`CHAPTER1_PLAN.md`). Page `chapter1.html`
-> `src/science/main.js`; the launcher opens it (old files stay in
`docs/legacy-chapters/`). Modules in `src/science/`: contracts, layout (1:1 map),
rules + questions (old logic/wording/save keys; `built` still unlocks
Chapter 2), world*.js (3-D village), lab/shot.js (in-game screenshots).
Tests: `node scripts/test-science.mjs` (364 checks). Played through: Level 4
smart path (3 boards + labs, locked iron refused, walls and closed gate
block) and Level 1 key path (gate opens, walk into the iron room, rich iron,
brute recipe). Hooks: `window.__science`, `__scienceRun`, `__scienceSetYaw`,
`?reset`. Lab: `science-lab.html`. No touch controls (lead: not yet).

## Session 2026-09-29 (later): girl v2, Chapter 3 refresh, HUD cleanup

- The girl (src/character/girl.js) is version 2: smooth-skinned, slimmer,
  layered face, strand hair, wardrobe (uniform, dress, hoodie, dungarees...),
  shoes, eye colour, freckles, accessories. Preview tool:
  `src/character/lab/shot.js` (girlShot(name, choices, {view, toon})).
  Thin layers (face features, panels, linings, skirts) are left out of the
  toon outline hull. ~45k triangles; frame-time cost below measurement noise.
- Chapter 3: name signs over buildings and the pad (src/game/nameSigns.js),
  one colour per building (structures.js PAINT), test hooks `__gameRun`,
  `__gameSetYaw`, screenshot tool `src/game/lab/shot.js`.
- Chapters 1-2: girl at 1.4 units (townsfolk height), HUD without the rank
  chip and signpost key (Hud options `rank`, `signpostKey`), short board signs.
- Frame times at 1024x768 (in-page, incl. GPU finish): Ch1 ~4-9 ms, Ch2
  ~4-8 ms, Ch3 ~11 ms (145 calls, 446k tris). All under 16.7 ms.

(Open items from this session are tracked in `PLAN.md`.)

## Session 2026-09-29 (evening): smile, fun moves, Chapter 4 time warp

- **Smile:** `girl.js` lip decals lift toward the corners (`SMILE`, `lift()`),
  plus two small smile tucks. Shared girl, so it shows everywhere.
- **Fun moves (Chapters 1-3):** J = jumping jacks, K = dance, L = forward roll.
  Clips in `src/character/clips.js` (`jumpingJacks`, `dance`, `roll`; also on
  the character page's clip buttons). Keys and the roll's forward slide live in
  `src/game/emotes.js`; each chapter wraps its input with `emotes.input()`.
  Jacks/dance stop when she walks (`interruptible` one-shots in `avatar.js`).
  A toast after 9 s tells the player about J/K/L. Blocked while any
  question/card is open. Debug: `window.__science|__city|__game .emotes`.
- **Rig sign gotcha (checked on renders):** she faces +Z. Limbs (hang down):
  NEGATIVE X swings forward; shins fold the knee with POSITIVE X. Hips/spine/
  chest/head (point up): POSITIVE X bends forward. The old comment in `rig.js`
  says the opposite for arms; trust the renders.
- **Chapter 4 time warp (keys 1-4):** on Medium/Hard Earth's 12-radii no-warp
  zone (Hard: ~370 u) covered nearly all of Earth's space, so the keys silently
  did nothing. Now, while the dotted path shows no crash, the body whose pull
  she is in shrinks to 3 radii (`pathClear` in `stepWorld`). The destination
  (`game.target`) and every other moon keep their full zone: shrinking those
  made the autopilot sail past the Moon at x16 and hit Europa at x64. A refused
  warp shows a toast saying why.
- **Missed a moon on a capture step:** she used to fall back round the planet
  with a frozen "BURN NOW" banner. `activeTransferTarget()` in `main.js` now
  runs the normal transfer help back to that moon. Verified: L4 Medium and L4
  Hard autopilot runs reach the end card.

## Session 2026-09-29 (night): blank screen, planner hitch, tidy, two new moves

- **Blank screen, three causes handled:**
  1. *Server stopped.* A server started from inside a Claude tool session dies
     with that session (that is what blanked the game after a "deploy").
     `RUN_GAME.bat` now starts `scripts/serve.bat`, which restarts the server
     if it stops. When deploying from a session, start it detached, e.g.
     PowerShell `Invoke-CimMethod Win32_Process Create` running the Desktop
     shortcut, and do NOT leave the game on a `preview_start` server.
  2. *Lost 3-D picture (GPU reset).* `src/game/contextGuard.js` in all four
     chapters: save, show "The picture needs a moment...", reload to the same
     spot. Tested with `WEBGL_lose_context`.
  3. *File watcher.* `vite.config.js` ignores docs/, *.md, scripts/, dist/:
     editing a note no longer reloads a chapter mid-flight.
- **Planner hitch:** `planTransferSteps()` (generator) in
  `src/space/transferPlanner.js`; `main.js` runs a full search as `planJob`,
  4 ms per frame (`PLAN_SLICE_MS`). Quick and tracking searches use
  `gridCands()` (coarse, then the neighbours of the best 6). Debug:
  `window.__space.prof` = worst ms per part (predict, cue, plan-*, render)
  and where (`at`). Numbers taken with the window hidden overstate render.
- **Tidy:** `docs/progress/` is git-ignored (already-committed shots stay);
  old 2-D chapters live in `docs/legacy-chapters/` (spec only).
- **New moves:** H handstand (the body moves over planted hands; no root
  motion), U moonwalk (controller options `speedScale` / `keepFacing` in
  `src/game/physics.js`; avatar `stop()`).
- **Planner accuracy guard:** the in-window (quick) check deliberately keeps
  the FULL fine grid (it sets the engine cut-off); a run with the coarse grid
  there missed the Moon once. Only tracking uses `gridCands()`.
- **Moon coast cap:** after a correction burn toward a moon, "coast" now waits
  at most 400 s (3000 s kept for trips between planets).
- **Verified this session:** Level 4 Medium autopilot runs reach the end card
  with 0 crashes (last one: 9,039 flight-seconds). Tests and build clean.
  Chapter 1 in-game: H and U work (moonwalk glides 2 u backward in 2 s, no
  turning; W ends it).

### Where the session stopped

- **Item 4 (Level 1 Chapter 4 re-runs) was STARTED, not finished:** a Level 1
  Easy autopilot run had just begun when the session closed; Medium and Hard
  not run. To do it: in the browser, set `rocket_village_profile.difficulty`
  to 1, clear `level4_voyage_europa_v1_L1`, set
  `rocket_village_ch4_flight_mode`, reload `chapter4.html`, then the
  autopilot loop from "Testing (the lab)" until step `a5_end`.
- The game server is NOT running (the test server was stopped at close).
  Start the game with the Desktop shortcut `Rocket Village.bat`.

## Session 2026-09-30: unlock chain, chapter openings/endings, knees, markers, moves

- **Unlock chain (item 3) passed** from an empty browser at Level 4 and Level 1:
  first-run naming box -> builder (`?from=launcher` shows its Done button) ->
  Chapters 1-4 each unlock only after the previous is done; both Levels end
  with "All four chapters finished". Level 1 Chapter 4 Easy flew to the end
  card on the way (part of item 4). Note for scripts: the Chapter 3 QA helper
  can try the launch before the bridge has finished opening (the sealed bank
  puts her back); wait for `village.bridgeOpen`, then retry. Not a game bug.
- **Openings and endings (Chapters 1-3):** `src/game/chapterStory.js`.
  Wiring per chapter: `chasePose()` (the camera's wanted pose), `tick`:
  `if (!story?.update(dt)) updateCamera(dt)`, `await story.intro(...)` after
  load (before the play-mode chooser), `story.outro(...)` when the last goal
  completes (Ch1 Science Center rise end, Ch2 workshop rise end, Ch3 launch
  finished). While active it sets `body[data-play-modal]` (no walking, no E)
  and hides the HUD. "Seen" flags: `rocket_village_seen_ch{n}_L{level}`
  (`SEEN_PREFIX` in `src/launcher/profile.js`; the reset clears them).
  Overlays use timers, not rAF (rAF never fires in a hidden tab). The
  in-game shot tools don't draw these DOM overlays; check them in the DOM.
- **Reset fix:** `resetEverything()` also removes `rocket_village_play_mode`,
  every `<save>_hunt`, and the seen flags.
- **Knees (item 5):** `stridePose` shins and `cheerPose` legs had the old sign
  (knees bent backward); fixed and checked on side renders.
- **Markers (item 8):** `src/space/hud/markers.js` - an on-screen target
  under a HUD panel (padded by the label width) is drawn as an edge arrow.
- **Frame monitor (for item 9):** `src/game/frameMonitor.js`, used by
  Chapter 4: `?fps` or F9, `window.__frames.summary()`. Item 9 itself still
  needs the game on screen (the pane was hidden all session).
- **New moves:** I splits, B back walkover (in place: the clip steps back to
  the start after landing).
- **Game server at close:** the test server was stopped and the game server
  was started detached with `scripts/serve.bat 5173` (no browser window), so
  `http://localhost:5173/` keeps working and the Desktop shortcut reuses it.

## Session 2026-09-30 (later): wing fix, autopilot, two tries, Chapter 3 pre-solved bug

- **Wing fix (Act 1, `a1_satellite_fix`):** `src/space/acts/act1.js`
  `dockAlongside()` holds her 3 u from the satellite until the puzzle starts
  (also on entering the step, e.g. after a reload); the puzzle opens by itself
  after 8 s. `src/space/satellite.js`: turning is a third as fast within 25
  degrees of the Sun, `HOLD_NEEDED` 1.0 s, hint lines in the overlay.
- **Autopilot:** `src/space/autopilot.js` (button `.sp-autopilot`, key P;
  real W/A/S/D/Space/arrows switch it off). Presses keys via
  `controls.press()`; sets `game.debugCues` while on (Hard shows banners).
  Never touches question/fact/dialogue cards; handles only the upgrade bay.
  Test hook `game.autopilot.useFrame(fn)` (the hidden pane draws no frames):
  `useFrame(() => { g.debugRun(1/30, 1/30); return new Promise(r => setTimeout(r, 0)); })`.
- **Two tries, no skipping:** village HUD `src/game/hud.js` (`maxTries`,
  `onOutOfTries`; Close hidden, Escape only after an answer); Chapter 4
  `src/space/hud/questionModal.js` (`MAX_TRIES`, result `failed`),
  `src/space/hud/hud.js` calls `onOutOfTries`. Chapter 4 restart:
  `missions.restartAct()` puts back `<save>_act` (written when the first step
  of each act starts) and reloads. Chapters 1-3: `hud.onOutOfTries` removes the
  chapter save (+ `_hunt`) and reloads; Chapter 3 sets `restarting` so its
  beforeunload save doesn't write it back.
- **Chapter 3 pre-solved bug:** `START_SOLVED` in `src/gameScene.js` is now
  `false` (was `import.meta.env.DEV`; the Desktop shortcut plays on the dev
  server). NOTE for children who already played: their Chapter 3 save may be
  the "solved" one (99%, Press LAUNCH). "Start everything over", or two misses,
  gives them a real start. Test tip: remove a Chapter 3 save with
  `chapter3.html?reset` - deleting the key and reloading doesn't work, the page
  saves again on the way out.

## Session 2026-09-30 (late)

- Launcher remembers finished chapters (`rocket_village_done_ch{n}_L{level}`), so a two-tries restart on a replayed chapter can't re-lock the next one.
- Chapter 2: **Newton's apple tree** (`src/city/newtonTree.js`), on the grass a few metres from her start. E drops an apple (real ½gt² fall and a bounce), then a short conversation: why did it fall down (3 answers, each gets its own reply), young Isaac Newton in his garden, "does Earth pull the Moon too?" (orbit = falling and missing, a nod to Chapter 4), then one gravity question (L4 big vs small apple, L1 which way does it go). It's a bonus: two tries, and a second miss just explains, with no restart. First time gives +1 Science; the flag is `<save>_apple` (cleared by reset and by the chapter restart). Mission card shows a "Bonus: apple tree" line until it's heard. Trunk is solid.
- Frame monitor (`?fps` / F9) is now in Chapters 1-3 too. The real-screen check (PLAN item 9) still needs the game on a visible screen: the Claude browser pane is hidden, so it draws 0 frames.
- **Mining tools + haul chain** (`src/play/tools.js`, Chapters 1-3). Each E on a resource puts a tool in her right hand (`handR` bone) and plays the new `chop` clip facing the resource: axe for wood, pickaxe for stone/gems, hammer for iron/metal, wrench for energy/fuel/circuits. Science gets a magnifying glass and the new `inspect` clip. Blueprints get no tool. On collect, 3-6 copies of the resource's icon fly in an arc into its Supplies cell (`hud.resourceCell(key)`), and the cell pulses as each one lands (skipped with reduced motion or a hidden panel). Chapter 3 Easy (walk-over pickup) gets the chain but no swing (`Pickups.onCollect`). The tool is tilted 1.05 rad in the grip, so the head comes down on the strike (checked with bone positions: overhead on the wind-up, forward-down at the hit).

## Session 2026-10-01: autopilot at real-screen pace, fun moves in space, cheers

- **Autopilot stalls (lead: "doesn't take us to the next destination on Easy/Medium").** The lab tests drove it with `debugRun` from a timer, which runs far more sim time per second than a real screen, so real-time waits never showed. Re-tested at real pace (`useFrame(() => { g.debugRun(1/60, 1/60); frames++ })`, real seconds = frames/60). Found and fixed:
  1. The game dropped warp to 1x 45 s before every burn window; now skipped while the autopilot flies, and the autopilot paces the warp from the countdown (>120 s x64, >30 x16, >5 x4, then 1x).
  2. No-warp zones (Jupiter's moons: 400 u each) made it coast in real time for minutes. `stepWorld(..., { autopilot })` now allows x16 in the wide zones and x4 within 3 radii while the predicted path is clear.
  3. Medium steering damped her own spin, not the spin relative to the turning prograde aim, so she trailed about 15 degrees behind and "steering" kept the warp off. It now damps relative to the aim's turn rate.
  4. Keys are re-pressed every frame (focus loss or a card clears the game's held keys).
  5. No "time warp is off" toasts while it flies.
  Real-pace results: Easy, Jupiter orbit to landing on Europa in 34 s; Medium, satellite meet-up to Moon landing 80 s, Moon liftoff to the Mars burn about 35 s.
- **Fun moves on the Moon/Europa walks:** K dance, I splits, B back walkover (`surface.js` `FUN_KEYS`; `walker.playOneShot(name, { soft: true })`, which walking or a jump ends). A hint after 8 s of walking.
- **Right answers (Chapters 1-3):** `hud.onCorrect` makes her cheer, with 1.8 s of confetti (`confetti` exported from chapterStory.js).

## Session 2026-10-02: Easy flies itself, Medium slow motion, smaller side panels

- **Easy = autopilot flies** (`autopilot.js` `easyAuto`): *(superseded 2026-10-05: it no longer switches itself on - see the pace/freeze session below)* on Easy it does every flight task: burns, captures, landings, mining, the bay and the satellite wing repair. The Moon and Europa walks stay hers. Her flying keys don't turn it off on Easy. P once hands over the walks too (full autopilot); P again turns it off for the session (`userOff`).
- **Banner narrates while the autopilot flies** (`narrate()` in main.js): "Autopilot: firing the engine!", "engine off. Coasting.", "braking for a gentle landing.", countdowns without "keys 1 to 4" or "point" orders. The raw order is kept in `burnCue.dataset.raw`; the autopilot, realpace.js and anything else steering by the banner must read that.
- **Medium slow motion** (`SLOW_MO` 0.4, `slowMoNow()`): the last 3 s before a burn window, the burn ("BURN NOW") and "Let go of W" run at 0.4x, with a turtle on the banner. Medium only, never while the autopilot flies. Measured: 0.2 s of game time per 0.5 s.
- **Side panels** (hud.css end): instruments and the mission card at `--hud-scale: 1` (rest of the HUD 1.3), 190/236 px wide (178/224 under 1366 px).
- **Real-pace autopilot runs to the end card** (`src/space/lab/realpace.js`): L4 Medium; L4 Hard 7.7 min; L1 Medium 6.6 min; L1 Hard 9.2 min (L4 Easy legs earlier). Chapter 3 Medium mining swing checked (3 presses, axe each time, 3 icons fly).
- The autopilot's frame wait has a 250 ms timer fallback (a hidden tab draws no frames; a wait begun there hung the loop).

## Session 2026-10-03/04: satellite, flight school, landing, calmer HUD (branch feature/satellite-lesson, merged)

Built in a lab copy (git worktree `.claude/worktrees/sat`, own server on port 5174, own deps cache `.vite-lab`; vite.config's `.claude` watch-ignore is relative so the copy watches its own files) by opus-medium builders, a critic round and a final check round.
- **Satellite** (`satellite.js` `satelliteRig`, act1/act2): docking camera + creep-in, thin Starlink-like model with a dark array, attaches on the ship's back after `panelFixed` (0.55 scale), charges fuel while coasting (540 s from empty, stops at 80%), released into Moon orbit after `a2_capture` (or at liftoff after a touchdown-capture). Save field `satellite`.
- **Flight school** (`src/space/lesson/`, step `a1_lesson` between `a1_satellite_fix` and `a1_raise`): 4 canvas films + a question each (two tries, no restart), reading-paced captions, pause. Test hook `window.__space.lesson`, right answers `data-correct="1"`.
- **Saves restore by step id** (`missions.js` resolveStepIndex); saves without one at or past index 5 are shifted +1.
- **Landing**: safe touchdown speed raised (Easy 2.5x, Medium 1.35x); "Getting fast" heads-up with hysteresis; no thrust on the ground except liftoff steps, banner cleared when a walk starts, no rewind while landed; smoother climb-down (walker bones reset to rest each frame). **Aim dial** `hud/aimDial.js`: POINT BACKWARDS (L1 "Face the way you came"), grey motion arrow, green target matching the green 3-D chevron (its tip pointed back at the ship before: `rotateX(+PI/2)`).
- **HUD**: side panels `--hud-scale: 0.85`; focus mode (`hud.setFocus`, `.is-focus`) while she must act; toasts spaced 1.5 s, stretched lifetimes, held during focus (warnings pass), dropped after 8 s; planet labels avoid the banner; banner swaps to a different message at most every 0.7 s (data-raw never held back); slow-motion chip.
- **No spinning under warp**: auto-aim off and camera yaw held while `warpIndex > 0`; gentler camera on the autopilot. **Z / X side thrusters** (`SIDE_THRUST` 0.1 of the engine).
- Known/open: the lesson is long (~4-5 min); a Medium child pulsing W may still see capture lines alternate (now at most every 0.7 s); L4 "backwards" wording varies slightly between banner and dial.
- **2026-10-04: auto-steered landings + warp only for long waits.** Easy and Medium landings: while the landing guidance is up (`landSteerOn()`, set by `updateLandingCue`), the ship keeps itself pointed backwards with the Easy P-controller (until she touches A/D herself) and the banner just says hold W. Checked: a Medium Moon landing from low orbit pressing only W landed in ~5 s. The time-warp panel shows only when `waitAhead()` (next burn window or closest approach) is over 100 s, or warp is on; the warp hints in the banner, transfer panel and aim dial use the same 100 s. Keys 1-4 always work.

## Session 2026-10-05: steady transfers, Retry, auto-turn, belt polish, play-test fixes

- **Steady transfers** (`transferPlanner.js`, `predictor.js`, new `pathFrames.js`): fixed sim-time search grid, lap-average span, 8 s lead, margin from band edges, exact-burn tracking; dots on fixed sim times; the path stays in her frame across zone exits; a faint gold planned path. Lab tools `scripts/_lab_*.mjs`, `src/space/lab/xferwatch.js`.
- **Retry** (`src/space/retry.js`, `missions.retryFromCheckpoint`, save copy `<save>_ckpt` after every question): "↺ Retry" button (bottom right above the minimap) and Esc → pause menu → "Try again from my last question". The pause menu's Flying-mode button had been misplaced into showEnd (Esc threw): fixed.
- **Auto-turn toggle** (`src/space/aimToggle.js`, T): `game.manualAim` stops Easy auto-aim and the landing auto-steer.
- **Landings (Easy/Medium)**: the engine only brakes and only down to 60% of the safe speed (holding W the whole way: Moon landing 8.4 s, 0.5 t; it used to hover for minutes); no "Ease off W" there.
- **Belt polish** (PLAN 11): rocks break apart, pieces fly into the ship and a MINED tally (`hud/tally.js`, needed for the next build), U / button opens the upgrade bay, clickable warp pips, build animation (`beltFx.js`); white flash on every mine fixed.
- **Play-test fixes**: end card shows real minutes (`game.stats.played`) plus "Days in space"; chooser blurbs describe the new Easy/Medium; the transfer panel narrates while the autopilot flies; radiation warning knows about a built shield; two premature story toasts reworded; repeated toasts within 10 s dropped.
- **Open from the play-test**: one Medium countdown jump of 778 s (a2_coast) and dv sign flips after the Europa burn; long waits on Easy (x256 for the autopilot?); minimap green wedge during the Moon landing and the minimap above the pause dim; labels over the banner at times; Europa walk camera (drill hides her, Jupiter not in view); 1024x768 rock-chip clutter; possible frame cost at x64 (check with ?fps on a real screen).

## Session 2026-10-05 (later): steady plans, calm screens in every chapter

- **Chapter 4 flight** (flight agent): no burns planned past a dip into another zone (`clearUntil`), the 8 s lead counted from now (`clock`), quick re-checks never later than the window (`maxTau`), stale searches dropped (`sameCoast`); closest pass = first pass through the target zone (Europa flips gone); autopilot-only x256 cruise warp in the Sun's pull (`AUTOPILOT_WARP`); cheaper high-warp frames (fewer predictor/coast refreshes, zone search skipped when provably out of reach, 1,200-step cap). Medium real-pace run: 0 plan jumps on a2_coast / a3_depart / a4_europa_orbit. a3_depart shows no burn window until the shield is built. Lab: `src/space/lab/labrun.js`, `game.planLog`.
- **Chapter 4 screen** (screen agent + main): the "minimap wedge" was the 3-D aim arrow (now kept small and in view); labels avoid every panel/banner/button (`markers.js` keep-out boxes); rock markers: nearest needed of each kind, max 4; Europa walk frames Jupiter on its line, drill fades when it hides her, icy ground; pause menu centred; the one-line banner now sits bottom centre and hides under the bottom panels (`bottomPanelUp`, cached 4x/s); the autopilot reads `burnCue.dataset.raw` even while hidden.
- **Chapters 1-3 + launcher** (theme agent): calm toasts like Chapter 4 (2 visible, 1.5 s apart, 5 s min, stale 8 s, dupes 10 s, held during cards); focus during question cards; slim top row; smaller side panels (`--side-scale`); one font stack everywhere; shorter pickup/answer/mission lines (rules-module strings pinned by tests unchanged; shortened where shown). Lab: `src/lab/shot.js`, `src/lab/themeShots.js`.

## Session 2026-10-05 (evening): lessons in Chapters 1-3, Launch Tuner

- **Lesson engine** (`src/lesson/card.js`, `draw.js`): the "watch, answer, try it" card of `LESSONS_PLAN.md` for Chapters 1-3. Films draw on a fixed 800x450 stage (letterboxed); captions hold until read (1.5 s + 0.35 s a word, x1.5 at Level 1) and the picture slows to match; two tries, no restart; opens in the play-mode modal layer (input locked). Seen once per Level (`rocket_village_lesson_<id>_L<n>`). Test hook `window.__lesson` (state, next, answerAll, skip, film, seek, shot). Flight School (Chapter 4) is not ported onto it yet.
- **Lessons** (`src/lesson/lessons/ch1.js`, `ch2.js`, `ch3.js`): 1A round Earth (before the first Science Lab), 1B Eratosthenes (at the foundation once she can build), 2A triangles (Bridge Builder), 2B Archimedes (water quest), 3A push back (Engine Thrust), 3B heavy rockets (Heavy or Light? / Mass on the Pad, else before the Launch Tuner). After a lesson the same E opens the real quest.
- **Launch Tuner** (`src/game/launchTuner.js`): before the real launch she picks 1-8 tanks and a nose, test-flies on the real sim (climbs drawn together, the sim's verdict), and "Launch for real" arms once that build reached 100 km. Easy starts on 5 tanks + pointed; Medium/Hard on 2 + flat; Hard has a star challenge (>125 km in 3 tests). The launch flies her build. Hook `window.__tuner` (set, test, launch, close, state).
- Tests: `scripts/test-lessons.mjs` (in `npm test`). Browser: every film looked at (start, middle, end, question) at Level 4 and Level 1; each chapter's hook played through in the game.
- Not done yet: lessons 3C-3E and Chapter 4's 4B-4F (the replay list and the Flight School port came later the same day).

## Session 2026-10-05 (night): Chapter 4 biology lesson

- **4G "What makes something alive?"** (`src/lesson/lessons/ch4.js`), Chapter 4's second lesson: cells (lens zoom into a leaf, a cell splits), DNA (rotating helix, A/T/G/C, unzips and copies), proteins (a builder strings beads from the recipe, the chain folds and chomps sugar). New step `a5_lesson` in `acts/act5.js` between landing on Europa and the drill; once per Level. It uses the `src/lesson/` card (play-mode layer), not Chapter 4's HUD modal; `lab/playtest.js clear()` answers it via `window.__lesson.answerAll()`.
- Lead's rule: 2 lessons per chapter, each carried by animation. 3C waits.

## Session 2026-10-05 (late night): Lessons replay, Level 1 clues and reading, Flight School port, girl or boy

- **Flight School on the lesson card** (`src/lesson/lessons/flightSchool.js`, lesson `ch4_flight_school`): the four transfer films of `src/space/lesson/transferScenes.js` adapted to beats (each caption is a beat; `drawFrame` is reused as is). `transferLesson.js` is gone. Chapter 4 plays lessons with `lessonOnce(lesson, { bus: game.bus })`: the `bus` option emits `ui-modal` true/false so the space game pauses (Chapter 4 does not read `body.dataset.playModal`).
- **Level 1 clues**: every film has `clue: [null, '...']` (Level 1 only, at most 18 words). It shows in a strip under the picture from `clueAt` (default: the last beat) and again above the question. The animation is unchanged; the clue writes the answer in words.
- **📖 Lessons list** on the launcher (`src/lesson/index.js` LESSON_LIST, `launcher/main.js` renderLessons): all 8 lessons by chapter; a lesson is open once its chapter is open or it was seen (✓). Changing the Level now reloads the launcher, because `LEVEL` is read once per page.
- **Girl or boy** (`src/launcher/hero.js`): the first choice on a fresh start (naming form, `profile.hero`), also first on the character page (`BOY_LOOK` preset). The hero is built once and is the same in every chapter. Text was written about a girl: `heroText()` and `heroQuestion()` swap she/her for he/him/his, but only in text about the hero (bank questions that mention Zara).
- **Level 1 reading** (`scripts/check-reading.mjs`, `npm run reading`): reads every Level 1 line (banks at Level 1, `t()`/`two()`/`L()` second sides, `[l4, l1]` lesson pairs, `level === 1 ?` / `IS_L1 ?` branches) and lists lines with more than 14 words in a sentence, a 3+ syllable word not on its easy list, or Flesch-Kincaid above grade 3. 1660 lines -> about 28 left, all just over the line or names. Chapter 3's step text at Level 1 lives in `src/game/quests.level1.js` (an overlay; ids and costs stay in `quests.js`).
- Fixed on the way: six Chapter 3 Level 1 questions showed the Level 4 picture (`bonus_ratio`, `rocket_guidance`, `bonus_place_value`, `bonus_volume`, `bonus_division`, `bonus_angle`); Chapter 4 `inverse_square` too.

## Session 2026-10-05 (Chapter 5 build): Rings to a Star

Design: `CHAPTER5_PLAN.md` (steps and checks) and the lead's Claude doc linked there. Level 4 first; Level 1 text is there but not tuned.

- **Page and engine**: `chapter5.html` runs the Chapter 4 space engine; `src/space/chapter.js` (`IS_CH5`) picks the mission chain (`src/space/ch5/steps.js` = partA + partB + partC + partD), save keys (`level5_rings_to_a_star_v1`, `_L1`), the start (Jupiter orbit) and the opening. Launcher card locked until Chapter 4 is done.
- **Flight**: Saturn, Uranus and Neptune are orbit stops (flybys in this squeezed solar system gave huge slingshots). `ch5/lineup.js` `lineUpOnce` moves the next planet as she sets off, so a window opens soon; the phases go into the save. Pluto is Chapter 5 only (`contracts.js`), a fly-past. Kuiper belt points (`ch5/kuiper.js`).
- **Mini-games** (2-D ones open in the play-mode layer and pause space with bus `ui-modal`):
  - Ring run (`ringRun.js` scene + `ringRunLogic.js` rules): chase cam through Saturn's rings, Easy/Medium/Hard, blast ice for water, dodge boulders (shots bounce off them), recoil. `debug.auto` plays itself.
  - Space pool (`pool.js` + `poolLogic.js`): 4 momentum levels in the Kuiper belt. Hook `window.__pool`.
  - Design the ship (`designBoard.js`): 4 choice questions + the fuel sum (600 t); the blueprint grows with each answer. Hook `__design`.
  - Rock hunt (`rockHunt.js`): scan 4 rocks against 5 checks; only Rock B passes; a wrong pick says why. Hook `__hunt`.
  - Workshop (`workshop.js`): mine, make fuel, print rings, fit, test fire. Hook `__workshop`.
- **Cutscenes**: opening (`ch5/opening.js`), Saturn pole hexagon (`saturnPole.js`), the edge pull-back with the heliosphere and Voyager (`edge.js`), the ending (`ending.js`): she flies into the rock ship, the magnet rings light, the engine fires, then "Coming next: Chapter 6". The end card says "To be continued".
- **Lessons** (`src/lesson/lessons/ch5.js`, `ch5b.js`, `ch5c.js`): 5A rings, 5AA momentum (5 films, predict pauses, one watch-only film), 5B Neptune, 5C atoms and fusion (2 zoom paths, protons smash, coal Sun). The lesson card gained `predict` beats (pause, "Show me") and `watchOnly` films.
- **Questions**: `ch5/questions.ch5.js` (beats in each step).
- **Tests**: `scripts/test-ch5-flight.mjs` (every leg, line-ups, Pluto pass), `scripts/test-ch5-games.mjs` (ring run, pool, design, rock hunt, workshop rules); both in `npm test`. `lab/playtest.js clear()` plays the Chapter 5 cards and lets `debug.auto` scenes play.
- **Browser checks done**: each part jumped to with `__space.missions.jump(id)` and screenshotted (ring run, lessons, pool, edge, design, hunt, workshop, ending, end card); a Part B autopilot run Saturn -> fusion lesson.
- **Gotchas**: a cutscene with `calm: true` on `game.cinematic` turns off the speed dust and warp streaks (all Chapter 5 cutscenes set it; Chapter 4's do not). Far out (`camera.far` 1e8) a point's projected depth can round past 1, so "is it on screen" checks use the camera direction, not `v.z < 1` (`edge.js`). Editing an imported src file while a browser test runs reloads the page and spoils the test.
- **Not done**: Level 1 pass for Chapter 5 text; a child playing it; Chapter 6.

## Session 2026-10-05 (Chapter 4 pace, paths, freeze)

Lead playtest of Chapter 4: "the pace looks too fast - 1x has to become 0.5 or
0.75x", "after each burn it's showing very weird trajectory paths... the Moon
is not catching the ship", "add a freeze button in chapters 4, 5, 6",
"chapter 4 starts with autopilot on - turn it off as a default but keep the
steering on, and let the user go to higher warp speed".

- **The dotted line no longer tears** (`pathFrames.js`). This was the whole
  "weird trajectories" report, and it was the DRAWING, not the maths: the
  predictor already agrees with actual stepping to 0.15% (test 3a) and the
  Moon's pull is in both. Each stretch of the line used to hang off its own
  body's CURRENT position, so a path from Earth orbit to the Moon was drawn as
  an Earth ellipse plus a loop round where the Moon is NOW, while she arrives
  where the Moon WILL BE - a 380 u break in a 500 u system, swinging about as
  the Moon went round (and thousands of units leaving Earth for Mars). Now
  every stretch is joined at the exact crossing time, so it is one unbroken
  line that runs to where the body will be - the same place the "where the
  target will be" ghost marks - and once she is inside a body's pull the loop
  is drawn round the body itself, as before. Measured: the worst gap at a
  hand-over went from 321x the dots either side to 4.9x. (Leaving a body was
  already joined this way since 10-04; arriving at one was not.) Guarded by
  `scripts/test-space-physics.mjs` test 3c; the before/after lab tool is
  `scripts/_lab_path_draw.mjs`. Watch out for `pos()`: it hands back one
  shared scratch object, so read the first position before asking for the
  second.
- **x1 is 0.75 sim seconds per real second** (`FLIGHT_PACE` in main.js). Warp
  multiplies it, so "x4" is still four times normal flight. Fuel and gravity
  are per sim second, so nothing is easier or harder - only calmer.
- **Freeze (F or the button)** (`src/space/freeze.js`, `game.frozen`): stops
  the ship, the planets and the clock where they are, with a cold edge round
  the view, until F again. Top-centre stack is now Autopilot (12px), Freeze
  (52px), Auto-turn (92px). Hidden during cutscenes, walks, cards and
  mini-games (those hold the game already); the autopilot waits while frozen.
  Chapters 4, 5 and 6 all get it from the shared engine.
- **Checked in the browser** (Chapter 4, Level 4, Easy, three boots): it boots
  with the autopilot off and the three top-centre buttons stacked right; flown
  from Earth orbit through the Moon burn window by the on-screen cue alone
  (hold W when it says), the dotted path reached the Moon (closest 77 u) and
  the step moved on to "Coast to the Moon"; the drawn line measured live while
  flying - gaps even, no tear; Freeze correctly refuses while a question card
  is up. No page errors. NOT yet checked on a screen: the hand-over frame into
  the Moon's pull (measured in node instead, test 3c), the freeze/thaw and
  pace numbers at a quiet moment (every attempt landed while a question card
  was open, which pauses the game anyway), Medium and Hard, Chapter 5.
- **The autopilot starts OFF, in every mode** (`autopilot.js`): Easy keeps its
  steering help (the ship points itself, landings steer themselves, one tap of
  W runs a cued burn), and the warp is hers - nothing asks for x16/x64 by
  itself any more, and the autopilot's own x256 cruise only happens while it
  is flying. P (or the button) cycles: off -> flies, walks hers -> full
  autopilot -> off. The Easy blurbs in `contracts.js` say so, and H lists F
  and P.

## Session 2026-10-06 (Chapter 6 build): The Long Trip

Design: `CHAPTER6_PLAN.md` (steps, checks, Part E detail and numbers) and
the Claude doc linked there. Level 4 first; Level 1
lines are in place but not tuned.

- **Page and engine**: `chapter6.html`; `chapter.js` `IS_CH6`, and `OUTER`
  for what Chapters 5 and 6 share (Pluto, cruise warp, long windows, Kuiper
  belt). Own save keys (`level6_long_trip_v1`, `_L1`), start (Sun orbit at
  62,000 u, by Rock B), act titles (`ch6/start.js`), question bank (Part B +
  Part E, Level 1 overlays), moons off (`setMoonPulls(false)`). Launcher card
  6, locked until Chapter 5 is done.
- **Chain** (`ch6/steps.js`): `c6_meet_crew` (Part A) -> `c6_habitat` (Part
  B) -> `c6_lesson_tiny_earth` (6A) -> Part E (`c6_plan_route`,
  `c6_lesson_slingshot`, `c6_fly_slingshots`, `c6_drive_on`,
  `c6_lesson_light`, `c6_star_trip`, `c6_end`). She never flies freely in
  Chapter 6: the slingshots are 2-D cards (the lead OK'd that; flybys in the
  squeezed solar system fling the ship).
- **Crew**: `ch6/crewInfo.js` (names, jobs, colours): Mira the biologist and
  Theo the doctor (kids, the hero's rig in their own looks), Bolt the builder
  bot, Echo the signal bot (`ch6/crew.js`).
- **Opening** (`ch6/opening.js`): Rock B hangs beside her ship
  (`showRockB`, for the whole chapter); the supply ship docks at its hangar
  door; title.
- **Habitat** (`ch6/habitat.js`, a runScene walk; the walker's `gait:
  'earth'` - no Moon lope, firm footing, the walk clip timed like the
  villages'): round hall
  inside the rock, power core, six stations, bunks, the crew at their
  stations, beacon on the next. Test hook `game.activeScene.debug`
  (`goTo(id)`, `pressE()`). Station progress is kept in
  `rocket_village_ch6_stations_L<level>` (a reload or a two-miss restart
  does not redo finished stations).
- **Stations** (`ch6/stationsLogic.js` rules, `ch6/stations.js` cards, hook
  `window.__station`): shield (each metre halves the rays), oxygen (6 lamps +
  2 splitter steps is the one mix), water (grit -> algae -> UV; 98%, 500
  days), farm (10-12 m²), power (1/3, 1/4, 1/6, 1/4 of 12), pack list (8.8 t
  of needs under 10 t). A question after each (`ch6/questions.partB.js`).
- **Part E**: see `CHAPTER6_PLAN.md` (route planner `window.__route`,
  slingshot card `window.__sling`, drive-on cutscene, lessons 6B/6C).
- **Tests**: `scripts/test-ch6-route.mjs` in `npm test` (ten suites):
  routes, timing, stations, both question banks re-derived from the tables,
  the whole chain, lessons 6B/6C (6A is in `test-lessons.mjs`).
- **Browser checks done**: fresh boot -> opening frames -> crew dialogue ->
  habitat -> shield station (E, card, solve, question) -> every other card;
  Part E planner, a slingshot leg pressed by hand, the drive-on cutscene; no
  page errors.
- **Gotchas**: the habitat's rock wall and dome are seen from inside, so
  they need `side: BackSide`; the walker's spacesuit parts (helmet, collar
  ring, pack) are hidden indoors. `pgrep -f vite` matches its own command
  line (pitfall 6): check the server with curl instead.
- **Not done**: a child playing it; Level 1 tuning; a real-screen pass
  (frame rate in the habitat, the cutscenes).

## Session 2026-10-07: grown-up skip/jump, habitat walk, held keys

- **Grown-up tools** (unlock mode only): see "How to run". Skip goes through
  each card's own grading/solve path, so saves and rewards are the same as
  a right answer.
- **Held keys** (`src/game/heldKeys.js`, Ch1-3 input and the space
  controls): a Set-shaped tracker that also lets go on blur / hidden tab /
  pagehide, and drops the auto-repeating key once its repeats go quiet for
  450 ms (a lost keyup used to leave her walking on her own). Only the last
  key pressed is watched, because only it repeats (hold Up + tap Right).
  The long slide the lead saw in Chapter 1 did not reproduce in headless
  Chromium (she stops in ~0.4 s there), so this guards the lost-keyup cause;
  re-check on the lead's PC.
- **Ch6 habitat walk**: `createWalker({ gait: 'earth' })` - 3.2 m/s walk,
  5.5 run, exponential grip like `game/physics.js`, clip rate = speed / ref
  (clamped 0.6-1.5) like `game/avatar.js`.

## Session 2026-10-07 (b): Ch4 pacing, catch zone, goals

- **Calm before questions** (`CALM_S` = 5 s, contracts.js): a step with a
  `check()` ticks itself off on the mission card, then waits 5 s of unpaused
  game time before its beat question (`step.calm` overrides). Ch6 stations
  use `missions.ask(beat, { calm })`. The timer also runs while a walk
  scene is up (`missions.tickCalm`).
- **Next goal**: `hud.announce(title, text)` shows a banner for ~6.5 s on
  every task step ("Next goal: fly to Mars" + the objective). The next
  target's marker is `kind: 'goal'`: a bigger pulsing box and "Next: Mars".
- **Catch zone** (`src/space/catchZone.js`, Easy and Medium only): a
  blinking ring round the step's capture/transfer body (about 100 u at
  Mars; Jupiter 1500 u, settling at 1400 u between Ganymede and Callisto,
  clear of the radiation belt; Saturn settles outside its rings). Fly into
  it: a circular orbit at once, then a glide down to the low orbit (2.2 R).
  Hard keeps the real capture burn and flybys.
- **Act 1**: two laps before the sunrise ("16") question; new step
  `a1_ride` (one lap with the satellite) before flight school. The panel
  puzzle is now a game: both panels swing (slower on Easy), hold ←/A for
  the top one and →/D for the bottom one while each gets > 80% light.
- **Act 2**: `a2_capture` (get in orbit) -> new `a2_circle` (one lap round
  the Moon, then the moonOrbit question) -> `a2_land`. A "Landed on X!"
  card covers the surface walk's build (acts/util.js loadSurfaceScene).
  The Moon-escape question `moon_escape` (beat `moonEscape`) replaces the
  slingshot one. Leaving Earth uses the top-down escape view, wide enough
  to show Mars.
- **Act 3**: `a3_mars_scan` is now an orbit (capture: 'mars'), then the
  question. Visiting Ceres any time in the belt ticks "Visit Ceres" off
  (`step.doneEarly`) and asks the dwarf-planet question there. Belt rocks
  are much smaller (near rocks 1.6-5.2 u across, scenery under 1/2 Ceres).
- HUD right column starts at 46 px (the Chapters button hid Autopilot).
  Turning hints say ← / → first. Zero-g scene: she lifts only a little.
- Ch2 lesson 2A truss film: green sides go red near the truck, blue joints.
