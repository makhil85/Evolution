// Lab only: a full screenshot of any village page (Chapters 1-3, the launcher)
// saved through the dev server's /__shot sink to docs/progress/<name>.png.
// Same method as src/space/lab/fullshot.js: the WebGL frame (the villages
// keep preserveDrawingBuffer on), then every DOM overlay on <body> drawn over
// it from an SVG <foreignObject>.
//
//   const S = await import('/src/lab/shot.js'); await S.shot('name');

const load = (src) => new Promise((ok, bad) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = bad;
  i.src = src;
});

export async function shot(name) {
  const W = innerWidth;
  const H = innerHeight;
  // Render one frame now so the buffer holds the current view.
  (window.__scienceRun || window.__cityRun || window.__gameRun)?.(1 / 60);
  const canvas = [...document.querySelectorAll('body > canvas, canvas')]
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];

  // Every same-origin sheet (<style> and <link>), as the browser parsed it.
  const css = [...document.styleSheets].map((sh) => {
    try { return [...sh.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; }
  }).join('\n')
    .replace(/@import[^;]+;/g, '').replace(/]]>/g, '')
    .replace(/\bbody\./g, '.shot-body.')
    + '\n*, *::before, *::after { animation: none !important; transition: none !important; }';
  const ser = new XMLSerializer();
  const parts = [...document.body.children]
    .filter((n) => !['CANVAS', 'SCRIPT', 'STYLE', 'LINK'].includes(n.tagName) && getComputedStyle(n).display !== 'none')
    .map((n) => ser.serializeToString(n)).join('');
  const bcs = getComputedStyle(document.body);
  // Plain `body {}` rules (font, colour) don't reach the stand-in wrapper.
  const bodyBg = `${canvas ? 'transparent' : bcs.background};font:${bcs.font.replace(/"/g, "'")};color:${bcs.color}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" class="shot-body ${document.body.className}" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${bodyBg};${document.documentElement.style.cssText}">`
    + `<style><![CDATA[${css}]]></style>${parts}</div></foreignObject></svg>`;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const c = out.getContext('2d');
  if (canvas) c.drawImage(await load(canvas.toDataURL('image/png')), 0, 0, W, H);
  c.drawImage(await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), 0, 0);
  const res = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: out.toDataURL('image/png') });
  return res.ok ? `docs/progress/${name}.png` : `failed ${res.status}`;
}
