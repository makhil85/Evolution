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
  { id: 'ch3_energy', chapter: 3, title: ['Energy never disappears', 'Energy changes form'], load: () => import('./lessons/ch3.js').then((m) => m.LESSON_3C) },
  { id: 'ch4_flight_school', chapter: 4, title: ['Flight school: flying to the Moon', 'Flying to the Moon'], load: () => import('./lessons/flightSchool.js').then((m) => m.LESSON_4F) },
  { id: 'ch4_life', chapter: 4, title: ['Cells, DNA and proteins', 'What is life made of?'], load: () => import('./lessons/ch4.js').then((m) => m.LESSON_4G) },
  { id: 'ch5_rings', chapter: 5, title: ['What are Saturn’s rings?', 'Saturn’s rings'], load: () => import('./lessons/ch5.js').then((m) => m.LESSON_5A) },
  { id: 'ch5_momentum', chapter: 5, title: ['Bumps in the rings: momentum', 'Bumps in the rings'], load: () => import('./lessons/ch5.js').then((m) => m.LESSON_5AA) },
  { id: 'ch5_neptune', chapter: 5, title: ['Neptune, the last giant', 'Neptune'], load: () => import('./lessons/ch5b.js').then((m) => m.LESSON_5B) },
  { id: 'ch5_fusion', chapter: 5, title: ['What makes a star shine?', 'How the Sun shines'], load: () => import('./lessons/ch5c.js').then((m) => m.LESSON_5C) },
  { id: 'ch6_tiny_earth', chapter: 6, title: ['A ship that is a tiny Earth', 'A tiny Earth'], load: () => import('./lessons/ch6a.js').then((m) => m.LESSON_6A) },
  { id: 'ch6_slingshot', chapter: 6, title: ['Stealing energy', 'Borrow speed'], load: () => import('./lessons/ch6b.js').then((m) => m.LESSON_6B) },
  { id: 'ch6_light', chapter: 6, title: ['How fast is light?', 'How fast is light?'], load: () => import('./lessons/ch6c.js').then((m) => m.LESSON_6C) },
  { id: 'ch7_push', chapter: 7, title: ['How do you know you are speeding up?', 'Speeding up'], load: () => import('./lessons/ch7a.js').then((m) => m.LESSON_7A) },
  { id: 'ch7_atoms', chapter: 7, title: ['Atoms: what everything is made of', 'Tiny building blocks'], load: () => import('./lessons/ch7b.js').then((m) => m.LESSON_7B) },
  { id: 'ch7_tiny_life', chapter: 7, title: ['Tiny life helps us', 'Tiny life'], load: () => import('./lessons/ch7c.js').then((m) => m.LESSON_7C) },
  { id: 'ch7_black_hole', chapter: 7, title: ['Black holes and quasars', 'Black holes'], load: () => import('./lessons/ch7d.js').then((m) => m.LESSON_7D) },
];
