import { defineConfig } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

/**
 * Dev-only screenshot sink.
 *
 * The build captures ~30 progress screenshots of the live WebGL canvas. Passing
 * each one back through the agent as base64 would cost hundreds of KB of
 * context per shot, so the page POSTs the PNG straight to disk instead.
 *
 *   POST /__shot?name=phase1  body: <dataURL or raw base64>
 *   -> docs/progress/phase1.png
 *
 * Dev server only; it is not part of the production build.
 */
function screenshotSink() {
  return {
    name: 'screenshot-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('POST only');
        }
        const url = new URL(req.url, 'http://localhost');
        const name = (url.searchParams.get('name') || 'shot').replace(/[^a-z0-9._-]/gi, '_');

        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const b64 = body.trim().replace(/^data:image\/png;base64,/, '');
            if (!b64) throw new Error('empty body');
            const dir = resolve(process.cwd(), 'docs/progress');
            mkdirSync(dir, { recursive: true });
            const out = resolve(dir, `${name}.png`);
            writeFileSync(out, Buffer.from(b64, 'base64'));
            res.statusCode = 200;
            res.end(out);
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err?.message || err));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [screenshotSink()],
  server: {
    host: '0.0.0.0',
    // Nothing the game loads lives in these, and the tests write hundreds of
    // screenshots into docs/progress: watching them only caused needless page
    // reloads (editing a .md reloaded Chapter 4 mid-flight) and file-watcher
    // errors on Windows that can take the whole server down (a blank page).
    // `.claude` is matched RELATIVE to this folder: a copy of the project
    // checked out under .claude/worktrees/ (a separate lab server) would
    // otherwise ignore every one of its own files and serve stale code.
    watch: { ignored: ['**/docs/**', '**/*.md', '**/scripts/**', '**/dist/**', (p) => relative(process.cwd(), p).split(/[\\/]/)[0] === '.claude'] },
  },
  // A lab copy (.claude/worktrees/*) shares node_modules with the main
  // checkout through a junction; its own dependency cache keeps the two dev
  // servers from rewriting each other's optimised deps.
  cacheDir: /[\\/]\.claude[\\/]worktrees[\\/]/.test(process.cwd()) ? '.vite-lab' : 'node_modules/.vite',
  // Relative asset URLs, so a built copy works wherever it is served from - the
  // domain root, a sub-path, or a static host that mounts it under an id. Every
  // runtime asset path goes through contracts.js `asset()`, which reads the
  // same base, so the two can never disagree.
  base: './',
  build: {
    rollupOptions: {
      // Two pages: the game, and the character builder. Without naming them
      // here Vite builds only index.html and character.html ships broken.
      // index.html is the LAUNCHER - name, look, chapter menu - and every
      // chapter is its own page. (The old single-file 2-D Chapters 1 and 2
      // were retired to docs/legacy-chapters/ as the spec; not shipped.)
      input: {
        main: resolve(process.cwd(), 'index.html'),
        chapter1: resolve(process.cwd(), 'chapter1.html'),
        chapter2: resolve(process.cwd(), 'chapter2.html'),
        chapter3: resolve(process.cwd(), 'chapter3.html'),
        character: resolve(process.cwd(), 'character.html'),
        chapter4: resolve(process.cwd(), 'chapter4.html'),
        chapter5: resolve(process.cwd(), 'chapter5.html'),
        chapter6: resolve(process.cwd(), 'chapter6.html'),
        chapter7: resolve(process.cwd(), 'chapter7.html'),
      },
    },
  },
});
