# Chapter 6: The Long Trip (build plan)

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
| 2 | Rock B beside her in flight (the Ch5 rock ship model), riding with her | screenshot |
| 3 | The crew: Biologist (kid), Doctor (kid), Builder bot, Signal bot: 3-D figures and dialogue names | screenshot |
| 4 | Opening: the supply ship from Earth docks at the rock, title, the crew say hello | cutscene frames |
| 5 | The habitat: walk inside the rock ship (shield wall, air, water, farm, power core, store, crew quarters); a station at each part; the crewmate who leads it stands there | screenshot, walk + E |
| 6 | Station: Shield check (patch thin spots; each metre stops half) | logic test + card |
| 7 | Station: Oxygen (algae lamps + ice splitter vs what the crew breathes) | logic test + card |
| 8 | Station: Water loop (route used water through the filters; % recycled) | logic test + card |
| 9 | Station: Food (plan the farm: area x yield) | logic test + card |
| 10 | Station: Energy grid (share the drive's power: fractions) | logic test + card |
| 11 | Station: Pack list (needed or not; mass budget with decimals) | logic test + card |
| 12 | Lesson 6A: a ship that is a tiny Earth (3 films) | lesson test + frames |
| 13-20 | Part E (route planner, 6B, slingshots, Sun dive, 6C, % of light, questions, end) | DONE: see CHAPTER6_PART_E.md |
| 21 | Questions for Parts A-C, docs (HANDOFF, PLAN, LESSONS_PLAN), full chain check | bank test, npm test |
