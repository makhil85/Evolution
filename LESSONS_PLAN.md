# Lessons plan: "watch, answer, try it" in every chapter

Status (2026-10-05, evening): **1A, 1B, 2A, 2B, 3A, 3B and 4G built** on `src/lesson/` (see HANDOFF). Lead: 2 lessons per chapter; every lesson must be driven by animation, not words (Flight School is the gold standard). 3C is held for later. Flight School (4A) is now on the same card, and the "📖 Lessons" list is on the launcher (2026-10-05, late night). Not yet: 3C-3E, 4B-4F. Chapter 4's
Flight School (`src/space/lesson/`) is the model: the lead liked that a short
animation explains a concept, the child answers a question about what they
just saw, and then does it for real in the game.

Question drafts below are Level 4 wording; ✓ marks the right answer. Each gets
a Level 1 version (shorter words, one idea per sentence) when built. Choice
lengths must be balanced when written for real (Flight School lesson: children
learn to pick the longest one).

## The pattern (same in every lesson)

1. **Trigger**: just before the related task, the first time on a save (a flag
   `<save>_lesson_<id>`). Never in the middle of an action. The game pauses.
2. **3 short films** (4 only when needed): 2-D canvas animations, 20-40 s each,
   with a narrator in captions that wait to be read (at least 1.5 s + 0.35 s per
   word; 1.5x that at Level 1). Pause, Replay, Next.
3. **One question per film**: 3 choices, answerable from the film's last frame.
   Two tries, then the answer is shown with a kind explanation, **no restart**
   (it's teaching, not testing). Right answer: a small cheer.
4. **Try it**: the card closes on "Now you try!" and the next thing the child
   does is the real task the lesson explained.
5. **Replay later**: a "📖 Lessons" button in the pause / chapter menu lists the
   lessons already seen.
6. **Two levels**: Level 1 / Level 4 text everywhere.

Each lesson aims at **2-3 minutes in all** (the lead found Flight School long
at 4-5 minutes).

## Shared engine (do this first)

Generalise Chapter 4's lesson into `src/lesson/`, one engine for every chapter:

| File | Job | From |
|---|---|---|
| `src/lesson/card.js` | The card: canvas, caption, Pause / Replay / Next, question view, two tries, cheer, test hook (`window.__lesson`: skip, answerAll, next, film, seek, step, state, shot) | `src/space/lesson/transferLesson.js` |
| `src/lesson/clock.js` | Reading-paced timeline: captions hold the picture until read; real time; also plays in a hidden tab (tests) | `transferScenes.js` timeline code |
| `src/lesson/draw.js` | Drawing kit: arrows (force, motion), labels that scale with the canvas, glow, dotted paths, side-on ground line, simple objects (ship, planet, cart, child, plank, seesaw, triangle truss, tank and pipes, post and Sun, plant, balloon, rocket, fin) | `transferScenes.js` helpers |
| `src/lesson/runner.js` | `playLesson(def, host)` -> Promise; host = Chapter 4's modal host or the villages' play-modal (`body.dataset.playModal`, `src/play/ui.js` styles) | new |
| `src/lesson/flags.js` | Seen flags per save, the "📖 Lessons" list; `resetEverything()` clears `_lesson_*` | new |

A lesson is data + scene functions:
`{ id, title, films: [{ captions: [[t, l4, l1], ...], draw(ctx, t, size), question: { prompt, choices: [{ text, correct }], explain, hint } }] }`.
Port Flight School onto it first (no behaviour change) so the engine is proven.

---

## Chapter 1: Science Village (`src/science/`), two history lessons

Lead, 2026-10-05: how people in ancient times worked out that the Earth is
round, and how they measured how big it is. Real history, told as a story
with a narrator ("Long ago, in ancient Greece..."), with simple period art
(columns, sails, a well, a camel caravan). It fits the Science Village: the
Science Center is where these big ideas are kept.

### 1A. The round Earth: clues from long ago (before the Science Lab, first visit)

About 350 BC, Aristotle and other Greek thinkers argued that the Earth is a
ball, using three clues anyone can see.

| Film | Animation | Question |
|---|---|---|
| The shadow on the Moon | A lunar eclipse, side view then sky view: the Sun, the Earth and the Moon line up; the Earth's shadow creeps across the Moon. Its edge is always a curve, at every angle. A flat disc tried the same way casts a thin line when seen edge-on. | "During an eclipse, the Earth's shadow on the Moon is always curved. What does that tell us?" ✓ "The Earth is round like a ball" / "The Moon is flat" / "The Sun is curved" |
| Ships over the horizon | A ship sails away over a curved sea: first the hull disappears, then the sail, the mast top last. On a flat sea it would just shrink to a dot. A watcher up a hill sees it a little longer. | "A ship sails away. Why does its bottom disappear before its sail?" ✓ "The sea curves away and hides the bottom first" / "The waves cover it" / "Ships sink a little" |
| Different stars | A traveller walks south from Greece to Egypt: a bright star near the horizon rises higher each night, and new stars appear (a sky dome over curved ground). On flat ground everyone would see the same sky. | "Travellers going south saw new stars rise. Why?" ✓ "They were walking around a curved Earth" / "The stars moved away" / "It was cloudier at home" |

Try it: the card closes on "Now you try! The Science Lab needs your ideas too."
and she goes into the Science Lab challenge.

### 1B. Eratosthenes measures the Earth (before building the Science Center)

About 240 BC, Eratosthenes, the librarian of Alexandria, measured the size of
the whole Earth with a stick, a shadow and a long walk.

| Film | Animation | Question |
|---|---|---|
| The well with no shadow | Noon in Syene on the longest day: the Sun is straight overhead, its light reaches the bottom of a deep well, and a stick casts no shadow. The same moment in Alexandria, to the north: a stick casts a short shadow. Two cities on a curved Earth; the Sun's rays drawn as parallel lines. | "At noon the stick in Syene has no shadow but the one in Alexandria does. Why?" ✓ "The Earth is curved, so the sticks point different ways" / "The Sun is closer to Syene" / "Alexandria is cloudier" |
| The angle | Zoom in on the Alexandria stick: its shadow makes an angle of about 7 degrees (1/50 of a full circle, drawn as a pie slice). The camera pulls out to the Earth's centre: lines from the two sticks meet there at the same 7 degrees. | "The angle is 1/50 of a full circle. How much of the way round the Earth is it from Syene to Alexandria?" ✓ "1/50 of the way round" / "Half of the way round" / "All of the way round" |
| Pacing it out | Surveyors and a camel caravan walk from Syene to Alexandria: about 800 km (5,000 stadia). Fifty copies of that walk wrap round the Earth like beads: 50 x 800 = 40,000 km. A modern ruler pops up: the real answer is about 40,000 km. He was nearly exactly right! | "800 km is 1/50 of the way round the Earth. How far is it all the way round?" ✓ "40,000 km (50 x 800)" / "850 km (50 + 800)" / "16 km (800 / 50)" |

Try it: "Now you try!" and she builds the Science Center (the chapter's goal).
Level 4 keeps the numbers (7 degrees, 1/50, 800 km x 50). Level 1 keeps the
story and the pictures and asks simpler versions ("Is the Earth flat or
round?", "Did he use a stick's shadow or a telescope?").

---

## Chapter 2: City Engineering (`src/city/`), two lessons

Lead, 2026-10-05: two lessons in Chapter 2. Triangles in bridges, then
Archimedes as a second history lesson. Seesaws, water towers and shadows move
to "Optional, later".

### 2A. Why bridges use triangles (before Bridge Builder / Bridge Gap Count)

| Film | Animation | Question |
|---|---|---|
| Squares wobble | A square frame made of 4 sticks pinned at the corners. A hand pushes the top corner: it squashes into a lopsided diamond. A second push the other way: it flops back. | "Why did the square frame squash?" ✓ "Its corners can swing, so its shape can change" / "The sticks were too short" / "It was too heavy" |
| Triangles hold | Add one diagonal stick: now two triangles. The same push: nothing moves (a little shake). A plain triangle on its own: also rock solid. "A triangle can't change shape without a stick getting longer." | "Which shape stays firm when you push it?" ✓ "A triangle" / "A square" / "A circle of string" |
| The truss bridge | A flat plank bridge sags in the middle when a truck crosses (bend line, red). Then a bridge with triangles above it (a truss): the truck crosses and the bridge stays straight; arrows show the push spreading along the sticks to both banks. | "Why do many bridges have triangles on top?" ✓ "Triangles spread the truck's weight to the banks" / "Triangles look nice" / "Triangles make it lighter than air" |

### 2B. Archimedes and the king's crown (before Water Wheel Drops / the water pump)

A history lesson. About 250 BC in Syracuse, King Hiero asked Archimedes whether
his new golden crown was pure gold or mixed with cheaper silver, without
damaging it. The answer came to him in the bath ("Eureka!").

| Film | Animation | Question |
|---|---|---|
| The bath | Archimedes steps into a full bath and the water spills over the side; the more of him goes in, the more spills. A label: "an object pushes aside its own volume of water". He jumps out shouting "Eureka!" ("I found it!"). | "Why did the bath overflow when Archimedes got in?" ✓ "His body pushed the water aside" / "The water got hot" / "The tap was left on" |
| Same weight, different size | A balance: a gold bar and a silver bar weigh the same, but the silver one is bigger (silver is lighter for its size). Each is lowered into a full bowl of water: the silver bar pushes out more water (a measuring jug fills higher). | "A gold bar and a silver bar weigh the same. Which pushes out more water?" ✓ "The silver bar, because it is bigger" / "The gold bar" / "Both the same" |
| The crown test | The crown and a gold bar of the same weight are lowered into two full bowls. The crown pushes out more water than the gold bar: it must be bigger, so lighter metal is mixed in. The goldsmith is caught! | "The crown spilled more water than pure gold of the same weight. What does that mean?" ✓ "It isn't pure gold: lighter metal is mixed in" / "It is extra-pure gold" / "The water was dirty" |

Try it: "Now you try!" and she solves the water quest; the water pump building
rises. Level 4 keeps "volume", "pushed aside" and "lighter for its size"
(density without the word). Level 1 keeps the story ("the crown made more
water spill, so it was not all gold").

---

## Chapter 3: Rocket Village (`src/game/`, `src/gameScene.js`)

### 3A. Push back, go forward (before Step 7: Engine Thrust)

| Film | Animation | Question |
|---|---|---|
| The balloon | A blown-up balloon is let go: air rushes out the back (puffs), the balloon zooms forward. Arrows: air back, balloon forward. | "When the air rushes out the back, which way does the balloon go?" ✓ "Forward, the opposite way" / "Backward with the air" / "Straight down" |
| The skater | A child on a skateboard throws a heavy ball forward: they roll backward. | "Mia throws a ball forward from her skateboard. What happens to her?" ✓ "She rolls backward" / "She rolls forward" / "She stays still" |
| The rocket | A rocket on the pad: hot gas blasts down out of the nozzle, the rocket rises. Big arrows: gas down, rocket up ("action and reaction"). | "How does a rocket go up?" ✓ "It pushes hot gas down, and the gas pushes it up" / "It floats like a balloon" / "Wind lifts it" |

### 3B. Heavy rockets need big pushes (before Mass on the Pad / Heavy or Light?)

| Film | Animation | Question |
|---|---|---|
| Thrust vs. weight | A rocket on the pad with two arrows: weight (down, grey) and thrust (up, orange). The engine throttles up: thrust grows; when it passes weight, lift-off. | "When does the rocket lift off?" ✓ "When the push up is bigger than its weight" / "As soon as the engine starts" / "When it's lighter than air" |
| More fuel, more weight | Fill the tanks: the weight arrow grows; the same engine now can't lift it until a bigger engine is fitted. | "You add a lot more fuel. What does the rocket need?" ✓ "A stronger push to lift off" / "Nothing changes" / "A smaller engine" |
| Stages | A two-stage rocket climbs; the empty bottom stage drops away; the rocket (now lighter) speeds up more with the same engine. | "Why do rockets drop empty stages?" ✓ "Lighter rockets speed up more" / "To look cool" / "To slow down" |

### 3C. Slipping through the air (before Step 6: Wind Tunnel / Slipping Through the Wind)

| Film | Animation | Question |
|---|---|---|
| Flat vs. pointy | A wind tunnel: air lines hit a flat board and pile up (swirls, red); around a pointed nose they bend smoothly (blue). A "drag" bar is high for the board, low for the nose. | "Which shape lets the air slip past most easily?" ✓ "The pointed nose" / "The flat board" / "Both the same" |
| Same push, different speed | Two carts with the same engine: a box-shaped one and a pointed one race; the pointed one wins. | "Same engine, different shapes. Which goes faster?" ✓ "The pointed one, less air pushing back" / "The box one" / "They tie" |
| Why rockets are pointy | A rocket climbing with streamlines around its nose cone. | "Why do rockets have pointed nose cones?" ✓ "To cut through the air with less push back" / "To pop balloons" / "To hold more fuel" |

### 3D. Steering with fins (before Step 9: Guidance Turns / Steering Fin Turn)

| Film | Animation | Question |
|---|---|---|
| Darts | A dart with feathers flies straight; one without tumbles. | "Why does the dart with feathers fly straight?" ✓ "The fins keep its back end behind it" / "It's heavier" / "It's faster" |
| Tilt a fin | A rocket's rear fin tilts; air pushes on it (arrow) and the rocket's nose swings the other way. | "The tail fin pushes the back of the rocket right. Which way does the nose turn?" ✓ "Left" / "Right" / "It doesn't turn" |
| Steering a turn | The rocket follows a curve, fins flicking little by little. | "How does a rocket steer in the air?" ✓ "Small fin tilts, a bit at a time" / "Big jerks of the whole rocket" / "It can't steer" |

### 3E. Liquid to gas (optional; before Liquid to Gas / Fuel Mixture)

Films: water heating in a pot, bubbles and steam taking far more space; fuel +
oxygen burning into hot gas; the gas rushing out of the nozzle. Questions: "What
happens to water when you heat it a lot?" ✓ "It turns into steam (a gas)";
"What two things does rocket fuel need to burn?" ✓ "Fuel and oxygen"; "Why does
hot gas push the rocket?" ✓ "It takes up much more room and rushes out".

---

## Chapter 4: Voyage to Europa (`src/space/`)

### 4A. Flight School: orbit transfers (DONE: a1_lesson)

Built (`src/space/lesson/`): straight at the Moon misses, push along your path,
why wait for the window, point backwards to be caught. Port onto the engine.

### 4B. Landing on the Moon (before a2_capture -> a2_land)

| Film | Animation | Question |
|---|---|---|
| Weaker pull | Side by side: a child jumps on Earth and on the Moon; on the Moon she floats 6x higher and lands slowly (height marks). | "Why does she jump so high on the Moon?" ✓ "The Moon's pull is much weaker" / "The Moon is bouncy" / "She ate breakfast" |
| No air, no parachute | A parachute opens over Earth (slows down); the same over the Moon flops (no air). Then the ship points against its motion and the engine brakes. | "How do we slow down above the Moon?" ✓ "Fire the engine against our motion" / "Open a parachute" / "Flap the wings" |
| Gently, not stopped | Two landings: one brakes to a hover and burns fuel for a long time (fuel bar drains); one brakes to a slow fall and touches down softly. | "What's the best way to land?" ✓ "Brake to a slow fall, then touch down" / "Stop and hover as long as you can" / "Fall fast and brake at the end" |

### 4C. The slingshot (before moonSlingshot / the Mars departure)

| Film | Animation | Question |
|---|---|---|
| Ball off a train | A ball thrown at the front of a moving train bounces back faster than it came. | "The ball bounces off the moving train. Is it faster or slower after?" ✓ "Faster, it gets some of the train's speed" / "Slower" / "The same" |
| Swing past the Moon | The ship swings close behind the moving Moon; its speed arrow grows as it leaves (the Moon slows by a too-tiny-to-see amount). | "How does flying past the Moon speed the ship up?" ✓ "It borrows a little of the Moon's motion" / "The Moon pushes with air" / "It doesn't" |
| Free speed | Two trips to Mars: one burns more fuel, the slingshot one uses less (fuel bars). | "Why do space missions use slingshots?" ✓ "Free speed means less fuel" / "To see the Moon up close" / "They're required by law" |

### 4D. Sunlight gets weaker far away (before powerDropping / buildSolarWings)

| Film | Animation | Question |
|---|---|---|
| The lamp and the squares | A lamp shines through a frame onto a wall of squares: at 1 step it lights 1 square brightly; at 2 steps the same light spreads over 4 squares, each dimmer. | "Twice as far from the lamp, the light covers 4 squares. Is each square brighter or dimmer?" ✓ "Dimmer, the light is spread out" / "Brighter" / "The same" |
| Power on the way out | The ship flies Earth -> Mars -> the belt -> Jupiter; its power bar drops (the game's real numbers: about 100%, 43%, 17%, 4%). | "Why does the ship make less power near Jupiter?" ✓ "Sunlight is much weaker out there" / "Jupiter blocks the Sun" / "The panels got dirty" |
| Bigger wings | Small wings vs. Big Solar Wings far from the Sun: more panel catches more light; the bar rises again. | "How do we get more power far from the Sun?" ✓ "Bigger solar wings" / "Paint the ship" / "Fly faster" |

### 4E. Jupiter's radiation and the shield (before a4_radiation_warning)

| Film | Animation | Question |
|---|---|---|
| Invisible belts | Jupiter's magnetic field lines (loops) trap glowing fast particles that zip around in belts. | "What makes Jupiter's space dangerous?" ✓ "Fast particles trapped around it" / "Lots of rain" / "Its loud noise" |
| The shield | Particles hit a bare hull (sparks, red) vs. a hull with a metal + ice layer (particles stop in it). | "What does the Radiation Shield do?" ✓ "Soaks up the fast particles" / "Makes the ship invisible" / "Speeds the ship up" |
| Stay outside the worst | The slingshot path curves outside the brightest belt. | "Why does our path stay outside the brightest belt?" ✓ "To get less radiation" / "Because it's prettier" / "To save time" |

### 4F. Europa's hidden ocean (before the Europa walk / drillResult)

| Film | Animation | Question |
|---|---|---|
| Squeeze and stretch | Europa orbits Jupiter on a slightly oval path; up close it gets stretched, farther away it relaxes (shape exaggerated, a "squeeze" meter). | "What does Jupiter's pull do to Europa?" ✓ "Squeezes and stretches it" / "Nothing" / "Spins it like a top" |
| Squeezing makes heat | A ball of putty squeezed again and again warms up (colour shift). Inside Europa the warm layer keeps water liquid under the ice. | "Why isn't Europa's ocean frozen solid?" ✓ "Squeezing makes heat inside" / "The Sun is very hot there" / "It has volcanoes of lava" |
| Cracks and plumes | Water pushes up through cracks in the ice and sprays out as plumes. | "Why do we drill at a crack?" ✓ "The ocean is closest there" / "Cracks are softer to walk on" / "It's the coldest spot" |

### 4G. What makes something alive? (BUILT, step a5_lesson: after landing on Europa, before the drill)

Lead, 2026-10-05: Chapter 4's second lesson, biology near Europa: cells, DNA, proteins. What the drill is looking for.

| Film | Animation | Question |
|---|---|---|
| Made of cells | A lens zooms from a tree into a leaf: a wobbling honeycomb of cells with nuclei and drifting parts; one cell (ringed in gold) stretches, pinches and splits into two. | "What are all living things made of?" ✓ "Tiny living units called cells" |
| DNA: the recipe | Into the nucleus: a rotating double helix with coloured A/T/G/C rungs, the letters read out; then it unzips and each half is copied into two ladders. | "What does DNA do?" ✓ "It holds the instructions for building the living thing" |
| Proteins: tiny machines | A builder slides along a copy of the recipe, adding one coloured bead every 3 letters; the chain folds into a mouth-shaped protein that chomps a sugar in two. | "How does a cell build a protein?" ✓ "It follows DNA's recipe, joining beads in order" |

---

## Chapter 5: Rings to a Star (`src/space/ch5/`, BUILT 2026-10-05)

Lead's rule: Chapters 5-6 may have 3-4 lessons. All four play on the lesson card with `lessonOnce(lesson, { bus: game.bus })`. Files: `src/lesson/lessons/ch5.js` (5A, 5AA), `ch5b.js` (5B), `ch5c.js` (5C). New card features: `predict` beats (the film stops, "▶ Show me" plays on) and `watchOnly` films (no question).

### 5A. What are Saturn's rings? (step c5_lesson_rings, after the hexagon pass)

| Film | Question |
|---|---|
| Up close: the rings are billions of ice pieces | "What are Saturn's rings made of?" |
| Little moons: inner pieces lap the outer ones | "Which pieces of the rings go round Saturn fastest?" |
| How a ring is born: a moon too close is pulled apart | "Why is there a ring there, and not one big moon?" |

### 5AA. Bumps in the rings: momentum (step c5_lesson_momentum, after the ring run)

| Film | Question |
|---|---|
| Same size, one still (predict pause) | "A moving chunk hits a still chunk the same size, head on. What happens?" |
| Small and big, both ways (momentum bars) | "A big chunk crashes into a small still chunk. What happens to the small one?" |
| Catching up and sticking | "A fast chunk catches a slow one and they stick together. How fast do they go?" |
| Lots of pieces (watch only: the total stays the same) | none |
| Pushing on nothing: a rocket throws gas back | "In empty space there is nothing to push against. How does a rocket speed up?" |

### 5B. Neptune (step c5_neptune_pause)

| Film | Question |
|---|---|
| How big? (Earths side by side) | "About how many Earths would fit side by side across Neptune?" (about 4) |
| Heavy, but not crushing (17 x the mass, about Earth's pull at the cloud tops) | "How heavy would you feel on its cloud tops?" |
| So cold the atoms crawl | "What does 'cold' mean for the tiny atoms inside something?" |

### 5C. Atoms and fusion (step c5_lesson_fusion, before designing the ship)

| Film | Question |
|---|---|
| Zoom into you (hand, cell, DNA, atoms) | "Zoom into your hand far enough and what do you find in the end?" |
| Zoom into ice (crystal, molecule, H2O) | "What is one water molecule made of?" |
| Inside an atom (protons, neutrons, electrons) | "What are all atoms made of?" |
| Protons smash together (fusion) | "Where does the energy from fusion come from?" |
| The Sun against a coal Sun (a few thousand years) | "If the Sun were a giant lump of burning coal, about how long would it shine?" |

Chapter 6 (planned): 6A tiny-Earth loop, 6B slingshot, 6C light speed.

---

## Optional, later

Good lessons that aren't in the first set. Each keeps its films and questions
for when there's time.

### O1. Counting in groups (Chapter 1) (before Medium Puzzle 1: Wood Carts / Pattern Garden)

| Film | Animation | Question |
|---|---|---|
| Carts of logs | Three carts roll in, each with 3 logs. First the logs light up one at a time ("1, 2, 3 ... 9"), slowly. Then each cart lights up as a block: "3, 6, 9", fast. A stopwatch shows the second way is quicker. | "4 carts each carry 3 logs. What's the fastest way to count them?" ✓ "Count by 3s: 3, 6, 9, 12" / "Count every log one by one" / "Guess by looking" |
| Rows of stones | Stones drop into a grid, row by row: 2 rows of 5. A row counter and a column counter tick. The total pops up as "2 x 5 = 10". Then the grid turns sideways: "5 x 2 = 10, same stones". | "A wall has 3 rows of 4 stones. How many stones?" ✓ "12" / "7" / "10" |
| The growing garden | A flower bed grows +2 flowers each day (day 1: 1, day 2: 3, day 3: 5 ...). A day counter steps forward; a "+2" badge jumps between days. It pauses on day 4 and asks. | "Day 1: 1 flower, day 2: 3, day 3: 5. How many on day 5?" ✓ "9" / "7" / "10" (explain: +2 each day: 5, 7, 9) |

### O2. Pushes and pulls (Chapter 1) (before Science Lab: Force Direction / Easy Force Idea)

| Film | Animation | Question |
|---|---|---|
| Push and it moves | Side view. A child pushes a cart: an orange force arrow points right, the cart rolls right. A bigger arrow (harder push) makes it roll faster (speed lines). | "Which way does the cart roll when you push it to the right?" ✓ "To the right" / "To the left" / "It stays still" |
| Tug of war | Two children push a box from opposite sides with equal arrows: the box doesn't move ("balanced"). One arrow grows: the box slides toward the smaller arrow's side ("unbalanced"). | "Two friends push a box from opposite sides. Mia pushes harder. Which way does it move?" ✓ "Away from Mia, toward her friend" / "Toward Mia" / "It doesn't move" |
| Rough and smooth | The same push on grass, then on ice. On grass the cart stops quickly (friction arrow, little dust); on ice it glides far. | "The same push on ice and on grass. Where does the cart go farther?" ✓ "On ice, less friction" / "On grass" / "The same everywhere" |

### O3. Light makes food (Chapter 1) (before Science Lab: Light and Plants)

| Film | Animation | Question |
|

### O4. Seesaws and balance (Chapter 2) (before Balance Scale Blueprint Lock / Hard Quest)

| Film | Animation | Question |
|---|---|---|
| Even seesaw | Two children of the same size sit at the ends of a seesaw: it balances level. One child stands up and walks to the middle: their end rises. | "Two same-size kids sit at the two ends. What happens?" ✓ "The seesaw stays level" / "It tips to the left" / "It spins round" |
| Big and small | A big child and a small child at the two ends: the big side drops. The big child slides toward the middle: the seesaw comes level again. A "weight x distance" scale appears: 2 blocks at 2 steps = 4 blocks at 1 step. | "A big kid and a small kid. How can they balance?" ✓ "The big kid sits closer to the middle" / "The small kid sits closer to the middle" / "They can't ever balance" |
| The balance scale | A pan balance: 3 apples on the left, 1 melon on the right, level. Then a question puzzle: 2 melons on the left and how many apples on the right? The apples drop in one at a time until it's level. | "1 melon balances 3 apples. How many apples balance 2 melons?" ✓ "6" / "5" / "3" |

### O5. Why water towers are tall (Chapter 2) (before Water Tower Pattern / Water Wheel Drops / the water pump)

| Film | Animation | Question |
|---|---|---|
| Water runs downhill | Side view of a hill with a pond on top and a house at the bottom: water flows down a pipe to the house. Swap them (pond low, house high): the water won't climb. | "Which way does water flow by itself in a pipe?" ✓ "Downhill, from high to low" / "Uphill" / "It doesn't move at all" |
| Higher = stronger squirt | A tall tank with three holes at different heights: the jet from the bottom hole shoots farthest, the top one dribbles. Labels: "more water above = more push". | "Which hole squirts water the farthest?" ✓ "The lowest hole, it has the most water above it" / "The top hole" / "All the same" |
| The water tower | The city's tower on stilts with pipes to houses. A pump lifts water up at night; in the morning taps open and water rushes out to the top floor of a house. A short tower: the top floor gets only a trickle. | "Why is the water tower built so high?" ✓ "So the water has enough push to reach every tap" / "So birds can't drink it" / "So it stays cold" |

### O6. Shadows and the Sun (Chapter 2; parts of it live on in 1B) (before Solar Shadow Lab)

| Film | Animation | Question |
|---|---|---|
| A day of shadows | Time-lapse: the Sun arcs across the sky over a post. The shadow is long in the morning (pointing away from the Sun), short at noon, long again in the evening, on the other side. A clock in the corner. | "When is the post's shadow shortest?" ✓ "At noon, when the Sun is highest" / "In the morning" / "At sunset" |
| Away from the light | A lamp is moved around a toy figure: the shadow always swings to the side away from the lamp. | "The Sun is in the east. Where does the shadow point?" ✓ "West, away from the Sun" / "East, toward the Sun" / "Straight up" |
| Tilt to the Sun | A solar panel lying flat vs. tilted to face the Sun: light rays (arrows) hit the tilted one squarely; a power bar fills more. | "How should a solar panel face to catch the most light?" ✓ "Turned toward the Sun" / "Lying flat on the ground" / "Facing away" |

### O7. Newton's apple (Chapter 2; already in the game as a dialogue side story)

Already a dialogue side story (`src/city/newtonTree.js`). Later as films: (1) an
apple falls (it speeds up: dots get farther apart), (2) heavy and light apples
land together, (3) the Moon "falls" round Earth because it moves sideways so
fast. Questions as in the current story.

---

## How each lesson is built (checklist per lesson)

1. Script: 3 films, captions (Level 4 and Level 1), one question per film with
   3 balanced choices, a hint for the first miss and a kind explanation; check
   the science.
2. Films on `src/lesson/draw.js`; physically plausible but schematic; labels
   never overlap (scale with the canvas; hide secondary labels in the small
   question-view canvas).
3. Hook into the chapter: trigger station / step, seen flag, pause the game,
   "Now you try!" then the real task. Easy autopilot / the villages' play modes
   wait for the card.
4. Test: open it from the console, LOOK at a frame of every film and the
   question card at 1366x768 and 1024x768, both Levels; the hidden-tab clock
   still plays; `window.__lesson.answerAll()` gets automated runs through;
   the chapter test scripts still pass.

## Order and size

| Order | Work | Size |
|---|---|---|
| 1 | Shared engine + port Flight School | M |
| 2 | Chapter 3: Push back go forward (3A), Heavy rockets (3B) | M |
| 3 | Chapter 2: Triangles (2A), Archimedes and the crown (2B) | M |
| 4 | Chapter 4: Landing on the Moon (4B), Sunlight gets weaker (4D) | M |
| 5 | Chapter 1: The round Earth (1A), Eratosthenes measures the Earth (1B) | M |
| 6 | The rest (3C, 3D, 3E, 4C, 4E, 4F) + the "📖 Lessons" replay list | L |
| later | Optional O1-O7 | - |
