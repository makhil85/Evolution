# Chapter 6, Part E (steps 13-20): built apart, ready to join

Built 2026-10-05 on branch `claude/continue-previous-mxa5k8` while steps 1-12
(page, rock ship, crew, opening, walk-inside habitat, 6 stations, lesson 6A)
were still in another thread and not on GitHub. So Part E is **new files
only**: it does not touch `chapter6.html`, `src/space/chapter.js`, the
launcher, `missions.js`, `PLAN.md`, `HANDOFF.md`, `package.json` or
`src/lesson/index.js`. Joining is the short list at the bottom.

Design source: the plan doc "Beyond Europa" (Part E, lessons 6B/6C, maths
thread) and `chapter6-handoff.md`. The lead OK'd 2-D cards for the slingshots
(the squeezed solar system flings a free-flying ship off course).

## What each step is

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

## Joined (2026-10-06)

Steps 1-12 were then built in the same branch (`CHAPTER6_PLAN.md`), so the joining list is done: the chain (`ch6/steps.js`), crew names (`crewInfo.js`), the question bank (`questions.space.js`), the lessons list, `npm test`, the docs. The playtest hooks are in `lab/playtest.js clear()`, and "Start everything over" removes the Part B/E keys (`launcher/profile.js`).

## Numbers (all in `routes.js`, retune there; tests and questions follow)

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

## Not done / to check after joining

- A real play of the whole chain inside the Chapter 6 page (only possible
  once steps 1-12 are here). Each piece was checked on its own.
- The drive-on cutscene builds its own close-up Sun out along the real Sun's
  direction; check it reads well from wherever Part D leaves the ship.
- Level 1 text: `npm run reading` is clean for these files except the
  checker's known blind spots (it reads both Levels of the question bank
  and of `lvl()` calls).
