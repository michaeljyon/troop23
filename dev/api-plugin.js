// Vite plugin: serves /api/* during `npm run dev` and `npm run preview` with
// the same code the Netlify Function runs, backed by a local .data folder.
// Local defaults: troop code "troop23", leader passcode "leader".
import path from 'node:path';
import { fileStore } from './file-store.js';
import troop from '../troop/troop.js';

export default function devApi() {
  let handle;
  const mount = (server) => {
    const store = fileStore(path.resolve('.data', `basecamp-${troop.id}`));
    server.middlewares.use(async (req, res, next) => {
      if (!req.url.startsWith('/api/')) return next();
      try {
        handle ||= (await import('../netlify/lib/core.mjs')).handle;
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const request = new Request(`http://localhost${req.url}`, {
          method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
        });
        const out = await handle(request, {
          store,
          troopCode: process.env.TROOP_CODE || 'troop23',
          leaderPasscode: process.env.LEADER_PASSCODE || 'leader',
        });
        res.statusCode = out.status;
        out.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await out.arrayBuffer()));
      } catch (e) {
        console.error(e); res.statusCode = 500; res.end('dev api error');
      }
    });
  };
  return { name: 'dev-api', configureServer: mount, configurePreviewServer: mount };
}
