// Every lesson in the game, in play order: the launcher's "📖 Lessons" list
// reads this to let a child watch any lesson again (lead 2026-10-05).
//
// Kept light on purpose: titles and a loader only. The lesson itself (its
// drawing code, and Flight school's orbit maths) is imported when a child
// picks it, so the launcher opens as fast as before.
export const LESSON_LIST = [
  { id: 'ch1_round_earth', chapter: 1, title: ['How we know the Earth is round', 'The Earth is round'], load: () => import('./lessons/ch1.js').then((m) => m.LESSON_1A) },
  { id: 'ch1_eratosthenes', chapter: 1, title: ['Eratosthenes measures the Earth', 'How big is the Earth?'], load: () => import('./lessons/ch1.js').then((m) => m.LESSON_1B) },
  { id: 'ch2_triangles', chapter: 2, title: ['Why bridges use triangles', 'Strong triangles'], load: () => import('./lessons/ch2.js').then((m) => m.LESSON_2A) },
  { id: 'ch2_archimedes', chapter: 2, title: ['Archimedes and the king’s crown', 'The king’s crown'], load: () => import('./lessons/ch2.js').then((m) => m.LESSON_2B) },
  { id: 'ch3_push_back', chapter: 3, title: ['Push back, go forward', 'Push back, go forward'], load: () => import('./lessons/ch3.js').then((m) => m.LESSON_3A) },
  { id: 'ch3_heavy', chapter: 3, title: ['Heavy rockets need big pushes', 'Heavy rockets'], load: () => import('./lessons/ch3.js').then((m) => m.LESSON_3B) },
  { id: 'ch4_flight_school', chapter: 4, title: ['Flight school: flying to the Moon', 'Flying to the Moon'], load: () => import('./lessons/flightSchool.js').then((m) => m.LESSON_4F) },
  { id: 'ch4_life', chapter: 4, title: ['Cells, DNA and proteins', 'What is life made of?'], load: () => import('./lessons/ch4.js').then((m) => m.LESSON_4G) },
];
