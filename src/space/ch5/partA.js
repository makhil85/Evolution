// Chapter 5, Part A: leave Jupiter and fly to Saturn.
// See missions.js for the step format.
import { BODIES } from '../contracts.js';
import { fuelSafetyNet, isCaptured, orbitFor } from '../acts/util.js';
import { playPolePass } from './saturnPole.js';
import { t } from '../level.js';
import { lineUpOnce } from './lineup.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_5A, LESSON_5AA } from '../../lesson/lessons/ch5.js';
import { buildRingRun } from './ringRun.js';
import { LEVELS } from './ringRunLogic.js';

/**
 * The ring run: each level has an ice and rock goal (lead 2026-10-08).
 * Short of it she plays again (she may pick an easier level); once it is
 * met she can fly on or play again. Its water is kept in the stats.
 */
async function playRingRun(game) {
  const { hud } = game;
  let level = game.mode?.id === 'hard' ? 'medium' : 'easy';
  for (;;) {
    const pick = await hud.choose({
      eyebrow: t('Ring run', 'Ring run'),
      title: t('How thick is the ice?', 'How much ice?'),
      body: t('Arrows or WASD steer, Space fires. Line up on white ice (water) and grey rock (metal and stone). A bump jams your gun for a moment, and big rocks need a true aim.', 'Arrows to steer. Space to shoot. Line up on the ice and rock. A bump jams your gun.'),
      options: Object.values(LEVELS).map((L) => ({
        id: L.id, label: L.label, tag: L.id === level ? t('Suggested', 'Try this') : '',
        blurb: `${L.blurb} ${t(`Goal: ${L.goal.ice} ice, ${L.goal.rock} rock.`, `Get ${L.goal.ice} ice, ${L.goal.rock} rock.`)}`,
      })),
      current: level,
    });
    level = pick || level;
    const res = await game.runScene(buildRingRun(game, { level, seed: Math.floor(Math.random() * 1e6) }));
    const st = (game.stats = game.stats || {});
    st.water = (st.water || 0) + res.water;
    st.ringRun = { ...(st.ringRun || {}), [level]: Math.max(res.water, st.ringRun?.[level] || 0) };
    game.missions?.save();
    if (!res.met) {
      // An easier level exists only below the one she just played.
      const easier = Object.keys(LEVELS).indexOf(level) > 0;
      await hud.showFact({
        title: t('Not enough yet!', 'Not enough yet!'),
        body: t(`You got ${res.ice} of ${res.goal.ice} ice and ${res.rock} of ${res.goal.rock} rock. Fly the ring again: line up on a chunk before you fire.${easier ? ' You can pick an easier level too.' : ''}`,
          `You got ${res.ice} of ${res.goal.ice} ice and ${res.rock} of ${res.goal.rock} rock. Try again!`),
      });
      continue;
    }
    await hud.showFact({
      title: t(`Goal reached! 🧊 ${res.ice} ice, 🪨 ${res.rock} rock`, `You did it! 🧊 ${res.ice} ice, 🪨 ${res.rock} rock`),
      body: t(`Your ice makes ${res.water} water points for the trip, and the rock is metal and stone for repairs. You bumped into ${res.bumps}. In real rings the chunks are much more spread out, usually metres apart: we packed them close to make the game.`,
        `Your ice makes ${res.water} water! The rock is for fixing the ship. Real rings have more space between the chunks.`),
    });
    const again = await hud.choose({
      title: t('Another go?', 'Play again?'),
      options: [{ id: 'on', label: t('Fly on', 'Go on') }, { id: 'again', label: t('Play again', 'Play again') }],
      current: 'on',
    });
    if (again !== 'again') return res;
  }
}

export function partASteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c5_start', act: 1,
      title: t('Next stop: Saturn', 'Off to Saturn'),
      objective: '',
      markers: ['saturn'],
      async enter() {
        game.target = 'saturn';
        await hud.showDialogue([
          { who: 'Mission Control', text: t('Europa’s ice sample is safe on board. Saturn is next: the planet with the rings.', 'Your Europa ice is safe. Next stop: Saturn, the planet with rings!') },
          { who: 'girl', text: 'Rings, here I come!' },
        ]);
      },
    },
    {
      id: 'c5_leave_jupiter', act: 1,
      title: t('Leave Jupiter', 'Leave Jupiter'),
      objective: t('Follow the arrow: fly the same way Jupiter is moving and hold Space until your path breaks free of Jupiter’s pull.', 'Follow the arrow and hold Space to leave Jupiter.'),
      // No marker on the next planet while she leaves: it is lined up only
      // once she is out (lineup.js), and a distance shown before that jumped
      // the moment she escaped, as if her burn had been ignored (lead, 2026-10-06).
      markers: [],
      aim: 'with-body',
      escape: true,
      enter() { game.target = 'saturn'; },
      check() {
        fuelSafetyNet(game);
        return game.ship.soi === 'sun';
      },
    },
    {
      id: 'c5_to_saturn', act: 1,
      title: t('Catch the Saturn window', 'Head for Saturn'),
      objective: t('Saturn moves too! Use time warp (1-4) until the banner says BURN NOW, then point along your path and hold Space until your dotted line reaches Saturn.', 'Wait for the green BURN NOW sign (keys 1 to 4 make time go fast). Then hold Space until your dotted line reaches Saturn.'),
      markers: ['saturn'],
      aim: 'prograde',
      transfer: 'saturn',
      async enter() {
        game.target = 'saturn';
        // Saturn is a dot far away: line it up now, under Mission Control's line.
        if (lineUpOnce(game.ship, 'saturn')) { game.replan?.(); game.missions?.save(); }
        await hud.showDialogue([
          { who: 'Mission Control', text: t('Out of Jupiter’s pull! We’ve worked out your path to Saturn. Wait for BURN NOW.', 'You left Jupiter! Wait for the green BURN NOW sign.') },
        ]);
      },
      check() {
        fuelSafetyNet(game);
        // Fell back into Jupiter's pull (left too slowly): leave it again.
        if (game.ship.soi === 'jupiter') { game.missions?.jump('c5_leave_jupiter'); return false; }
        const c = game.prediction?.closest;
        return game.ship.soi === 'saturn' || (!!c && c.body === 'saturn' && !c.retro && c.dist < BODIES.saturn.soi * 0.6);
      },
      // On course: a long coast to think about the planet ahead.
      beat: 'c5SaturnSize',
    },
    {
      id: 'c5_saturn_approach', act: 1,
      title: t('Coast to Saturn', 'Fly to Saturn'),
      objective: t('Coast to Saturn. Time warp (1-4) makes the long trip quick. If the banner asks for a small burn, it is fine-tuning your path.', 'Fly to Saturn and wait. Keys 1 to 4 make time go fast.'),
      markers: ['saturn'],
      transfer: 'saturn',
      aim: 'prograde',
      enter() { game.target = 'saturn'; },
      check() {
        fuelSafetyNet(game);
        return game.ship.soi === 'saturn';
      },
    },
    {
      id: 'c5_saturn_orbit', act: 1,
      title: t('Let Saturn catch you', 'Go around Saturn'),
      objective: t('Brake at your lowest point (follow the banner) so Saturn’s gravity catches you in orbit, outside the rings.', 'Slow down when the sign says, so Saturn catches you.'),
      markers: ['saturn'],
      aim: 'retrograde',
      capture: 'saturn',
      enter() { game.target = 'saturn'; },
      check() {
        fuelSafetyNet(game);
        return game.ship.soi === 'saturn' && isCaptured(game);
      },
      async after() {
        hud.toast(t('Saturn has you! Enjoy a lap: look at those rings.', 'You’re going around Saturn! Look at the rings!'), { kind: 'good', ms: 4200 });
        // The capture is done (ticked off), so the card stops saying "brake"
        // during the lap (game-experience review: a stale objective).
        game.missions?.showObjective?.(t('Captured! Look round Saturn while you orbit.', 'You did it! Look at Saturn.'), { done: true });
        // A calm lap before the pole (lead 2026-10-08): 20 s of orbit, or
        // one whole lap if that is quicker.
        await orbitFor(game, 20);
      },
    },
    {
      id: 'c5_hexagon', act: 1,
      title: t('Over Saturn’s north pole', 'Fly over the top of Saturn'),
      objective: '',
      markers: ['saturn'],
      async enter() {
        await hud.showDialogue([
          { who: 'Mission Control', text: t('Something strange sits on Saturn’s north pole. Take a look from above!', 'Something strange is on top of Saturn. Go and look!') },
        ]);
        await playPolePass(game);
        await hud.showFact({
          title: t('A six-sided storm', 'A storm with 6 sides'),
          body: t('Saturn’s north pole has a storm shaped like a hexagon. A fast jet stream of wind (over 300 km an hour) runs round the pole in a wavy loop with six bends, so it makes six straight-ish sides. Each side is longer than Earth is wide. It has been there for over 40 years.',
            'On top of Saturn is a storm with 6 sides. Fast wind goes round and round in a loop with 6 bends. Each side is longer than Earth is wide!'),
        });
      },
      beat: 'c5Hexagon',
    },
    // Lesson 5A (the rings), then the ring run, then lesson 5AA (the bumps).
    // No check(): each is done when enter() settles.
    {
      id: 'c5_lesson_rings', act: 1,
      title: t('What are the rings?', 'What are the rings?'),
      objective: t('Watch Mission Control’s lesson on Saturn’s rings and answer a question after each film.', 'Watch the lesson about the rings.'),
      markers: ['saturn'],
      async enter() { await lessonOnce(LESSON_5A, { bus: game.bus }); },
    },
    {
      id: 'c5_ring_run', act: 1,
      title: t('Ring run', 'Ring run'),
      objective: t('Fly through the rings: blast ice and rock until you have the goal, and dodge what you can’t break in time.', 'Fly through the rings! Shoot ice and rock.'),
      markers: ['saturn'],
      async enter() {
        await hud.showDialogue([
          { who: 'Mission Control', text: t('We need water for the long trip ahead, and the rings are made of it. Fly in and blast some ice!', 'We need water for the trip. The rings are made of ice. Go and get some!') },
          { who: 'girl', text: t('Shields up. In I go!', 'Here I go!') },
        ]);
        await playRingRun(game);
      },
    },
    {
      id: 'c5_lesson_momentum', act: 1,
      title: t('Bumps in the rings', 'Bumps in the rings'),
      objective: t('Every time you fired, the ship was kicked back a little. Watch why, and answer a question after the films.', 'Why did the ship jump back when you shot? Watch and find out.'),
      markers: ['saturn'],
      async enter() { await lessonOnce(LESSON_5AA, { bus: game.bus }); },
    },
  ];
}
