// Chapter 5, Part B: the ice giants (Uranus, Neptune), then out to the edge
// of the Sun's family. See missions.js for the step format.
//
// Each planet is a stop in orbit, like Saturn: flybys out here throw her onto
// orbits that leave the Sun for good, so she brakes into orbit at each one,
// takes a look, and leaves again with the next planet lined up (lineup.js).
import { BODIES } from '../contracts.js';
import { fuelSafetyNet, isCaptured, orbitFor } from '../acts/util.js';
import { t } from '../level.js';
import { lineUpOnce } from './lineup.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_5B } from '../../lesson/lessons/ch5b.js';
import { playPool } from './pool.js';
import { playEdgePullBack } from './edge.js';
import { KUIPER } from './kuiper.js';

/**
 * The four steps of one leg: leave `from`, catch the window to `to`, coast
 * there, brake into orbit. `say` is Mission Control's line once she is out
 * of `from`'s pull; `beat` is asked on the long coast.
 */
function legSteps(game, { from, to, act, say, beat, ids }) {
  const { hud } = game;
  const From = BODIES[from].name; const To = BODIES[to].name;
  return [
    {
      id: ids.leave, act,
      title: t(`Leave ${From}`, `Leave ${From}`),
      objective: t(`Follow the arrow: fly the same way ${From} is moving and hold Space until your path breaks free of ${From}’s pull.`, `Follow the arrow and hold Space to leave ${From}.`),
      // No marker on the next planet while she leaves: it is lined up only
      // once she is out (lineup.js), and a distance shown before that jumped
      // the moment she escaped, as if her burn had been ignored (lead, 2026-10-06).
      markers: [],
      aim: 'with-body',
      escape: true,
      enter() { game.target = to; },
      check() {
        fuelSafetyNet(game);
        return game.ship.soi === 'sun';
      },
    },
    {
      id: ids.window, act,
      title: t(`Catch the ${To} window`, `Head for ${To}`),
      objective: t(`Use time warp (1-4) until the banner says BURN NOW, then point along your path and hold Space until your dotted line reaches ${To}.`, `Wait for the green BURN NOW sign (keys 1 to 4 make time go fast). Then hold Space until your dotted line reaches ${To}.`),
      markers: [to],
      aim: 'prograde',
      transfer: to,
      async enter() {
        game.target = to;
        if (lineUpOnce(game.ship, to)) { game.replan?.(); game.missions?.save(); }
        await hud.showDialogue([{ who: 'Mission Control', text: say }]);
      },
      check() {
        fuelSafetyNet(game);
        if (game.ship.soi === from) { game.missions?.jump(ids.leave); return false; }
        const c = game.prediction?.closest;
        return game.ship.soi === to || (!!c && c.body === to && !c.retro && c.dist < BODIES[to].soi * 0.6);
      },
      beat,
    },
    {
      id: ids.coast, act,
      title: t(`Coast to ${To}`, `Fly to ${To}`),
      objective: t(`Coast to ${To}. Time warp (1-4) makes the long trip quick. If the banner asks for a small burn, it is fine-tuning your path.`, `Fly to ${To} and wait. Keys 1 to 4 make time go fast.`),
      markers: [to],
      transfer: to,
      aim: 'prograde',
      enter() { game.target = to; },
      check() {
        fuelSafetyNet(game);
        return game.ship.soi === to;
      },
    },
    {
      id: ids.orbit, act,
      title: t(`Let ${To} catch you`, `Go around ${To}`),
      objective: t(`Brake at your lowest point (follow the banner) so ${To}’s gravity catches you in orbit.`, `Slow down when the sign says, so ${To} catches you.`),
      markers: [to],
      aim: 'retrograde',
      capture: to,
      enter() { game.target = to; },
      check() {
        fuelSafetyNet(game);
        return game.ship.soi === to && isCaptured(game);
      },
    },
  ];
}

export function partBSteps(game) {
  const { hud } = game;
  return [
    ...legSteps(game, {
      from: 'saturn', to: 'uranus', act: 2,
      ids: { leave: 'c5_leave_saturn', window: 'c5_to_uranus', coast: 'c5_uranus_approach', orbit: 'c5_uranus_orbit' },
      say: t('Out of Saturn’s pull, with the water tanks full! Uranus is next: the planet that rolls round the Sun on its side. Wait for BURN NOW.', 'You left Saturn! Next stop: Uranus. Wait for the green BURN NOW sign.'),
      // The "knocked over" question is asked on the look step, after the wait
      // (lead 2026-10-08: let the kid see Uranus first).
      beat: null,
    }),
    {
      id: 'c5_uranus_look', act: 2,
      title: t('Uranus, on its side', 'Uranus is on its side'),
      objective: t('Captured! Look round Uranus while you orbit.', 'You did it! Look at Uranus.'),
      markers: ['uranus'],
      async enter() {
        hud.toast(t('Uranus has you! Look how it is tipped right over.', 'You’re going around Uranus! It is lying on its side!'), { kind: 'good', ms: 3600 });
        // Time to look before the fact and the question (lead 2026-10-08).
        await orbitFor(game, 25, { lap: false });
        await hud.showFact({
          title: t('A planet lying on its side', 'A planet on its side'),
          body: t('Most planets spin standing up, like a top. Uranus spins lying on its side, so it rolls round the Sun like a ball. For part of its long year one pole points straight at the Sun, and the other pole is in the dark the whole time.',
            'Uranus spins lying down. So it rolls round the Sun like a ball. One side gets sun for a long time, and the other side is dark.'),
        });
      },
      // Knocked over (25 s after she arrived), then the pole's day (after the fact).
      beat: 'c5UranusTilt',
      bonusBeats: ['c5UranusPoleDay'],
    },
    ...legSteps(game, {
      from: 'uranus', to: 'neptune', act: 2,
      ids: { leave: 'c5_leave_uranus', window: 'c5_to_neptune', coast: 'c5_neptune_approach', orbit: 'c5_neptune_orbit' },
      say: t('Free of Uranus! Neptune is the last big planet, and the furthest. Sunlight takes hours to get there. Wait for BURN NOW.', 'You left Uranus! Next: Neptune, the last big planet. Wait for the green BURN NOW sign.'),
      beat: 'c5SunlightToNeptune',
    }),
    // Neptune: a pause to look (lesson 5B), then how it was found.
    {
      id: 'c5_neptune_pause', act: 2,
      title: t('Neptune, the blue giant', 'Neptune'),
      objective: t('Watch Mission Control’s lesson on Neptune and answer a question after each film.', 'Watch the lesson about Neptune.'),
      markers: ['neptune'],
      async enter() {
        await hud.showDialogue([
          { who: 'Mission Control', text: t('You are the first person ever to see Neptune up close. Stop the engines for a minute and look.', 'You are the first person to see Neptune up close! Stop and look.') },
          { who: 'girl', text: t('It is SO blue. And it is huge!', 'It is so blue!') },
        ]);
        await lessonOnce(LESSON_5B, { bus: game.bus });
      },
      beat: 'c5Neptune1846',
    },

    // Part B, the edge: out into the Kuiper belt (space pool on the way), past
    // Pluto, then the camera pulls right back to show the whole family.
    {
      id: 'c5_leave_neptune', act: 3,
      title: t('Leave Neptune', 'Leave Neptune'),
      objective: t('Follow the arrow: fly the same way Neptune is moving and hold Space until your path breaks free of its pull.', 'Follow the arrow and hold Space to leave Neptune.'),
      // No marker on the next planet while she leaves: it is lined up only
      // once she is out (lineup.js), and a distance shown before that jumped
      // the moment she escaped, as if her burn had been ignored (lead, 2026-10-06).
      markers: [],
      aim: 'with-body',
      escape: true,
      enter() { game.target = 'pluto'; },
      check() {
        fuelSafetyNet(game);
        return game.ship.soi === 'sun';
      },
    },
    {
      id: 'c5_to_pluto', act: 3,
      title: t('Catch the Pluto window', 'Head for Pluto'),
      objective: t('Pluto is small and far: wait for BURN NOW, then hold Space until your dotted line passes close to Pluto. Let go of the controls to cruise faster.', 'Wait for the green BURN NOW sign. Then hold Space until your dotted line reaches Pluto. Let go of the keys to go fast.'),
      markers: ['pluto'],
      aim: 'prograde',
      transfer: 'pluto',
      async enter() {
        game.target = 'pluto';
        if (lineUpOnce(game.ship, 'pluto')) { game.replan?.(); game.missions?.save(); }
        await hud.showDialogue([
          { who: 'Mission Control', text: t('Past Neptune there are no more big planets, just a huge ring of icy rocks: the Kuiper belt. Pluto lives there. Let’s fly past it!', 'No more big planets now. Just lots of icy rocks. Pluto lives here. Let’s go and see it!') },
        ]);
      },
      check() {
        fuelSafetyNet(game);
        if (game.ship.soi === 'neptune') { game.missions?.jump('c5_leave_neptune'); return false; }
        const c = game.prediction?.closest;
        return game.ship.soi === 'pluto' || (!!c && c.body === 'pluto' && c.dist < BODIES.pluto.soi);
      },
    },
    {
      id: 'c5_into_kuiper', act: 3,
      title: t('Into the Kuiper belt', 'Into the icy rocks'),
      objective: t('Look round at the icy rocks of the Kuiper belt. Pluto is near!', 'Look at all the icy rocks!'),
      markers: ['pluto'],
      transfer: 'pluto',
      aim: 'prograde',
      enter() { game.target = 'pluto'; },
      // A short look (lead 2026-10-08 review: the step passed in no time).
      check(ctx, states, stepTime) {
        fuelSafetyNet(game);
        if (stepTime < 8) return false;
        return game.ship.soi === 'pluto' || Math.hypot(game.ship.x, game.ship.z) > KUIPER.inner + 1500;
      },
    },
    {
      id: 'c5_space_pool', act: 3,
      title: t('Space pool', 'Space pool'),
      objective: t('Practise moving icy rocks with bumps: knock the gold rock into the net.', 'Knock the gold rock into the net!'),
      markers: ['pluto'],
      async enter() {
        await hud.showDialogue([
          { who: 'Mission Control', text: t('Icy rocks all round you! Before we go on, some practice: one day you may need to move a rock in space. Knock the gold rock into the net, using what you learned about bumps.', 'Icy rocks everywhere! Let’s play a game. Knock the gold rock into the net!') },
        ]);
        await playPool({ bus: game.bus });
        hud.toast(t('Space pool champion! Now on to Pluto.', 'Well done! Now on to Pluto.'), { kind: 'good', ms: 3200 });
      },
    },
    {
      id: 'c5_pluto_coast', act: 3,
      title: t('Fly past Pluto', 'Fly past Pluto'),
      objective: t('Coast on to Pluto. If the banner asks for a small burn, it is fine-tuning your path.', 'Fly on to Pluto and wait. Keys 1 to 4 make time go fast.'),
      markers: ['pluto'],
      transfer: 'pluto',
      aim: 'prograde',
      enter() { game.target = 'pluto'; },
      check() {
        fuelSafetyNet(game);
        // Inside its pull; or (a near miss) already out past its path.
        return game.ship.soi === 'pluto' || Math.hypot(game.ship.x, game.ship.z) > BODIES.pluto.orbit + BODIES.pluto.soi * 2;
      },
    },
    {
      id: 'c5_pluto_pass', act: 3,
      title: t('Pluto!', 'Pluto!'),
      objective: '',
      markers: ['pluto'],
      async enter() {
        hud.toast(t('Pluto, right beside you! See the big pale heart?', 'There is Pluto! Can you see the heart shape?'), { kind: 'good', ms: 4000 });
        await hud.showFact({
          title: t('Pluto, the dwarf planet', 'Pluto is a dwarf planet'),
          body: t('Pluto is smaller than our Moon. It has mountains of water ice and a huge pale plain shaped like a heart, made of frozen nitrogen. Its biggest moon, Charon, is half its size. Pluto shares its path round the Sun with lots of other icy worlds, like Eris.',
            'Pluto is smaller than our Moon. It has a big heart shape made of ice. It has a moon called Charon.'),
        });
      },
      beat: 'c5Pluto',
    },
    {
      id: 'c5_edge', act: 3,
      title: t('The edge of the Sun’s family', 'The edge'),
      objective: '',
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: 'girl', text: t('How far does the Sun’s family go? Is this the edge?', 'Is this the end of the Sun’s family?') },
          { who: 'Mission Control', text: t('Not even close! Let’s zoom right out and see.', 'Not yet! Let’s zoom out and see.') },
        ]);
        await playEdgePullBack(game);
      },
      beat: 'c5Voyager',
    },
  ];
}
