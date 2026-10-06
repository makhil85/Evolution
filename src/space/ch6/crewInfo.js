// Chapter 6's crew: who they are, as words (the 3-D figures are crew.js).
// They arrive on a supply ship from Earth at the start of the chapter and
// stay for the trip; the pilot (the child's hero) stays the engineer and the
// navigator. Agreed with the lead, 2026-10-05.

export const CREW_INFO = Object.freeze({
  biologist: { name: 'Mira', job: ['biologist: air, water and the farm', 'plant and air expert'], kid: true, color: '#7fdc8a' },
  doctor: { name: 'Theo', job: ['doctor: keeps the crew healthy, watches the radiation', 'doctor'], kid: true, color: '#7fc8ff' },
  builder: { name: 'Bolt', job: ['builder bot: heavy lifting and repairs outside', 'builder robot'], kid: false, color: '#ffb347' },
  signal: { name: 'Echo', job: ['signal bot: talks to Earth and scans ahead', 'radio robot'], kid: false, color: '#c9a6ff' },
});

/** The name a dialogue line shows for a crewmate ('biologist' -> 'Mira'). */
export const who = (id) => CREW_INFO[id]?.name || id;
