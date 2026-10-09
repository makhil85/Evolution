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
      objective: t(`Follow the arrow and hold Space until you break free of ${From}’s pull.`, `Follow the arrow and hold Space to leave ${From}.`),
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
      objective: t(`Time warp to BURN NOW. Then hold Space until the dotted line reaches ${To}.`, `On green BURN NOW, hold Space to reach ${To}.`),
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
      objective: t(`Coast to ${To}. Time warp helps. Small burns just fine-tune your path.`, `Fly to ${To}. Time warp makes time go fast.`),
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
      objective: t(`Brake at your lowest point so ${To}’s gravity catches you.`, `Slow down when the sign says, so ${To} catches you.`),
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
      say: t('Out of Saturn’s pull! Uranus is next: the planet that rolls round the Sun on its side. Wait for BURN NOW.', 'You left Saturn! Next stop: Uranus. Wait for the green BURN NOW sign.'),
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
        hud.toast(t('Uranus has you! Look how it is tipped right over.', 'You’re going around Uranus! It is lying on its side!'), { kind: 'good' });
        // Time to look before the fact and the question (lead 2026-10-08).
        await orbitFor(game, 25, { lap: false });
        await hud.showFact({
          title: t('A planet lying on its side', 'A planet on its side'),
          body: t('Most planets spin upright. Uranus lies on its side and rolls round the Sun. Its poles take turns in sunlight for years.',
            'Uranus lies down and rolls round the Sun. One side gets sun for years.'),
        });
      },
      // Knocked over (25 s after she arrived), then the pole's day (after the fact).
      beat: 'c5UranusTilt',
      bonusBeats: ['c5UranusPoleDay'],
    },
    ...legSteps(game, {
      from: 'uranus', to: 'neptune', act: 2,
      ids: { leave: 'c5_leave_uranus', window: 'c5_to_neptune', coast: 'c5_neptune_approach', orbit: 'c5_neptune_orbit' },
      say: t('Free of Uranus! Neptune is the last big planet, and the furthest. Sunlight takes hours to get there. Wait for BURN NOW.', 'You left Uranus! Next: Neptune. Wait for green BURN NOW.'),
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
      objective: t('Follow the arrow and hold Space until your path breaks free of its pull.', 'Follow the arrow and hold Space to leave Neptune.'),
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
      objective: t('On BURN NOW, hold Space until the line passes Pluto. Let go to cruise.', 'On green BURN NOW, hold Space to reach Pluto.'),
      markers: ['pluto'],
      aim: 'prograde',
      transfer: 'pluto',
      async enter() {
        game.target = 'pluto';
        if (lineUpOnce(game.ship, 'pluto')) { game.replan?.(); game.missions?.save(); }
        await hud.showDialogue([
          { who: 'Mission Control', text: t('Past Neptune there are no more big planets, just a huge ring of icy rocks: the Kuiper belt. Pluto lives there. Let’s fly past it!', 'No more big planets. Just icy rocks. Pluto lives here!') },
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
          { who: 'Mission Control', text: t('Icy rocks all round you! Some practice first: knock the gold rock into the net, using what you learned about bumps.', 'Icy rocks everywhere! Let’s play a game. Knock the gold rock into the net!') },
        ]);
        await playPool({ bus: game.bus });
        hud.toast(t('Space pool champion! Now on to Pluto.', 'Well done! Now on to Pluto.'), { kind: 'good' });
      },
    },
    {
      id: 'c5_pluto_coast', act: 3,
      title: t('Fly past Pluto', 'Fly past Pluto'),
      objective: t('Coast on to Pluto. Small burns just fine-tune your path.', 'Fly on to Pluto. Time warp makes time go fast.'),
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
        hud.toast(t('Pluto, right beside you! See the big pale heart?', 'There is Pluto! Can you see the heart shape?'), { kind: 'good' });
        await hud.showFact({
          title: t('Pluto, the dwarf planet', 'Pluto is a dwarf planet'),
          body: t('Pluto is smaller than our Moon. It has a pale heart-shaped plain of frozen nitrogen, and a big moon, Charon.',
            'Pluto is smaller than our Moon. It has a heart of ice.'),
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
