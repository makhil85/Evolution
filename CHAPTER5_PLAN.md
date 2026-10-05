# Chapter 5: Rings to a Star (build plan)

The design (agreed with the lead, 2026-10-05) is the Claude doc "Beyond Europa
plan": https://claude.ai/code/artifact/4a5b1c8d-9a9e-4adb-bc8c-da647b98b08b

Chapter 5 = Part A (Europa to Saturn, ring run), Part B (Uranus, Neptune,
Space pool, Pluto, the edge), Part C (atoms and fusion), Part D1 (design the
rock ship, find the rock, build the engine half). It ends with a cutscene that
leads into Chapter 6. Level 4 first; Level 1 later. One PR for the whole
chapter. Lessons: 5A rings, 5AA momentum, 5B Neptune, 5C atoms and fusion.

## How it is built

Chapter 5 is a second page (`chapter5.html`) on the Chapter 4 space engine.
`src/space/chapter.js` says which chapter the page is; the chapter picks the
mission chain (`src/space/ch5/`), the save keys, the start (Jupiter orbit
after leaving Europa) and the opening. Mini-games use main.js's `runScene`
contract like the Moon and Europa walks.

## Steps (each verified before the next)

| # | Step | Verify |
|---|---|---|
| 1 | `chapter5.html`, `chapter.js`, own save keys, launcher card (locked until Ch 4 is done) | Ch 4 unchanged (`npm test`, boots); Ch 5 card locked / opens with `?unlock=all` |
| 2 | Ch 5 mission chain, act titles, start in Jupiter orbit, Ch 5 question bank | page boots into step 1; reload resumes |
| 3 | Planet line-up for Ch 5 (windows open on arrival), faster warp out here | node check: each transfer window and trip time |
| 4 | Opening cutscene: lift off Europa, loop Jupiter, "Chapter 5" title | screenshots |
| 5 | Leave Jupiter, cruise to Saturn, density question | autopilot reaches Saturn |
| 6 | Saturn pole pass: hexagon storm, question | screenshot |
| 7 | Lesson 5A (rings) | lesson test + film frames |
| 8 | Ring run game: scene, steering, chunks, shooting + recoil, levels, water points, score card | logic test + browser run on each level |
| 9 | Lesson 5AA (momentum, 5 films) | lesson test + film frames |
| 10 | Leave Saturn, Uranus flyby, question | autopilot |
| 11 | Neptune flyby, pause, lesson 5B, questions | autopilot + frames |
| 12 | Kuiper belt, Pluto and Eris | screenshots |
| 13 | Space pool game | logic test + browser run |
| 14 | Pluto fly-past question, edge pull-back cutscene | screenshots |
| 15 | Lesson 5C (atoms and fusion, 5 films) | lesson test + film frames |
| 16 | Design the ship by questions (sketch builds up) | browser run |
| 17 | Rock hunt (scan candidates against the checklist) | browser run |
| 18 | Engine half: mine, make fuel, make parts, fit the drive, test fire | browser run each |
| 19 | Math questions through the chapter | bank test |
| 20 | Ending: cutscene into Chapter 6, end card, chapter complete | browser run, launcher shows done |
| 21 | Lessons list, autopilot full run, docs | full autopilot run, `npm test` |

## Status (2026-10-05)

All 21 steps built at Level 4. Changes from the first plan, agreed while
building:

- Saturn, Uranus and Neptune are orbit stops, not flybys: in this squeezed
  solar system a flyby flung the ship far off course. The next planet is
  lined up as she sets off (`ch5/lineup.js`), so a window opens soon.
- Pluto is a fly-past (Chapter 5 only body); Eris is left out.
- The rock hunt and the engine build are 2-D cards on the lesson-card
  layer, like the Space pool; the ending is a 3-D cutscene.

Checks: `npm test` (the Chapter 5 suites are `test-ch5-flight.mjs` and
`test-ch5-games.mjs`), and a browser look at every part (see HANDOFF).
Level 1 wording is in place but not yet tuned (PLAN.md item 13).
