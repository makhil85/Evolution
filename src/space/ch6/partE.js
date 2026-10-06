// Chapter 6, Part E (steps 13-20): plan the route, learn how a slingshot
// steals speed (lesson 6B), fly the slingshots and the Sun dive, the drive
// lights (cutscene), how fast light is (lesson 6C), the trip to the nearest
// star, and the end card. See missions.js for the step format.
//
// Built apart from Part D (steps 1-12: the page, the crew, the habitat and
// its stations), so it plugs in at the end of Chapter 6's chain:
//   steps.js:  [...partA..D, ...partESteps(game)]
// What to check when joining (CHAPTER6_PART_E.md has the list): the crew's
// names in CREW below, the act number, and the question beats (the bank is
// questions.partE.js, merged into Chapter 6's).
import { t, LEVEL } from '../level.js';
import { markSaveComplete, answeredCount } from '../acts/util.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_6B } from '../../lesson/lessons/ch6b.js';
import { LESSON_6C } from '../../lesson/lessons/ch6c.js';
import { playRoutePlanner } from './routePlanner.js';
import { playSlingshots } from './slingshot.js';
import { playDriveOn } from './driveOn.js';
import { who } from './crewInfo.js';
import { routeById, bestPlan, planTotals, CRUISE_PERCENT, START_SPEED, STOPS } from './routes.js';

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
      id: 'c6_plan_route', act: ACT_E,
      title: t('Plan the route to the stars', 'Plan the trip'),
      objective: t('Pick one of three routes, then set how close each flyby passes: enough speed, inside the fuel tank.', 'Pick a route. Get enough speed, but don’t use too much fuel.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: CREW.signal, text: t('Scanning ahead... the planets are nearly in a line! That only happens about once every 175 years.', 'Look! The planets are almost in a line!') },
          { who: 'girl', text: t('Then we can steal speed from them, one after another, all the way in to the Sun.', 'We can get speed from each planet, all the way to the Sun!') },
          { who: CREW.builder, text: t('Closer passes give more speed, but steering that close burns fuel. The tank only holds so much.', 'Going close gives more speed, but uses more fuel.') },
        ]);
        const prev = loadRoute().plan;
        const res = await playRoutePlanner({ bus: game.bus, initial: prev && routeById(prev.route) ? prev : null });
        saveRoute({ plan: { route: res.route, close: res.close }, flight: null });
      },
      beat: 'c6FuelLeft',
    },
    {
      id: 'c6_lesson_slingshot', act: ACT_E,
      title: t('How does a slingshot work?', 'How do we get speed from a planet?'),
      objective: t('Watch the lesson on stealing speed, and answer a question after each film.', 'Watch the lesson about getting speed.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: CREW.biologist, text: t('Wait: how can flying past a planet make us faster? Doesn’t its pull just slow us down again on the way out?', 'How can a planet make us faster?') },
          { who: CREW.signal, text: t('Good question! Let me show you.', 'Let me show you!') },
        ]);
        await lessonOnce(LESSON_6B, { bus: game.bus });
      },
      beat: 'c6RouteSum',
    },
    {
      id: 'c6_fly_slingshots', act: ACT_E,
      title: t('Fly the slingshots', 'Fly past the planets'),
      objective: t('At each planet, press right at the closest point to keep the whole boost. At the Sun, fire the drive.', 'Press at the right time at each planet!'),
      markers: [],
      async enter() {
        const saved = loadRoute();
        const plan = saved.plan && routeById(saved.plan.route) ? saved.plan : bestPlan('nj');
        const res = await playSlingshots({ bus: game.bus, plan });
        saveRoute({ flight: { speed: res.speed, kept: res.kept, legs: res.legs.map((l) => ({ id: l.id, kept: l.kept })) } });
        game.stats = { ...(game.stats || {}), slingSpeed: res.speed };
        const best = res.legs.reduce((a, l) => (l.id !== 'sun' && l.kept > (a?.kept ?? -1) ? l : a), null);
        await hud.showDialogue([
          { who: CREW.doctor, text: t(`Everyone OK? That was a ride! We’re at ${res.speed} km/s.`, `Everyone OK? We are going ${res.speed} km/s!`) },
          best ? { who: 'girl', text: t(`${STOPS[best.id].name[0]} gave us the most of any planet: +${best.kept} km/s.`, `${STOPS[best.id].name[1]} gave us the most speed!`) } : null,
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
        await playDriveOn(game, { speedKms: f?.speed ?? START_SPEED + planTotals(bestPlan('nj')).boost });
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
        const r = routeById(loadRoute().plan?.route || 'nj');
        await hud.showEnd({
          eyebrow: t('Chapter 6 complete', 'Chapter 6 done!'),
          title: t('On our way to the stars!', 'Off to the stars!'),
          note: t(`To be continued... cruising at ${CRUISE_PERCENT}% of light speed towards another star.`, 'To be continued...'),
          route: ['Rock B', ...r.stops.map((id) => t(STOPS[id].name[0], STOPS[id].name[1])), t('the stars', 'the stars')],
          stats: {
            'Time played': `${Math.max(1, Math.round((game.stats?.played || 0) / 60))} min`,
            'Speed from slingshots': `${f?.speed ?? '?'} km/s`,
            'Cruise speed': `${CRUISE_PERCENT}% of light`,
            'Questions answered': answeredCount(),
          },
        });
      },
      check() { return false; }, // stay here; the end card has already been shown
    },
  ];
}
