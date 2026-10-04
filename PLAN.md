# Rocket Village: the plan (items)

The one list of work items for the whole game: what is done, what is next.
Updated 2026-09-29 (last commit `7da5811` plus the handoff commit). How to
run, test and find things: `HANDOFF.md`. Per-feature designs:
`CHAPTER1_PLAN.md`, `CHAPTER2_PLAN.md`, `CHAPTER4_PLAN.md`,
`PLAYMODES_PLAN.md`. The original Chapter 3 build plan is kept below as
history.

## Standing decisions (lead)

- Main session Opus 5.5; subagents Sonnet 5.5, few at a time (`CLAUDE.md`).
- Keyboard and mouse only for now: **no touch screen or tablet work yet.**
- Sound is parked.
- Play the game from the Desktop shortcut `Rocket Village.bat` (runs
  `RUN_GAME.bat`; live source, so a commit is a deploy).

## Next items (suggested order)

| # | Item | Why / notes | Size |
|---|---|---|---|
| 1 | A child plays it | Nothing replaces a real 2nd-grader and 5th-grader at the keyboard: watch where they get stuck (clues, transfer burns, controls). | lead |
| 2 | Review the Hard clue wording | Level 1 (2nd grade) and Level 4 (5th-6th grade) treasure-hunt clues: `src/science/hunt.js`, `src/city/hunt.js`, `src/game/hunt.js`. Lead to say which are too easy or too hard. | lead + S |
| 4 | Level 1 Chapter 4 re-runs | Level 1 **Easy passed** (09-30, during the unlock-chain check). Medium and Hard still to run. How: `HANDOFF.md`, "Where the session stopped". | S |
| 9 | Real-screen frame check | **Needs the game on screen** (the Browser pane stayed hidden all session: 0 frames drawn). Open `chapter4.html?fps` (or press F9): a live frame graph shows the worst frames and where they happened (step, time warp). Fly at 1x and x64 and look for red bars / a blank moment. Scripted: `window.__frames.summary()`. | S |
| 11 | Asteroid belt polish (lead, 2026-10-04) - DONE 10-05, see HANDOFF | (a) After mining, when the cargo bay is full, there is no button to open the upgrade bay: add a visible one. (b) The time-warp pips in the side panel should be clickable (x1 / x4 / x16 / x64). (c) An animation when an upgrade is built. (d) Mining: the asteroid breaks apart on E and its pieces fly into the ship / onto the cargo tally, like the mining chain in Chapters 1-3 (`src/play/tools.js` `flyToSupplies`). (e) A mined tally like Level 1: a box on the right listing what was mined and how much (silicon, metal, ice), and how much is still needed for the fuel refill and the new solar panels (wings), with the broken ore pieces flying into it. Files: `src/space/acts/mining.js`, `belt.js`, `hud/instruments.js`, `hud/overlays.js` (`openUpgrades`). | M |
| 12 | Teaching lessons in every chapter (lead, 2026-10-05; planned, not started) | "Watch, answer, try it" lessons like Chapter 4's Flight School, for Chapters 1-4: shared engine first, then 2-3 lessons per chapter. Full plan: `LESSONS_PLAN.md`. | L |
| - | Parked | Touch controls and tablets (Ch1-3 have none; Ch4 has a simulated-only pad), phone layout, pinch zoom, sound, NASA Europa texture. | - |

## Done (most recent first)

| Date | Item |
|---|---|
| 10-01 | Fun moves on the Moon and Europa walks (was item 6): K dance, I splits, B back walkover (J and H are the mission card and help in Chapter 4); walking or a jump ends them; a hint after 8 s of walking. |
| 09-30 | Mining tools (axe, pickaxe, hammer, wrench, magnifying glass) and the haul flying into the Supplies panel, Chapters 1-3. Chapter 2: Newton's apple tree side story with a gravity question. Launcher remembers finished chapters (a restart can't re-lock the next). Frame monitor in every chapter. |
| 09-30 | **Chapter 3 no longer opens pre-solved.** `START_SOLVED` was on whenever the game ran on the dev server - which is how the Desktop shortcut runs it - so every visit wiped the child's Chapter 3 save and opened it at 99%. Now only `?solved` does that. Chapter 3 re-played from 0% to launch. |
| 09-30 | Questions (all chapters): no skipping ("Not now", Close and Escape gone), two tries. After the second miss the answer is shown, then Chapter 4 restarts the current act (from a save copy taken when the act began) and Chapters 1-3 restart the chapter. (Replaces item 7, skipped questions repeating.) |
| 09-30 | Chapter 4 autopilot (button at the top, or P): flies to the next stop by the banners, mines, fixes the wing, does the Moon/Europa tasks, handles the upgrade bay; waits for every question. Flew a whole Level 4 Medium voyage to the end card. |
| 09-30 | Chapter 4 wing fix could never finish for a child (the wing crossed the 20-degree window in 0.2 s; after a reload she was out of reach): docking clamps, auto-open after 8 s, slow turning near the Sun, 1 s hold, hints. The wing question now comes. |
| 09-30 | New girl moves: I splits, B back walkover. |
| 09-30 | Chapter 4 frame monitor (`?fps` / F9) for the real-screen check. |
| 09-30 | Walk/run/cheer knees fold the right way (was item 5: they bent backward like a bird's). |
| 09-30 | Chapter 4: a target hidden under a HUD panel (Moon under the mission card) shows as a readable edge arrow (was item 8). |
| 09-30 | Chapters 1-3 have an opening (camera sweep, title card, wave; skippable) and an ending (camera round the finished building / the rocket in space, confetti, cheer, "Chapter complete" card with Next chapter). Chapter 4 already had both. Old developer messages replaced; her own name instead of "Zara". |
| 09-30 | Unlock chain checked from an empty browser at BOTH Levels (was item 3): name, build her, Chapters 1-4 each unlock only after the one before, launcher ends with "All four chapters finished". "Start everything over" now also clears the play mode, hunt progress and opening flags. |
| 09-29 | Chapter 4: after a missed Moon, a correction coast waits at most 400 s (was 3000 s of "watch your dotted line reach the Moon"). |
| 09-29 | New girl moves: H handstand, U moonwalk (backward glide, still facing forward; any key ends it). |
| 09-29 | Blank-screen fixes: every chapter recovers from a lost 3-D picture (saves, says so, reloads to the same spot); the game server restarts itself if it stops (`scripts/serve.bat`); the server no longer watches docs/notes/screenshots (they caused reloads and watcher errors). |
| 09-29 | Planner hitch (was item 9): the Chapter 4 full route search runs in 4 ms slices over several frames instead of one 50-150 ms freeze; the tracking check searches coarse-then-fine (about half the time, same or better plans); the in-window burn check keeps the full grid for accuracy. |
| 09-29 | Tidy (was item 10): `docs/progress/` screenshots ignored by git; the old 2-D Chapters 1-2 moved from `public/chapters/` to `docs/legacy-chapters/` (kept as the spec, no longer shipped). |
| 09-29 | Chapter 4 time warp works on Level 4 Medium/Hard (the no-warp zone round the planet she's leaving shrinks on a clear path; destination and other moons keep theirs); a refused warp says why. Missing a moon on a capture step brings back the transfer help. L4 Easy/Medium/Hard autopilot runs reach the end card. |
| 09-29 | The girl smiles (slight); fun moves in Chapters 1-3: J jumping jacks, K dance, L forward roll. |
| 09-29 | Chapter 4 upgrade bay: already-built upgrades show "Built" and can't be bought twice (was a loop at the belt). |
| 09-29 | `RUN_GAME.bat`: reuses a running Rocket Village server, else takes the next free port. |
| 09-29 | Collisions: every building, wall, tree and home is solid in Chapters 1-3 (Chapter 2's built structures fixed); bridges walked on, not through. |
| 09-29 | Play modes Easy/Medium/Hard for Chapters 1-3: nav arrow and glow (Easy), mining by E presses (Medium/Hard), treasure hunt with grade-level clues (Hard). All 18 village runs pass. |
| 09-29 | Final check of every chapter, Level and mode. Chapter 4 leaving-Earth crash loop fixed. |
| 09-29 | Chapter 3 refresh (name signs, building colours), HUD cleanup for Chapters 1-2, frame-time check (all under 16.7 ms). |
| 09-29 | Girl v2: realistic, slimmer, face features, wardrobe; built once in the character page and used in every chapter. |
| 09-29 | Chapters 1 and 2 rebuilt in 3-D (same maps, rules, questions and saves). |
| 09-28 | Chapter 4 orbit-transfer help panel (WHEN / POINT / PUSH); Easy transfers are one tap of W. |
| 09-28 | Chapter 4 "Voyage to Europa" built and playable end to end at both Levels. |

---

# History: Level 3 — Rocket Village: 8-Hour Build Plan

**Locked decisions**

| | |
|---|---|
| Visual style | **B — Cel-shaded** (toon ramp + inverted-hull outlines) |
| Assets | **Only what we already have.** `space/` and `kenney_nature/` are now copied into `public/assets/models/` |
| Theme | Village that builds a rocket ship |
| Physics | Real simulation |
| Quests | Step-by-step chain in the style of `level1_vox_science_village.html` / `level2_city_engineering.html` |
| Girl character | **Deferred.** Placeholder ships; you build the real one and drop it in |
| Rocket | **Reuse the existing one** in `world.js` — tower, pad, 5 stages, hologram preview |
| Engine | Three.js 0.185.1 + Vite (the existing project) |

---

## Verified facts (measured, not assumed)

Before planning I ran a real toon-shading test against the actual GLBs and the
project's own Three.js — `src/toonTest.js`, live at `/docs/toon-test.html`.
Everything below came out of that run, and it changed the plan in five places.

| Finding | Consequence |
|---|---|
| Cel-shading works on the real assets | Style B is viable. Confirmed, not hoped |
| `ground_grass.glb` is **1.00 × 0.00 × 1.00** — a flat 1-unit plane. `kenney_nature` also ships `ground_path` straight/bend/corner/cross/split/end | The board is a plain integer grid and the **path tiles are already authored**. Big saving |
| Kenney GLBs have **no texture and no vertex colours** — flat `material.color` only | Ideal for toon. Recolouring is a one-line change per material |
| Trees are ~1.7 tall, rocks ~0.8 wide, against 1-unit tiles | `kenney_nature` needs **no scale normalisation**. Drop-in |
| Space-kit models are **8–12 units** (`GeodesicDome` 8.53, `Spaceship_FinnTheFrog` 11.62) | Every space asset needs ~0.22–0.30 scale |
| **Quaternius `nature/` is textured** — `map=Y vcol=Y`, real bark/leaf/flower/grass maps — and looks far better cel-shaded than Kenney's flat-coloured vegetation | **Vegetation comes from `nature/`, ground tiles from `kenney_nature/`.** 23 models + only their referenced textures copied in (19 MB) |
| Quaternius nature is authored at **~7.3 units tall** (`CommonTree_1` 4.31×7.26×4.58) | Needs ~0.24 scale against 1-unit tiles |
| `ground_grass.glb` is `#73eddd` — **teal, not green** | Tinted per-tile. This is why `toonPipeline` supports `tint` |
| Space kit renders **dark industrial charcoal** — its `Atlas.png` palette is not a bright village palette | Space-kit props need **explicit colour overrides**, not their atlas as-is. Budgeted in B2 |
| **No vertical rocket exists** in the library — all four `Spaceship_*` are horizontal cartoon craft | Irrelevant, because **the project already has one**: see below |
| **`world.js:816–950` already builds the whole rocket complex** — 30 m launch tower (4 legs, cross-bracing, 3 platforms, service arms, glass control cabin), marked pad with rings and 12 lamps, the 5-stage rocket (`applyBuiltStages`), and a translucent hologram preview that hides once the body is built | **Port it, don't rebuild it.** This is the single biggest saving in the plan — Phase 3 drops from "build a rocket" to "re-shade an existing one", freeing most of a phase for the physics |
| 49 tiles + 12 props = **187 draw calls, 10,564 tris** | Tiles **must** be instanced or merged. Single biggest perf task |
| Inverted hulls fill in on dense geometry (the dome's lattice went black) | Outline only meshes **≤600 tris**. Already implemented in the test |
| `PCFSoftShadowMap` is deprecated in 0.185 | Use `PCFShadowMap` |

---

## What we reuse (this is not a rewrite)

You caught me planning to rebuild a rocket that already exists. Checking the rest
of the codebase for the same mistake, most of this build is **re-shading and
extending working systems**, not writing new ones:

**Audited, not assumed.** A read-only critic agent verified every claim below
against the code. It downgraded three of my five, so the table is its verdicts,
not my optimism.

| Already built | Where | Verdict |
|---|---|---|
| Rocket pad, 30 m tower, 5 stages, hologram preview | `world.js:816–948` | **KEEP-WITH-FIXES.** Materials already shared; stage rebuild is correct. `applyBuiltStages` **leaks geometry** — it removes without disposing, so it is a rebuild, never a per-frame tick. Frozen in `contracts.js` |
| `launchRocket` | `world.js:950–963` | **DELETE.** Broken four ways: no pad guard, a re-entrancy check that can't fire for 6 s, a flame that never follows the rocket, and an animatable never removed. A3 replaces it with real flight |
| Swept collision — player solver | `world.js:206–225` | **KEEP.** Genuinely correct: sub-stepping beats the thinnest collider, segment maths is a proper point-to-segment clamp |
| Swept collision — camera solver | `world.js:110–205` | **KEEP-WITH-FIXES.** Every tree and rock registers a camera blocker, so the camera snaps to the player's head near a boulder. Terrain clip fraction is applied in the wrong frame. Box rotation ignored |
| `collider.height` | all four constructors | **There is no vertical collision.** The field is written and never read, anywhere. This is a 2D solver with a Y bolted on — A3's physics has nothing to build on here |
| 8 questions + 5 stages with dependency gating | `state.js` | **KEEP the data** — no unreachable stage, no way to lose resources without a stage |
| `loadSave` | `state.js:24` | **REBUILD.** One-level spread replaces `inventory` wholesale. A4's schema change would hand every existing player `undefined` resources and brick them |
| Fail-soft GLTF loader | `assets.js` | **KEEP-WITH-FIXES.** "Never throws" was wrong: it throws on cache hits and *hangs forever* if a cold load throws in its callback. Clone/animation handling is sound — the girl-swap contract verified end to end |
| Player controller + RPG camera | `player.js` | **KEEP.** The integrator swap is 36 lines (`:357–392`); camera and animation need zero changes. One real bug: `modelBaseY` is never assigned, so the avatar sinks into the ground |
| Village layout | `rocketVillageLayout.js` | **KEEP** |

### Dead code to delete rather than port

- **`world.js`: ~280 lines (23%) unreachable** — `createSkyDome`, `createTerrain`, `createGrassBlades`, `createPathsAndWater`, `createNature`, `makeWindmillFallback`, `makeGrassTexture` all superseded by `VisualEnvironment` and never removed.
- **`visualEnvironment.js`: ~1000 of 1190 lines are dead weight** for a tile board. Keep ~180: `createSky`, `createEnvironmentMap`, `createMountains` (a perfect backdrop ring), `instantiatePrototype` (already-working instanced-mesh helper A1 needs), and the quality/LOD plumbing.

What is genuinely **new**: the toon pipeline, the instanced tile board, the flight
simulation, and the multi-step quest chain.

---

## Agent roster

Subagents each start cold and cannot edit the same file safely, so the split is
**by file ownership** — no two agents ever write the same path. Only the main
agent merges.

| Agent | Owns (exclusive write) | Never touches |
|---|---|---|
| **Main** (me) | `src/main.js`, integration, final build | — |
| **A1 · Board** | `src/game/board.js`, `src/game/toonPipeline.js` | anything else |
| **A2 · Structures** | `src/game/structures.js` | board, quests |
| **A3 · Physics** | `src/game/physics.js`, `src/game/rocket.js` | rendering |
| **A4 · Quests** | `src/game/quests.js`, `src/game/questions.js` | rendering |
| **A5 · Interface** | `src/game/hud.js`, `src/styles.css` | game logic |
| **A6 · Critic** | **read-only** — reviews and reports | writes nothing |

A6 runs against the plan *before* any code, then again after every merge. It
files findings; the main agent decides what to act on. A critic that also edits
stops being a check, so it does not edit.

Shared contracts are frozen before work starts, in `src/game/contracts.js`
(types and function signatures only). Every agent codes against it. This is what
makes parallel work merge cleanly instead of colliding.

---

## The 8 hours

Four two-hour phases. Each phase: parallel agent work → main merges → critic
pass → **playable build + screenshot**. The game runs at the end of every phase,
never only at the end.

### Phase 1 (0:00–2:00) — Board and look

- **A1** Instanced tile grid from `ground_grass` / `ground_path*`; toon pipeline extracted from `toonTest.js`; outline rule (≤600 tris); draw calls under 60 for a 12×12 board
- **A2** Village shells: science dome, workshop, fuel store, launch pad — space kit with colour overrides at 0.22–0.30 scale
- **A3** Fixed-timestep physics loop + character controller (capsule, gravity, tile collision)
- **A4** Quest state machine + the 8 rocket-build stages as a dependency graph
- **A5** HUD frame: progress bar, resource counters, quest card, toast — ported from the L1/L2 layout
- **Gate 1** — village renders, girl walks on it, 60fps

### Phase 2 (2:00–4:00) — The loop closes

- **A1** Path network, props, cliff ring from the 56 `cliff_*` pieces, camera follow
- **A2** Interactables: each building registers a quest trigger and a collider
- **A3** Resource nodes, pickup, inventory maths
- **A4** Questions 1–4 authored, modal wired, reward application
- **A5** Quest modal, bag, map panel
- **Gate 2** — collect a resource, open a quest, answer it, get the reward

### Phase 3 (4:00–6:00) — Rocket and real physics

The rocket already exists. This phase re-shades it and gives it real flight.

- **A2** Port `createRocketPad()` + `applyBuiltStages()` from `world.js` to the toon pipeline. Keep all five stages, the tower, and the hologram preview — that preview is good design and stays
- **A3** **Flight simulation** (the bulk of the phase, funded by not rebuilding the rocket): thrust, dry mass + fuel mass, burn-off over time, drag against altitude-thinning air, gravity. More fuel = more mass = worse climb, so the physics *is* the lesson rather than decoration
- **A3** Stage choices feed the sim — the fuel tanks and nose cone the kid built change the actual trajectory
- **A4** Questions 5–8, launch-clearance gate
- **A1** Launch camera, exhaust, smoke
- **A5** Launch readout — velocity, altitude, fuel burned, current mass
- **Gate 3** — build all stages, launch, watch a real trajectory that a worse build fails to fly

### Phase 4 (6:00–8:00) — Make it good

- Critic pass across everything; punch list
- Perf: instancing, merged statics, draw-call budget
- Save/load, reset, full regression
- Polish: audio hooks, transitions, the grade
- `npm run build` green
- **Gate 4** — ship

---

## Screenshots

I can't pace to a wall clock — I deliver when a task lands, not on a timer. What
I'll actually do is send a screenshot **at every completed subtask**, roughly 30
across the build, each one a real playable state. In practice that lands near
your 15-minute rhythm without pretending to a precision I don't have. Say the
word if you'd rather have fewer, bigger updates at the four gates.

## The girl

Placeholder capsule figure until you deliver yours. The swap is one file:

```
public/assets/models/characters/girl_scientist.glb
```

`src/game/player.js:258` already matches clips named `idle`/`stand`,
`walk`/`jog`, `run`/`sprint`. Drop a rigged GLB at that path and it animates
with no code change. I'll keep that contract intact and re-verify it at Gate 4.

Both library models are static meshes — 0 animations, 0 skins — so they can't be
used as-is. Your rigged one replaces the placeholder directly.

---

## Two risks worth naming now

**The 8 hours are mine, not yours.** Four gates need your eyes. If a gate waits
on a reply, the clock keeps running — the plan assumes you're reachable at the
two-hour marks, or that I proceed on my best judgement and you correct at the
next gate. Tell me which.

**Scope is the real risk, not difficulty.** Everything above is achievable; all
of it in 8 hours is tight — though less tight than it looked before I checked
what already exists. If something has to give, it gives in this order: audio →
map panel → cliff ring → question count (8 down to 5). The core loop — walk,
collect, solve, build, launch — is never what gets cut.

---

## Before I start

Nothing here is built yet. Confirm and I'll run the critic pass on this plan
first, then start Phase 1.
