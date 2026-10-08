# Starship upgrade plan (Chapters 5-6, plus a Ch1-5 issue sweep)

Lead request 2026-10-08. Coordinator: main session. This file is the plan of
record for the batch; update it as work packages finish. Read
`AGENT_HANDOFF.md` first for the code map.

## 0. Goal

AA quality for the ship for the stars and its interior, inside the current
framework (Three.js toon pipeline, the space engine, `runScene` walk scenes),
"Star Trek meets Interstellar": real science (shield physics, spin gravity),
a sleek engineered ship, a big walkable interior built part by part like the
Chapter 1-3 villages, smooth movement for the girl, the crew and the robots.

## 1. Issues (from the lead, plus what the coordinator found)

| # | Issue | Where now |
|---|---|---|
| a | The ship is a whole hollowed rock. Rock should be only a small part: a front shield cap kept after drilling. | `ch5/ending.js buildRockShip` (R = 36 u, ~140 m rock), used by `ch6/opening.js showRockB`, the test fire (`playCh5Ending`), `ch6/driveOn.js` |
| b | Cutscenes: huge rock, tiny ship. | same; `rockOffset` puts the rock 150 u beside her |
| c | A question on the shield: as light as possible, only in front, to stop the hits near light speed. | design board (`ch5/designBoard.js`) teaches "hollow it out, 600,000 t"; rock hunt picks a 140 m rock |
| d | Inside the ship the light is too strong. | `ch6/habitat.js`: hemisphere 1.1 + directional 1.2 + point light 30 + glowing core, toon materials, white blow-out |
| e | The interior is a box-like round hall; make the whole interior good quality, future-looking. | `ch6/habitat.js` (one 26 m hall, 6 station props, bunks) |
| f | Better-looking sprites (crew portraits/figures) and robots. | `ch6/crew.js` (Bolt = boxes on tracks, Echo = sphere), dialogue cards |
| g | Ship animation upgrade (test fire, docking, drive-on, ring spin). | `ch5/ending.js`, `ch6/opening.js`, `ch6/driveOn.js` |
| h | Other issues in Chapters 1-5. | audit (WP-7) |

**Story change that follows from a:** the rock is drilled and mined (ice ->
water and fusion fuel, metal -> parts); only a thin front cap stays. The crew
lives in the ship's spinning ring, not inside a rock. Ch6 Part B "build the
living half inside the rock" becomes "fit out the ring". Lesson 6A, station
texts, the design board and the rock hunt need matching words.

## 2. The ship design (lead, 2026-10-08)

- **Front shield cap** from the drilled asteroid: a disc or shallow cone,
  about **1.2x the ship's width** so the whole ship sits in its shadow,
  mounted **ahead on a truss with a gap** so impact debris misses the hull.
  Roughly **5-10% of the ship's look.** Rock with a water-ice layer (ice and
  hydrogen-rich plastic stop protons better per kg).
- A **faint glowing magnetic field** ahead of the cap (pushes charged gas
  aside); optional a forward laser pulse that vaporizes dust (story beat).
- Behind it a **sleek hull**: a central spine, a **spinning habitat ring**
  (spin gravity; Interstellar's Endurance), the **fusion drive** at the back
  (magnetic nozzle rings, the existing ring-lighting idea), radiator fins,
  docking port, running lights. Her small ship and the supply ship dock at
  the hub.
- **Science for the question (c):** near light speed thin gas hits like a
  proton beam and dust like bombs; only the front needs armour; at our 10%
  of light speed (the game's cruise) a few metres of rock and ice is enough;
  near 0.9c real designs add a magnetic field and a laser; extra mass costs
  fuel, so the cap is as light as it can be.

## 3. Level 1 plan (work packages)

| WP | Package | Owns (files it may edit) | Depends |
|---|---|---|---|
| 1 | **Starship model**: one module that builds the ship (cap + truss + field + spine + ring + drive + fins + lights), LOD for flight distance, `setRingSpin`, `setDrive(0..1)`, `setField(0..1)`, `setLights` | new `src/space/ch6/starship.js` | - |
| 2 | **Ship in the story**: replace `buildRockShip` users (flight beside her, test fire, docking, drive-on) with the starship at the right scale; smooth camera paths; drilling beat (rock -> cap) | `ch5/ending.js`, `ch6/opening.js`, `ch6/driveOn.js`, `ch6/partBuild.js` | WP-1 API |
| 3 | **Interior**: a new walkable ring habitat built part by part (modules like the villages' `world*.js`): ring corridor curving up, bridge with a viewscreen, hydroponics farm bay, water/air lab, engineering (fusion core behind glass), crew quarters, mess/lounge, observation window; six stations mapped onto it; doors, signs, props; soft lighting (no blow-out) | new `src/space/ch6/interior/*.js`, `ch6/habitat.js` (scene shell, stations, colliders) | - |
| 4 | **Crew and robots**: new Bolt and Echo models with smooth idle/move animation (hover bob, eyes on a visor screen, arms, thrusters), kids' idle/walk, crew walking between spots on smooth paths, dialogue portraits | `ch6/crew.js`, `ch6/crewInfo.js`, portrait drawing (new `ch6/portraits.js`) | - |
| 5 | **Words and questions**: design board / rock hunt / workshop / lesson 6A / station texts for the drilled-rock-cap story; new shield question(s) (front only, as light as possible, why at 10% c a few metres is enough); test updates | `ch5/designBoard.js`, `ch5/rockHunt.js`, `ch5/workshop.js`, `ch6/questions.partB.js`, `ch6/questions.partE.js`, `lesson/lessons/ch6a.js`, `scripts/test-ch6-route.mjs`, `scripts/test-ch5-games.mjs` | - |
| 6 | **Integration + lighting pass** (coordinator): wire WP-1..5 together, tone the habitat lights, frame-rate check, docs | `ch6/steps.js`, `ch6/partB.js`, docs | 1-5 |
| 7 | **Ch1-5 issue sweep**: auditors play through with the lab hooks and list issues (visual, flow, text, softlocks) with screenshots; coordinator triages; fixes in a following batch unless trivial | read-only + a report file | - |

## 4. Level 2 plan (granular tasks per package)

**WP-1 Starship model**
1. Dimensions: ring diameter ~ 120 m, spine ~ 260 m, cap ~ 1.2x ring width
   (~145 m), cap thickness ~ 8-12 m with an ice layer; gap cap -> hull ~ 30 m.
2. Cap: lumpy drilled-rock disc/cone (reuse the rock noise from
   `buildRockShip`), a pale ice layer on the back, bolted ring mounts.
3. Truss: lattice (instanced beams), not a solid tube.
4. Field: a faint additive shell ahead of the cap, gentle shimmer, `setField`.
5. Spine + hub with docking port; ring with spokes, window strips (emissive),
   spins (`setRingSpin`).
6. Drive: magnetic nozzle rings that light one by one (`setDrive`), plume.
7. Radiators, antennae, running lights (blink), name decal.
8. Toon materials from `toonPipeline`, outlines like the ship, < 60k tris,
   two LODs (near cutscene / far flight).
- Metric: screenshot set (front 3/4, side, rear, at night-side lighting) shows
  every part readable; cap is 5-10% of the silhouette; frame time in the test
  browser no worse than the old rock; API documented in the file header.

**WP-2 Ship in the story**
1. `showRockB` -> `showStarship` beside her ship at a scale where her ship
   reads as a small craft docking (not a speck).
2. Drilling beat in `c6_engine`: the rock is mined away to a cap (short
   cutscene or staged reveal: rock -> cap + hull frame).
3. Test fire: drive rings light, plume, ring spins up, camera on a smooth
   spline (no cuts that jump).
4. Supply ship docking at the hub.
5. Drive-on cutscene: field glows on, ship accelerates, star streaks.
- Metric: every cutscene frame-sheet (6 frames each) shows both ships at
  sensible relative size; no pops; skippable; tests pass.

**WP-3 Interior (Star Trek decks, lead 2026-10-08)**
The crew lives in the ring on four decks joined by a lift (turbolift): she
starts on Deck 4 and rides the lift (E or 1-4, a short fade) to the
station's deck. Framework (coordinator, done): `interior/ship.js` (scene,
lift, stations, beacon, camera that stays out of walls), `walkmap.js` (grid
collision), `kit.js` (palette, merged batches, walls, curved walls, floors,
ceilings with light strips, LCARS screens, signs, sliding doors, consoles,
star windows, lamps), `decks.js` (the contract), `ship-lab.html` (lab).
1. Deck 1 `bridge.js`: a real Star Trek bridge, not a room: big curved
   viewscreen (the cap and the field ahead, stars), raised back ring with a
   rail, captain's chair + two side chairs in the middle, helm and ops
   consoles in front, LCARS wall panels round the curved back wall, tactical
   rail; shield station = the tactical/shield console; a short corridor from
   the lift. Doctor (Theo) by the shield console.
2. Deck 2 `lifeDeck.js`: a curved ring corridor joining the air/water lab
   (algae tanks, ice splitter, the three filters) and a tall hydroponics bay
   (tiered grow racks under pink-violet grow lights, a walkway between).
   Stations: oxygen, water (lab), food (farm). Mira here.
3. Deck 3 `engineering.js`: two-storey engine room with the fusion core in
   a glass column (rings of light pulsing), a master systems table, a
   balcony look; a cargo bay with crates, a loader, a big door. Stations:
   energy (core), pack (cargo). Echo and Bolt here.
4. Deck 4 `crewDeck.js`: corridor of cabins (one open to look in), a mess /
   lounge with a long curved observation window (stars turning with the
   ring), tables, plants. Start deck, no station.
5. Each deck: large movement area (>= 300 m^2 walkable), corridors >= 2.6 m
   wide, at least 2 set-point `views`.
- Metric (per deck, in `ship-lab.html`): stats() mean 0.28-0.5, blown <
  0.02; info() calls <= 120, triangles <= 250k; she can walk from the lift
  to each station (walkmap test); every station prompt reachable; no
  z-fighting or gaps in the screenshots; reads as Star Trek, not a box.

**WP-4 Crew and robots**
1. Bolt (builder): rounded body, treads or hover base, two arms with
   joints, visor face with expressive eyes; smooth idle (breathing bob, arm
   sway), walk/roll, point gesture.
2. Echo (signal): floating, dish that turns, antenna light, glow ring; bob,
   orbit around its spot, look-at the hero.
3. Kids: idle variety, wave, turn-to-face the hero smoothly, walk between two
   spots on a path (ease in/out), no foot sliding.
4. Portraits for dialogue (canvas-drawn, consistent style).
- Metric: frame sheet of each figure (idle, move, gesture) at 3 angles;
  motion has no snaps; API unchanged (`buildCrew`, `update`, `wave`).

**WP-5 Words and questions**
1. Design board: from "hollow the rock" to "drill it, keep a front cap,
   build the hull behind"; the fuel sum re-done for the new masses.
2. Rock hunt: the checks fit a cap source (enough rock + ice, solid, not too
   big to move).
3. New question(s) on the shield (front only; as light as possible; ice
   better per kg; why a few metres is enough at 10% of light speed; what
   changes near 0.9c), Level 4 and Level 1.
4. Station and lesson texts: "inside the ring", not "inside the rock".
- Metric: `npm test` passes (answers re-derived in tests); `npm run reading`
  for Level 1 lines; critic checks the science.

**WP-7 Ch1-5 sweep**
1. One auditor per chapter group (1-2, 3, 4, 5), using lab hooks, `?unlock=all`
   Jump, screenshots; list issues with severity and file pointers.
- Metric: a report table per chapter; no fixes in this pass except trivial.

## 5. How agents run (maker -> critic -> one fix loop)

- Coordinator: Opus 5.5 (main session) writes the plans and each metric,
  integrates, tests, commits. Makers and critics: Haiku 5.5 high
  (`subagent_type: "haiku-high"`), **5 at a time**.
- Each maker gets: its task, its owned files (only those), the metric, its
  own Vite port (5181-5189), the lab URL. No commits, no `pkill -f`.
- Critic reads the diff + screenshots against the metric, returns blocking /
  nice-to-have. The maker fixes the blocking list once. Coordinator checks
  and commits.
- WP-7 (Ch1-5 sweep) is skipped for now (lead). Ch5 fixes the lead reported
  on 2026-10-08 are done by the coordinator as their own small PRs.

## 6. PRs (small, one session each)

| PR | Content |
|---|---|
| A | Interior framework + lab + plan (this) |
| B | Four decks (WP-3) + switch Part B to the new interior + remove habitat.js |
| C | Starship model (WP-1) + cutscenes (WP-2) |
| D | Crew and robots (WP-4) |
| E | Words and questions (WP-5) |
