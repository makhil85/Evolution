// Lab only: a full in-game screenshot (3-D view + HUD + minimap) saved through
// the dev server's /__shot sink to docs/progress/<name>.png. game.debugShot
// captures only the WebGL canvas; the HUD is DOM, so it is rasterised here by
// drawing a snapshot of the page's own markup and styles inside an SVG
// <foreignObject>, and the minimap's canvas (which a DOM snapshot can't
// carry) is drawn on at its real position. Works in a hidden tab.
//
//   const S = await import('/src/space/lab/fullshot.js'); await S.fullShot('name');

const load = (src) => new Promise((ok, bad) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = bad;
  i.src = src;
});

export async function fullShot(name) {
  const g = window.__space;
  const W = innerWidth;
  const H = innerHeight;
  g.debugRun(1 / 60, 1 / 60); // render, then read before the buffer clears
  const bg = g.renderer.domElement.toDataURL('image/png');

  const rootVars = `${document.documentElement.style.cssText};${document.body.style.cssText}`;
  // CDATA: page CSS may hold & and < that would break the SVG's XML.
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
    .replace(/@import[^;]+;/g, '').replace(/]]>/g, '')
    // Rules on <body> (e.g. body.in-scene hides the flight HUD on foot) apply
    // to the wrapper that stands in for it.
    .replace(/\bbody\./g, '.fullshot-body.')
    // A snapshot has no time: entry animations would sit on their first
    // (often invisible) frame, so show everything at rest.
    + '\n*, *::before, *::after { animation: none !important; transition: none !important; }';
  const ser = new XMLSerializer();
  const hud = document.querySelector('.sp-hud');
  const cue = document.getElementById('burnCue');
  // Icons flying into the HUD (hud/tally.js, beltFx.js) are Web Animations on
  // <body>: bake their current transform in so the snapshot shows them mid-air.
  const flying = [...document.querySelectorAll('[data-fly]')].map((n) => {
    const cs = getComputedStyle(n);
    const c = n.cloneNode(true);
    c.style.transform = cs.transform;
    c.style.opacity = cs.opacity;
    return ser.serializeToString(c);
  }).join('');
  const html = ser.serializeToString(hud) + (cue && cue.style.display !== 'none' ? ser.serializeToString(cue) : '') + flying;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" class="fullshot-body ${document.body.className}" style="position:relative;width:${W}px;height:${H}px;${rootVars}">`
    + `<style><![CDATA[${css}]]></style>${html}</div></foreignObject></svg>`;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const c = out.getContext('2d');
  c.drawImage(await load(bg), 0, 0, W, H);
  // HUD canvases (the inset map, the transfer dial) at their real positions.
  // Under an open card or the big map they go in BEFORE the DOM layer, so the
  // dim covers them as it does on screen (drawn last, the inset map sat on
  // top of the pause menu's dim in every snapshot).
  const overlay = [...document.querySelectorAll('.sp-hud .sp-modal, .sp-hud .sp-map')].find((o) => !o.hidden && o.offsetParent !== null);
  const canvases = [...document.querySelectorAll('.sp-hud canvas')].filter((cv) => cv.offsetParent && cv.width);
  const paint = (list) => { for (const cv of list) { const r = cv.getBoundingClientRect(); c.drawImage(cv, r.left, r.top, r.width, r.height); } };
  const under = overlay ? canvases.filter((cv) => !overlay.contains(cv)) : [];
  paint(under);
  c.drawImage(await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), 0, 0);
  paint(canvases.filter((cv) => !under.includes(cv)));
  const res = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: out.toDataURL('image/png') });
  return res.ok ? `docs/progress/${name}.png` : `failed ${res.status}`;
}
