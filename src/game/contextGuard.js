// Never leave a blank screen when the graphics card drops the 3-D picture.
//
// A browser can take the WebGL context away (a busy or older laptop, a
// driver hiccup, another tab hogging the GPU). three.js then draws nothing
// and the canvas stays blank for good, while the HUD carries on as if all
// were well. Every chapter saves as she plays, so the kind fix is: save,
// say what is happening, and reload - she comes back where she was.
//
// Used by all four chapters. `save` is optional (the villages save on every
// action already).

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {{ save?: () => void, delayMs?: number }} [opts]
 */
export function guardContext(renderer, { save, delayMs = 1800 } = {}) {
  const canvas = renderer.domElement;
  let handled = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // lets the browser hand the context back if it can
    if (handled) return;
    handled = true;
    try { save?.(); } catch { /* reloading anyway */ }
    showNotice();
    setTimeout(() => location.reload(), delayMs);
  }, false);
}

function showNotice() {
  const box = document.createElement('div');
  box.setAttribute('role', 'status');
  box.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:100000', 'display:flex',
    'flex-direction:column', 'align-items:center', 'justify-content:center',
    'gap:8px', 'background:#0b0f1a', 'color:#e8ecf5',
    'font:600 20px/1.3 system-ui,sans-serif', 'text-align:center', 'padding:24px',
  ].join(';');
  const h = document.createElement('div');
  h.textContent = 'The picture needs a moment to come back…';
  const p = document.createElement('div');
  p.style.cssText = 'font-weight:400;font-size:14px;color:#9aa3b8';
  p.textContent = 'Your progress is saved. The game will reload by itself.';
  box.append(h, p);
  document.body.appendChild(box);
}
