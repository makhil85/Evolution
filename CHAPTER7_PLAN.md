# Chapter 7: Toward Tau Ceti (plan)

Lead, 2026-10-08. Chapter 6 ended with the starship cruising at 10% of light
speed. In Chapter 7 the fusion drive goes to full power and the ship leaves
the Sun behind for **Tau Ceti**, a Sun-like star 11.9 light-years away that may
have planets (a place to look for alien life one day; nobody knows yet if
anything lives there). Most of the chapter is **inside the ship**: feeling the
push, zero-g, chemistry and biology in the rooms, and a **quasar visited in the
holodeck**. It ends racing on at 90% of light speed.

Lead decisions (2026-10-08):
- The quasar is a **holodeck** visit (Star Trek style): the ship's computer
  takes the kids to a quasar far away. The lesson says real quasars are
  billions of light-years away, in other galaxies.
- **No sleep pods.** The drive keeps pushing until the ship is at about 90% of
  light speed. **No relativity lesson** (too advanced). Clocks running slow is
  only a short **story** line at the end.
- The whole chapter, as 4 stacked PRs, built in parallel (maker -> critic ->
  one fix round each).

## 1. The numbers (use these; re-derive them in tests)

| What | Value | Notes |
|---|---|---|
| Tau Ceti distance | 11.9 light-years | Level 1: "about 12". A G-type star, a bit smaller and cooler than the Sun. Possible planets (not confirmed). |
| Light's trip there | 11.9 years | 1 light-year = how far light goes in a year |
| At 10% of light (Ch6 cruise) | 119 years | 11.9 ÷ 0.1: why the drive goes to full power |
| Gentle push (start of Part B) | 1/100 of Earth's pull (0.1 m/s²) | A ball let go 1 m above the floor takes about 4.5 s to land (√(2 × 1 / 0.098)) |
| Full push (end of Part B, Part E) | 1 g (9.8 m/s², "about 10") | Feels like Earth; the ball lands in about 0.45 s. Speed grows about 10 m/s every second. |
| Engine check (Part B) | drive off: zero g | Coasting at a steady speed: no test inside can tell you are moving (Galileo's ship) |
| Top speed | 90% of light | Reached after about 1.4 years at 1 g (ship clocks), about 1.25 light-years out |
| The plan to stop | flip the ship, brake at 1 g for the last 1.25 light-years | Coast at 90% in between (zero g again) |
| The clocks (story only, Level 4) | ship ≈ 7.4 years, Earth ≈ 14.4 years | Level 1: "about 7 years for us, about 14 on Earth". Say "very fast clocks tick slower"; no lesson. |
| Honesty | the drive is a pretend super drive | Say so in a parent hint: no drive we can build today could do this |
| Quasar | a supermassive black hole (millions to billions of Suns) eating gas | Its disk can outshine all the stars of a galaxy. Nearest bright ones are billions of light-years away (3C 273: about 2.4 billion). Our galaxy's centre (Sagittarius A*, 4 million Suns, 26,000 ly) is quiet. |
| Why it glows | gas swirls in a disk, rubs, heats to millions of degrees and glows | The hole itself is black (its "shadow") |
| Why the distortion | gravity bends light (gravitational lensing) | A star behind it looks pushed **away** from the hole; lined up exactly: a ring (Einstein ring) |
| Water split | 2 H₂O → 2 H₂ + O₂ | Same atoms before and after |
| Plants' air swap | 6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ (sugar) + 6 O₂ | Level 1: count the O atoms / bubbles |
| Microbes | the recycler's bacteria double again and again | Use a pretend doubling time ("every hour") and say "pretend" |
| Bones in zero g | about 1% of bone lost per month with no exercise | Astronauts exercise about 2 hours a day; fluids move to the head (puffy face) |

## 2. The chain (src/space/ch7/steps.js puts the parts in order)

Act numbers: A = 1, B = 2, C = 3, D = 4, E = 5. Step ids start `c7_`.

- **Part A, Leaving the Sun (WP-A, `partA.js`)**
  1. `c7_opening`: cutscene. The drive at full power, the speed dial climbing past
     10%, the Sun shrinking to a bright star, then a star map zooming out to the
     Sun's neighbours (Alpha Centauri 4.4, Barnard's Star 6.0, Sirius 8.6,
     Epsilon Eridani 10.5, Tau Ceti 11.9 ly) with Tau Ceti ringed as the target.
  2. `c7_star_map`: walk to the bridge star map (bridge deck, near `shield`). Echo
     explains Tau Ceti; question: at 10% of light it would take 119 years, so
     the drive goes to full power.
- **Part B, Feel the push (WP-B, `partB.js`)**
  1. Gentle push: walk with a light, floaty step (low-g gait) to the drop test in
     the cargo bay; the ball drifts slowly to the floor.
  2. Lesson 7A *How do you know you are speeding up?* (smooth train: you can't
     tell; speeding up presses you back; in a ship that is speeding up the floor
     comes up to meet the ball, which feels just like weight).
  3. Engine check: the drive goes off, zero g, the **float game**: push off walls and
     handles (and throw things backwards) to float to the targets.
  4. Full push (1 g): the drop test again, the ball lands fast; question.
- **Part C, Chemistry and life on board (WP-C, `partC.js`)**: step by step,
  building on Chapter 6's oxygen/water/farm stations.
  1. Lesson 7B *Atoms: what everything is made of*, then room tasks
     **split water** (lab) and **the plants' air swap** (farm).
  2. Lesson 7C *Tiny life helps us*, then room tasks **microbe helpers**
     (the recycler) and **bones in low g** (sick bay).
  Each task: walk to the room, a 2-D card (the task), then its question.
- **Part D, The holodeck (WP-D, `partD.js`)**
  1. Walk to the holodeck door; the holodeck scene: fly near a quasar (black
     shadow, glowing disk, jets, the starfield bent round it).
  2. Lesson 7D *Black holes and quasars* (what a black hole is; why the disk
     glows; why the stars look in the wrong place).
  3. The game **Where is it really?**: stars and beacons near the hole are seen
     in the wrong place; she must find or fly to where they really are.
- **Part E, Toward Tau Ceti (WP-A, `partE.js`)**
  1. Full-push cruise cutscene: 1 g for about 1.4 years, the dial to 90%; the
     flip-and-brake plan; the clocks story; a question or two.
  2. `c7_end`: the end card (already in the scaffold; keep it, fill its stats).

## 3. Work packages (one maker each, in parallel; one PR each)

Every package: Level 4 and Level 1 for every player-facing string
(`t(l4, l1)` or `[L4, L1]`), node-testable logic in its own file, a test file
`scripts/test-ch7-<name>.mjs`, a grown-up Skip on every card and film, a
`window.__x` test hook per card, no new dependencies, no sound. **Do not edit**
`ch7/steps.js`, `ch7/questions.ch7.js`, `src/lesson/index.js`,
`scripts/test-lessons.mjs`' lesson list, `package.json` (the coordinator wires
those). Branch from `claude/ch7-scaffold`.

| WP | Files it owns | Builds |
|---|---|---|
| A: cutscenes and bridge | `ch7/partA.js`, `ch7/partE.js`, `ch7/opening.js`, `ch7/cruise.js`, `ch7/starMap.js` (+ logic `ch7/voyage.js`), `ch7/questions.partA.js`, `ch7/questions.partE.js` | Part A and Part E |
| B: the push and zero-g | `ch7/partB.js`, `ch7/floatGame.js` + `ch7/floatLogic.js`, `ch7/dropTest.js`, `ch7/questions.partB.js`, `src/lesson/lessons/ch7a.js`; a small `gait` option in `ch6/interior/ship.js` | Part B |
| C: chemistry and biology | `ch7/partC.js`, `ch7/tasks.js` + `ch7/tasksLogic.js` (the four room tasks), `ch7/questions.partC.js`, `src/lesson/lessons/ch7b.js`, `ch7c.js` | Part C |
| D: the holodeck | `ch7/partD.js`, `ch7/holodeck.js` (3-D scene), `ch7/lensGame.js` + `ch7/lensLogic.js`, `ch7/questions.partD.js`, `src/lesson/lessons/ch7d.js` | Part D |

Room tasks and walks use `createInteriorScene(game, { spots, models, onStation })`
(`ch6/interior/ship.js`) like Chapter 6's quests (`ch6/partQuests.js`). A Chapter 7
spot may borrow a deck place: `{ id: 'c7_drop', deck: 'engineering', near: 'pack', lead, title }`.
Places on the decks: bridge `shield`, `message`; life `oxygen`, `water`, `food`,
`pollen`; engineering `energy`, `pack`, `coolant`; crew `medbay`.
The crew (`ch6/crewInfo.js`): Mira (biologist), Theo (doctor), Bolt (builder bot),
Echo (signal bot).

## 4. Metrics (the critic checks every one)

**Science and words**
- Every number from section 1 (or derived from a logic file), re-derived in the
  WP's test. Made-up numbers say "pretend". Level 1: short sentences, sums a
  6-7 year old can do (count, add/take small numbers, halve, count by 2s/10s).
- Questions: 3 choices in lesson films (one right); bank questions follow the
  Chapter 6 schema; the right choice is never the longest; hints guide but
  never contain the answer; choice text is never a bare number ("3 years", not "3").
- Lessons: 3 films, each under 45 s, the last frame still shows the answer,
  labels beside the picture, `opts.reduced` respected, **one watch-only film per
  lesson** (no three questions in a row).
- Part sizes: about 3-5 bank questions per part; the whole chapter about 20-25
  questions including lesson films.

**Games (2-D cards, 800x450 canvas like the Chapter 5/6 cards)**
- Easy / Medium / Hard from the flight mode; a node bot in the WP test:
  a sensible player wins >= 90% on every mode, random or do-nothing play wins
  <= 10% on Hard; Easy is winnable by a 6-year-old (generous, with a hint).
- Clear goal text, a success moment, retry on a miss, the grown-up Skip.

**Look and speed**
- Cutscenes 20-35 s, skippable after 1.5 s (the existing cinematic skip),
  mean brightness 0.15-0.5 for space shots, blown pixels < 0.5% outside the Sun,
  the drive plume and the quasar's disk; no console errors.
- 3-D scenes (holodeck): <= 60 draw calls, <= 150k triangles, one full-screen
  pass at most for the lensing; no per-frame allocations; dispose everything.
- Bloom threshold is 1.25 linear: emissives meant to glow go above it on
  purpose, nothing else does.

**Engine**
- `npm test` passes, including `scripts/test-ch7.mjs` (the chain: unique ids,
  acts in order, every beat in the bank at both Levels) and the WP's own test.
- Reload straight into any Part's first step works (no step assumes an earlier
  step's in-memory state; use a save key like Chapter 6's quests).
