# Chapter 6: The Long Trip (build plan)

> 2026-10-07 restructure (see HANDOFF.md, session (c)): Chapter 6 now starts
> in the asteroid belt with the ship build (moved from Chapter 5), and Part E
> is "the fastest way out": lesson 6B on energy, then a planner with 10 t and
> 100 t of fuel over five routes (routes.js). The tables below describe the
> first build; where they differ, HANDOFF.md is current.

Design: the Claude doc "Beyond Europa plan" (D2, Crew and Part E sections)
https://claude.ai/code/artifact/4a5b1c8d-9a9e-4adb-bc8c-da647b98b08b and
`chapter6-handoff.md` (2026-10-05). Level 4 first; Level 1 lines written
alongside but tuned later. One PR for the whole chapter.

Chapter 6 = Part A (the crew arrives at the half-built rock ship), Part B
(build the living half inside the rock: six stations), Part C (lesson 6A, a
ship that is a tiny Earth), Part E (plan the route, slingshots, Sun dive,
light speed, "to be continued"). The lead chose a walkable 3-D habitat
(2026-10-05) and 2-D cards for the slingshots (2026-10-06).

## How it is built

`chapter6.html` runs the space engine; `src/space/chapter.js` `IS_CH6` picks
the chain (`src/space/ch6/steps.js`), save keys (`level6_long_trip_v1`,
`_L1`), the start (Sun orbit in the Kuiper belt, by Rock B), the act titles
and the question bank. `OUTER` is what Chapters 5 and 6 share (Pluto, the
cruise warp, long windows, the Kuiper belt). Moons don't pull in Chapter 6
(`setMoonPulls(false)`). Pure rules live in their own files so node tests
them (`scripts/test-ch6-*.mjs`).

## Steps (each checked before the next)

| # | Step | Check |
|---|---|---|
| 1 | Page, chapter switch, save keys, start, launcher card, Part E playable | DONE: npm test, page boots into Part E |
| 2 | Rock B beside her in flight (the Ch5 rock ship model), riding with her | DONE 10-06 |
| 3 | The crew: Biologist (kid), Doctor (kid), Builder bot, Signal bot: 3-D figures and dialogue names | DONE 10-06 |
| 4 | Opening: the supply ship from Earth docks at the rock, title, the crew say hello | DONE 10-06 |
| 5 | The habitat: walk inside the rock ship (shield wall, air, water, farm, power core, store, crew quarters); a station at each part; the crewmate who leads it stands there | DONE 10-06 |
| 6 | Station: Shield check (patch thin spots; each metre stops half) | DONE 10-06 |
| 7 | Station: Oxygen (algae lamps + ice splitter vs what the crew breathes) | DONE 10-06 |
| 8 | Station: Water loop (route used water through the filters; % recycled) | DONE 10-06 |
| 9 | Station: Food (plan the farm: area x yield) | DONE 10-06 |
| 10 | Station: Energy grid (share the drive's power: fractions) | DONE 10-06 |
| 11 | Station: Pack list (needed or not; mass budget with decimals) | DONE 10-06 |
| 12 | Lesson 6A: a ship that is a tiny Earth (3 films) | DONE 10-06 |
| 13-20 | Part E (route planner, 6B, slingshots, Sun dive, 6C, % of light, questions, end) | DONE: see Part E below |
| 21 | Questions for Parts A-C, docs (HANDOFF, PLAN, LESSONS_PLAN), full chain check | DONE 10-06: npm test (ten suites), browser pass |

## Part E in detail

### What each step is

| Step | What | File(s) | Checked |
|---|---|---|---|
| 13 | Route planner: top-down map Pluto -> Sun, planets nearly in a line ("once every 175 years"); 3 routes (Neptune-Jupiter-Sun, Uranus-Saturn-Jupiter-Sun, Saturn-Earth-Sun); set each flyby far/medium/close/skimming; bars for speed gained vs the goal (50 km/s) and steering fuel vs the tank (40 t); "Fly this route" only when both are met | `src/space/ch6/routes.js` (sums), `routePlanner.js` (card, hook `window.__route`) | node tests; browser screenshot |
| 14 | Lesson 6B "Stealing speed": (1) seen from Earth, same speed in and out; (2) seen from the Sun, 50 -> 70 km/s, Earth drifts back (exaggerated, with a note), momentum bars ship + / Earth -; (3) the Sun: a plain flyby adds nothing, the same push fired far out gives 60 km/s, fired at the closest point 93 km/s | `src/lesson/lessons/ch6b.js` (`LESSON_6B`, id `ch6_slingshot`) | node tests (shape, draws); browser frame |
| 15-16 | Fly the slingshots and the Sun dive: one card, one flyby at a time seen from the planet; slow motion near the closest point and a timing bar (gold = all the boost, green = at least 70%, miss = half; closer flybys have narrower windows); the planet shifts back after the press and momentum bars show ship + / planet -; a side list shows each flyby's gain and the running total; at the Sun the press fires the drive | `src/space/ch6/slingshot.js` (hook `window.__sling`), `routes.js` (`keptFraction`, `windowFor`, `flightResult`) | node tests; browser screenshots |
| 17 | Lesson 6C "How fast is light?": light laps Earth ~7 times in a second; the ship's bar next to light's grows to 1/10 and the dial switches to "10% of light"; 4 light years -> 40 years at 10%, plus one teaser line on clocks ticking slower | `src/lesson/lessons/ch6c.js` (`LESSON_6C`, id `ch6_light`) | node tests; browser frame |
| 18 | Drive-on cutscene (3-D, ~24 s, skippable): the rock ship swings past a close-up Sun, the drive lights at the closest point, it streaks out; a speed dial counts km/s then switches to % of light; ends on "10% of light speed" | `src/space/ch6/driveOn.js` (`playDriveOn(game, {speedKms})`, reuses `buildRockShip` from Ch5) | browser run inside `chapter5.html` |
| 19 | Part E maths/science questions, Level 4 + Level 1 overlay: add the boosts, fuel left, why Jupiter, why fire at the closest point, % of light, years to Alpha Centauri (44) | `src/space/ch6/questions.partE.js` (`CH6E_QUESTIONS`, `CH6E_LEVEL1`, `partEBank(level)`) | node tests re-derive every number from `routes.js` |
| 20 | The steps chain and the end card ("To be continued...") + tests | `src/space/ch6/partE.js` (`partESteps(game)`, `CREW`, `clearPartE()`), `scripts/test-ch6-route.mjs` | 19 node checks pass |

The chain (`partE.js`): `c6_plan_route` (beat `c6FuelLeft`) -> `c6_lesson_slingshot`
(6B, beat `c6RouteSum`) -> `c6_fly_slingshots` (beat `c6JupiterBoost`) ->
`c6_drive_on` (cutscene, beat `c6SunDive`) -> `c6_lesson_light` (6C, beat
`c6PercentLight`) -> `c6_star_trip` (crew lines, beat `c6StarYears`) ->
`c6_end` (`markSaveComplete`, end card). The plan and the flight result are
saved in `rocket_village_ch6_route_L<level>` so a reload mid-Part E resumes.

### Numbers (all in `routes.js`, retune there; tests and questions follow)

- Boost / steering fuel at far, medium, close, skimming:
  Neptune, Uranus, Earth 1/2/3/4 km/s for 0/2/4/8 t; Saturn 2/4/6/8 for
  0/3/6/12; Jupiter 3/6/9/12 for 0/4/8/16; the Sun dive 10/20/30/40 for
  0/5/10/20 (the drive's push, fired at the closest point).
- Start speed 5 km/s, goal +50 km/s, tank 40 t. Best plans: NJ+S 55 km/s
  for 40 t, USJ+S 58 for 38, SE+S 52 for 40. The all-medium plan never
  works; skimming everything is over the tank on two routes.
- Timing window half-width 0.9/0.7/0.5/0.35 s of slowed time (far ->
  skimming); kept = 100% in the middle quarter, down to 70% at the edge,
  50% for a miss.
- Cruise 10% of light (30,000 km/s); Alpha Centauri 4.4 ly -> 44 years.
