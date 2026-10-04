// A small inline-SVG icon set for the HUD.
//
// The plan bans emoji as UI ("icons drawn in inline SVG"), so every glyph
// here is hand-drawn line art, stroke="currentColor" so CSS controls the
// colour per-instrument (an unlit gauge, a lit one, a warning one — same
// icon, three colours, zero extra markup).
//
// Each export is the INNER markup of a 24x24 viewBox, for use with
// domUtil.js `svg(ICONS.fuel)`.

const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  speed: `<circle cx="12" cy="13" r="8" ${S}/><path d="M12 13 L16 9" ${S}/><path d="M12 5 v1.4 M12 21 v-1.4 M4 13 h1.4 M20 13 h-1.4" ${S}/>`,

  altitude: `<path d="M12 3 L19 15 H5 Z" ${S}/><path d="M9.5 11.5 h5" ${S}/><path d="M4 20 h16" ${S}/>`,

  fuel: `<path d="M8 3 h5 v2.2 l1.6 1.6 V19 a1 1 0 0 1-1 1H7.4a1 1 0 0 1-1-1V6.8L8 5.2Z" ${S}/><path d="M8 3 h5" ${S}/><path d="M7.6 12 h5.4" ${S}/>`,

  cargo: `<path d="M4 8 L12 4 L20 8 L12 12 Z" ${S}/><path d="M4 8 v9 l8 4" ${S}/><path d="M20 8 v9 l-8 4" ${S}/><path d="M12 12 v8" ${S}/>`,

  gravity: `<circle cx="8" cy="16" r="3.4" ${S}/><circle cx="17" cy="8" r="1.6" ${S}/><path d="M10.6 13.6 C13 10.5 14.4 9.2 15.6 8.6" ${S} stroke-dasharray="2.2 2.2"/><path d="M14.5 7.6 l1.6 .8 l-.4 1.8" ${S}/>`,

  solar: `<circle cx="12" cy="12" r="3.6" ${S}/><path d="M12 4 v2.2 M12 17.8 V20 M4 12 h2.2 M17.8 12 H20 M6.3 6.3 l1.6 1.6 M16.1 16.1 l1.6 1.6 M17.7 6.3 l-1.6 1.6 M7.9 16.1 l-1.6 1.6" ${S}/>`,

  warp: `<path d="M6 5 L14 12 L6 19 Z" ${S}/><path d="M14 5 L20 12 L14 19" ${S}/>`,

  orbit: `<ellipse cx="12" cy="12" rx="9" ry="4.6" ${S}/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="20" cy="12" r="1.4" fill="currentColor" stroke="none"/>`,

  landing: `<path d="M12 4 v13" ${S}/><path d="M7 12 l5 5 l5-5" ${S}/><path d="M4 21 h16" ${S}/>`,

  warning: `<path d="M12 4 L21 20 H3 Z" ${S}/><path d="M12 10 v4.4" ${S}/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>`,

  radiation: `<circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>${[0, 120, 240].map((a) => `<path d="M12 12 L12 4 A8 8 0 0 1 18.9 8" ${S} transform="rotate(${a} 12 12)"/>`).join('')}`,

  map: `<path d="M9 4 L4 6 v14 l5-2 l6 2 l5-2 V4 l-5 2 Z" ${S}/><path d="M9 4 v14 M15 6 v14" ${S}/>`,

  target: `<circle cx="12" cy="12" r="8" ${S}/><circle cx="12" cy="12" r="3.4" ${S}/><path d="M12 2 v3.4 M12 18.6 V22 M2 12 h3.4 M18.6 12 H22" ${S}/>`,

  ghost: `<path d="M6 20 V11 a6 6 0 0 1 12 0 v9 l-2.4-2 l-2.1 2 l-2.1-2 l-2.1 2 Z" ${S}/><circle cx="9.6" cy="10.6" r=".9" fill="currentColor" stroke="none"/><circle cx="14.4" cy="10.6" r=".9" fill="currentColor" stroke="none"/>`,

  key: `<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="3" ${S}/>`,

  close: `<path d="M6 6 L18 18 M18 6 L6 18" ${S}/>`,

  chevronDown: `<path d="M6 9 L12 15 L18 9" ${S}/>`,

  chevronUp: `<path d="M6 15 L12 9 L18 15" ${S}/>`,

  flask: `<path d="M10 3 h4 M10.5 3 v6 L5.6 18.4a1.4 1.4 0 0 0 1.2 2.1h10.4a1.4 1.4 0 0 0 1.2-2.1L13.5 9V3" ${S}/><path d="M8 15.5 h8" ${S}/>`,

  fire: `<path d="M12 3 C9 7 7 9 7 13 a5 5 0 0 0 10 0 c0-1.6-.6-2.6-1.4-3.6 c-.1 1.4-.9 2-1.6 2 C14.6 8.6 13.6 6.4 12 3Z" ${S}/>`,

  pause: `<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>`,

  play: `<path d="M7 4 L19 12 L7 20 Z" fill="currentColor"/>`,

  help: `<circle cx="12" cy="12" r="9" ${S}/><path d="M9.3 9.6 a2.7 2.7 0 1 1 3.9 2.4 c-.9.5-1.2 1-1.2 2" ${S}/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>`,

  arrowUp: `<path d="M12 19 V6 M6 11 L12 5 L18 11" ${S}/>`,

  wrench: `<path d="M14.7 6.3 a4 4 0 0 1-5.4 5.4 L4 17 l3 3 l5.3-5.3 a4 4 0 0 1 5.4-5.4 l-2.6 2.6 l-2-.6 l-.6-2 Z" ${S}/>`,

  rocket: `<path d="M12 3 C16 6 17 10 16 15 l-4 4 l-4-4 C7 10 8 6 12 3 Z" ${S}/><circle cx="12" cy="10" r="1.7" ${S}/><path d="M9 15 l-2.4 4 M15 15 l2.4 4" ${S}/>`,

  medal: `<circle cx="12" cy="9" r="5.5" ${S}/><path d="M9 13.6 L7 21 l5-2.4 l5 2.4 l-2-7.4" ${S}/>`,
};

/** @param {keyof ICONS} name */
export function iconInner(name) {
  return ICONS[name] || ICONS.help;
}
