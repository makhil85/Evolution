// Lab only: a full in-game screenshot of Chapter 1 (3-D view + HUD) saved
// through the dev server's /__shot sink to docs/progress/<name>.png. Same
// method as src/space/lab/fullshot.js: the WebGL frame, then the HUD's own
// markup and styles drawn over it from an SVG <foreignObject>.
//
//   const S = await import('/src/science/lab/shot.js'); await S.scienceShot('name');

const load = (src) => new Promise((ok, bad) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = bad;
  i.src = src;
});

export async function scienceShot(name) {
  const W = innerWidth;
  const H = innerHeight;
  window.__scienceRun?.(1 / 60); // render now, read before the buffer is reused
  const bg = window.__science.renderer.domElement.toDataURL('image/png');

  const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
    .replace(/@import[^;]+;/g, '').replace(/]]>/g, '')
    // The page's own html/body rules (a dark background) must not paint the
    // overlay layer over the 3-D frame.
    .replace(/\b(html|body)\b(?=[.:\s{,])/g, '.shot-unused')
    + '\n*, *::before, *::after { animation: none !important; transition: none !important; }';
  const ser = new XMLSerializer();
  const parts = [...document.querySelectorAll('.rv-hud, #rvBackToChapters')].map((n) => ser.serializeToString(n)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" class="shot-body" style="position:relative;width:${W}px;height:${H}px;font-family:system-ui,sans-serif">`
    + `<style><![CDATA[${css}]]></style>${parts}</div></foreignObject></svg>`;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const c = out.getContext('2d');
  c.drawImage(await load(bg), 0, 0, W, H);
  c.drawImage(await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), 0, 0);
  const res = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: out.toDataURL('image/png') });
  return res.ok ? `docs/progress/${name}.png` : `failed ${res.status}`;
}
