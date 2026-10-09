// Chapter 6, Part E: the fastest way out of the Sun's family. Lesson 6B
// (energy: the Sun alone gives nothing; steal it from moving planets; burn
// where you are fastest), then the route planner from the asteroid belt (10 t
// of fuel, then 100 t: lead 2026-10-07), fly the chosen route, the drive
// lights (cutscene), how fast light is (lesson 6C), the trip to the nearest
// star, and the end card. See missions.js for the step format.
//
// The last part of Chapter 6's chain (ch6/steps.js), after the habitat
// and lesson 6A. Questions: questions.partE.js; numbers: routes.js.
import { t, LEVEL } from '../level.js';
import { markSaveComplete, answeredCount } from '../acts/util.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_6B } from '../../lesson/lessons/ch6b.js';
import { LESSON_6C } from '../../lesson/lessons/ch6c.js';
import { playRoutePlanner } from './routePlanner.js';
import { playSlingshots } from './slingshot.js';
import { playDriveOn } from './driveOn.js';
import { who } from './crewInfo.js';
import { routeById, fastestRoute, planTotals, CRUISE_PERCENT, STOPS, FUELS } from './routes.js';

/** Who says what (names from crewInfo.js). */
export const CREW = {
  biologist: who('biologist'),
  doctor: who('doctor'),
  builder: who('builder'),
  signal: who('signal'),
};

const ACT_E = 6;

// The plan and the flight result live in the save's own key, so a reload
// part-way through Part E picks up where she was.
const KEY = `rocket_village_ch6_route_L${LEVEL}`;
function loadRoute() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch { return {}; }
}
function saveRoute(patch) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...loadRoute(), ...patch })); } catch { /* private mode */ }
}
/** Start Part E over (the chapter restart and "Start everything over" should call this). */
export function clearPartE() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export function partESteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c6_lesson_slingshot', act: ACT_E,
      title: t('Stealing energy', 'Borrow speed'),
      objective: t('Watch the lesson on energy and how to steal it, and answer a question after each film.', 'Watch the lesson about getting speed.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: 'girl', text: t('The ship is ready. How do we leave the Sun’s family as fast as we can?', 'How do we go as fast as we can?') },
          { who: CREW.biologist, text: t('Could we fly in close to the Sun first? We would go really fast down there!', 'Can we fly close to the Sun to go fast?') },
          { who: CREW.signal, text: t('We would speed up falling in, and slow down again climbing out. Energy never comes for free. Let me show you where it CAN come from.', 'Falling in we speed up, but climbing out we slow down. Let me show you!') },
        ]);
        await lessonOnce(LESSON_6B, { bus: game.bus });
      },
      beat: 'c6RouteSum',
    },
    {
      id: 'c6_plan_route', act: ACT_E,
      title: t('Plan the fastest way out', 'Plan the trip'),
      objective: t(`Find the route that leaves the Sun’s family fastest: first with ${FUELS[0]} t of fuel, then with ${FUELS[1]} t.`, `Find the fastest way out, with ${FUELS[0]} t and then ${FUELS[1]} t of fuel.`),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: 'Mission Control', text: t(`The supply ship can bring ${FUELS[0]} tonnes of fuel now, or ${FUELS[1]} tonnes if you wait. Work out the fastest way out for each.`, `We can send ${FUELS[0]} t of fuel now, or ${FUELS[1]} t later. Find the fastest way for both!`) },
          { who: CREW.builder, text: t('Every route burns the whole tank once. Where we burn it, and which planets we rob on the way, is up to us.', 'We use all the fuel. Which way we go is up to us!') },
        ]);
        const res = await playRoutePlanner({ bus: game.bus });
        saveRoute({ plan: res.plan, rounds: res.rounds, flight: null });
      },
      beat: 'c6FuelLeft',
    },
    {
      id: 'c6_fly_slingshots', act: ACT_E,
      title: t('Fly the route', 'Fly the route'),
      objective: t(`The supply ship brought ${FUELS[1]} t. Fly your plan: at each planet press right at the closest point; at the Sun, fire the drive.`, 'Press at the right time at each stop!'),
      markers: [],
      async enter() {
        const saved = loadRoute();
        const plan = saved.plan && routeById(saved.plan.route) ? saved.plan : fastestRoute(FUELS[1]);
        if (!routeById(plan.route).stops.length) hud.toast(t(`Straight out: all ${plan.fuel} t burned at once.`, 'Burn all the fuel!'), { kind: 'info' });
        const res = await playSlingshots({ bus: game.bus, plan });
        saveRoute({ flight: { speed: res.speed, legs: res.legs.map((l) => ({ id: l.id, kept: l.kept })) } });
        game.stats = { ...(game.stats || {}), slingSpeed: res.speed };
        const best = res.legs.reduce((a, l) => (l.id !== 'sun' && l.kept > (a?.kept ?? -Infinity) ? l : a), null);
        await hud.showDialogue([
          { who: CREW.doctor, text: t(`Everyone OK? That was a ride! We are leaving the Sun’s family at ${res.speed} km/s.`, `Everyone OK? We are going ${res.speed} km/s!`) },
          best ? { who: 'girl', text: t(`${STOPS[best.id].name[0]} gave us the most of any planet.`, `${STOPS[best.id].name[1]} gave us the most speed!`) } : null,
        ].filter(Boolean));
      },
      beat: 'c6JupiterBoost',
    },
    {
      id: 'c6_drive_on', act: ACT_E,
      title: t('Fusion drive on', 'Engine on!'),
      objective: '',
      markers: [],
      async enter() {
        const f = loadRoute().flight;
        await playDriveOn(game, { speedKms: Math.max(1, f?.speed ?? planTotals(fastestRoute(FUELS[1])).speed) });
      },
      beat: 'c6SunDive',
    },
    {
      id: 'c6_lesson_light', act: ACT_E,
      title: t('How fast is light?', 'How fast is light?'),
      objective: t('Watch the lesson on light speed, and answer a question after each film.', 'Watch the lesson about light.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: 'girl', text: t('Why does the dial say percent now, not km/s?', 'Why does the dial say % now?') },
          { who: CREW.signal, text: t('Because we are getting close to the fastest speed there is. Let me show you how fast that is.', 'We are going very, very fast! Let me show you.') },
        ]);
        await lessonOnce(LESSON_6C, { bus: game.bus });
      },
      beat: 'c6PercentLight',
    },
    {
      id: 'c6_star_trip', act: ACT_E,
      title: t('How long to the stars?', 'How long to the stars?'),
      objective: '',
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: CREW.builder, text: t(`Cruising at ${CRUISE_PERCENT}% of light speed. Every system is green.`, `We are going ${CRUISE_PERCENT}% of light speed!`) },
          { who: CREW.biologist, text: t('The farm is growing, the air is fresh, the water is clean. Our tiny Earth works!', 'The plants grow. The air is good. Our ship is like a tiny Earth!') },
          { who: 'girl', text: t('Then let’s work out how long until we reach the nearest star.', 'How long until we get to the star?') },
        ]);
      },
      beat: 'c6StarYears',
    },
    {
      id: 'c6_end', act: ACT_E,
      title: t('Chapter 6 complete', 'Chapter 6 done!'),
      objective: '',
      markers: [],
      async enter() {
        markSaveComplete(game);
        const f = loadRoute().flight;
        const r = routeById(loadRoute().plan?.route || 'sun');
        await hud.showEnd({
          eyebrow: t('Chapter 6 complete', 'Chapter 6 done!'),
          title: t('On our way to the stars!', 'Off to the stars!'),
          note: t(`To be continued... cruising at ${CRUISE_PERCENT}% of light speed towards another star.`, 'To be continued...'),
          route: [t('Asteroid belt', 'Asteroid belt'), ...(r.fall ? ['Jupiter'] : []), ...r.stops.map((id) => t(STOPS[id].name[0], STOPS[id].name[1])), t('the stars', 'the stars')],
          stats: {
            'Time played': `${Math.max(1, Math.round((game.stats?.played || 0) / 60))} min`,
            'Speed leaving the Sun': `${f?.speed ?? '?'} km/s`,
            'Cruise speed': `${CRUISE_PERCENT}% of light`,
            'Questions answered': answeredCount(),
          },
        });
      },
      check() { return false; }, // stay here; the end card has already been shown
    },
  ];
}
