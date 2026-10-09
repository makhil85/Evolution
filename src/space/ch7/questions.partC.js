// Chapter 7, Part C question bank: one sum after each room task (tasks.js), plus
// nothing else. Same schema as ch6/questions.partQuests.js: Level 4 entries, and
// a Level 1 overlay with the same ids (short words, counting by twos and
// doubling). The numbers come from tasksLogic.js and are re-derived in
// scripts/test-ch7-science.mjs, so a retune cannot leave a question wrong.
import {
  SPLIT, o2FromWater, PLANTS, oxygenInCo2, hoursToPass, noExerciseLoss, BONES,
} from './tasksLogic.js';

const ACT_C = 3;

// The sums, from the task rules.
const WATER_IN_Q = 4; // water molecules in the split question
const CO2_IN_Q = PLANTS.co2; // 6 carbon dioxide molecules in one light run
const CO2_IN_Q1 = 2; // Level 1: two carbon dioxide molecules
const DOUBLE_TO_PASS = hoursToPass(100); // 7
const COAST_MONTHS = 6;
const LOSS_PER_MONTH = BONES.lossTenths[0] / 10; // 1 (percent)

/** The task each question follows (tasks.js calls the beat when the task is done). */
export const TASK_BEAT = Object.freeze({ split: 'c7Split', plants: 'c7Plants', microbes: 'c7Microbes', bones: 'c7Bones' });

export const CH7C_QUESTIONS = {
  c7_split_oxygen: {
    id: 'c7_split_oxygen', type: 'text', act: ACT_C, beat: TASK_BEAT.split,
    title: 'Pairs of water', subject: 'Division', difficulty: 'Level 4',
    prompt: `Splitting ${SPLIT.equation.water} water molecules makes ${SPLIT.equation.h2} hydrogen molecules and ${SPLIT.equation.o2} oxygen molecule. How many oxygen molecules do ${WATER_IN_Q} water molecules make? (Type a number.)`,
    answers: [String(o2FromWater(WATER_IN_Q))],
    hint: 'Split the water into pairs. How many oxygen molecules does one pair make?',
    parentHint: `${SPLIT.equation.water} water make ${SPLIT.equation.o2} oxygen molecule. ${WATER_IN_Q} water is two lots of ${SPLIT.equation.water}, so ${o2FromWater(WATER_IN_Q)} oxygen molecules.`,
    success: `Yes! ${o2FromWater(WATER_IN_Q)} oxygen molecules. Every oxygen molecule has two oxygen atoms, and no atom was lost.`,
    doneMessage: 'The water is split, and the air is fresh!',
    reward: { science: 10 },
  },
  c7_plants_oxygen_atoms: {
    id: 'c7_plants_oxygen_atoms', type: 'text', act: ACT_C, beat: TASK_BEAT.plants,
    title: 'Oxygen in the air', subject: 'Multiplication', difficulty: 'Level 4',
    prompt: `One light run on the farm takes in ${CO2_IN_Q} carbon dioxide molecules (CO₂). Each one has 2 oxygen atoms. How many oxygen atoms is that in all? (Type a number.)`,
    answers: [String(oxygenInCo2(CO2_IN_Q))],
    hint: 'Count the oxygen atoms in one CO₂ first, then add up six of them.',
    parentHint: `${CO2_IN_Q} × 2 = ${oxygenInCo2(CO2_IN_Q)} oxygen atoms in the carbon dioxide.`,
    success: `Yes! ${oxygenInCo2(CO2_IN_Q)} oxygen atoms. The plants keep the carbon and give back the oxygen for us to breathe.`,
    doneMessage: 'The farm makes our air. Mira is proud!',
    reward: { science: 10 },
  },
  c7_microbes_hours: {
    id: 'c7_microbes_hours', type: 'text', act: ACT_C, beat: TASK_BEAT.microbes,
    title: 'Doubling helpers', subject: 'Doubling', difficulty: 'Level 4',
    prompt: 'A bacterium splits in two every pretend hour, and it starts as 1. After how many pretend hours are there more than 100? (Type a number.)',
    answers: [String(DOUBLE_TO_PASS), `${DOUBLE_TO_PASS} hours`, `${DOUBLE_TO_PASS} pretend hours`],
    hint: 'Keep doubling: 1, 2, 4, 8... until you pass 100.',
    parentHint: `1, 2, 4, 8, 16, 32, 64, 128: that is ${DOUBLE_TO_PASS} doublings, and 128 is the first number over 100.`,
    success: `Yes! ${DOUBLE_TO_PASS} pretend hours. Doubling makes big numbers quickly, so the helpers clean the tank in time.`,
    doneMessage: 'The helpers are growing. The tank is clean!',
    reward: { science: 10 },
  },
  c7_bones_percent: {
    id: 'c7_bones_percent', type: 'text', act: ACT_C, beat: TASK_BEAT.bones,
    title: 'Bones in zero g', subject: 'Adding', difficulty: 'Level 4',
    prompt: `In zero g, bones lose about ${LOSS_PER_MONTH}% a month when nobody exercises. How many percent do they lose over a ${COAST_MONTHS}-month trip? (Type a number.)`,
    answers: [String(noExerciseLoss(COAST_MONTHS)), `${noExerciseLoss(COAST_MONTHS)}%`, `${noExerciseLoss(COAST_MONTHS)} percent`],
    hint: `Add ${LOSS_PER_MONTH}% for each month. How many months is the trip?`,
    parentHint: `${LOSS_PER_MONTH}% × ${COAST_MONTHS} months = ${noExerciseLoss(COAST_MONTHS)}%. With two hours of bike a day it is only ${BONES.lossTenths[2] / 10}% a month.`,
    success: `Yes! ${noExerciseLoss(COAST_MONTHS)}% over the trip. That is why Theo wants the crew on the bike.`,
    doneMessage: 'Bones are strong. Theo is happy!',
    reward: { science: 10 },
  },
};

export const CH7C_LEVEL1 = {
  c7_split_oxygen: {
    difficulty: 'Level 1 • pairs',
    prompt: `Two water molecules make 1 oxygen molecule. How many oxygen molecules do ${WATER_IN_Q} water molecules make? (Type a number.)`,
    answers: [String(o2FromWater(WATER_IN_Q)), 'two'],
    hint: 'How many pairs fit into 4 water molecules?',
    parentHint: `4 water is 2 pairs. Each pair makes 1 oxygen molecule: ${o2FromWater(WATER_IN_Q)}.`,
    success: `Yes! Two pairs, so ${o2FromWater(WATER_IN_Q)} oxygen molecules.`,
  },
  c7_plants_oxygen_atoms: {
    difficulty: 'Level 1 • counting by twos',
    prompt: `One carbon dioxide has 2 oxygen atoms. How many oxygen atoms are in ${CO2_IN_Q1} carbon dioxide? (Type a number.)`,
    answers: [String(oxygenInCo2(CO2_IN_Q1)), 'four'],
    hint: 'Count the oxygen atoms of one carbon dioxide, then count again for the next.',
    parentHint: `2 + 2 = ${oxygenInCo2(CO2_IN_Q1)}.`,
    success: `Yes! ${oxygenInCo2(CO2_IN_Q1)} oxygen atoms.`,
  },
  c7_microbes_hours: {
    difficulty: 'Level 1 • doubling',
    prompt: 'Start with 1 bacterium. It splits in two every pretend hour. How many bacteria after 3 hours? (Type a number.)',
    answers: [String(2 ** 3), 'eight'],
    hint: 'Keep going: 1, 2, 4, and one more doubling.',
    parentHint: '1 → 2 → 4 → 8. Three doublings.',
    success: 'Yes! 8 bacteria. Each hour, the number doubles.',
  },
  c7_bones_percent: {
    difficulty: 'Level 1 • adding',
    prompt: 'Bones lose about 1 percent each month with no exercise. How many percent after 3 months? (Type a number.)',
    answers: [String(noExerciseLoss(3)), 'three', `${noExerciseLoss(3)}%`],
    hint: 'Add 1 for each month.',
    parentHint: `1 + 1 + 1 = ${noExerciseLoss(3)} percent.`,
    success: `Yes! ${noExerciseLoss(3)} percent. The bike keeps them strong.`,
  },
};
