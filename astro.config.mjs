import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Reads KEY=value lines from .dev.vars, the file wrangler uses for secrets. */
function readDevVars() {
  const file = fileURLToPath(new URL('./.dev.vars', import.meta.url));
  if (!existsSync(file)) return {};
  const vars = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) vars[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return vars;
}

/**
 * `astro dev` knows nothing about Cloudflare Pages Functions, so without this
 * /api/* answers with a 404 page and the AI boxes cannot work. In dev only,
 * it runs functions/api/<name>.ts in-process with .dev.vars as the env. The
 * key is re-read on every request, so adding it needs no restart.
 */
function pagesFunctionsInDev() {
  return {
    name: 'billwright:pages-functions-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const match = url.pathname.match(/^\/api\/([a-z-]+)$/);
        if (!match) return next();

        const file = fileURLToPath(new URL(`./functions/api/${match[1]}.ts`, import.meta.url));
        if (!existsSync(file)) return next();

        try {
          const mod = await server.ssrLoadModule(file);
          const handler = req.method === 'POST' ? mod.onRequestPost : mod.onRequestGet;
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }

          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
          }
          const request = new Request(url, {
            method: req.method,
            headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });

          const env = {
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            ...readDevVars(),
            // No KV namespace exists locally, so the quota is skipped in dev.
            AI_ALLOW_UNLIMITED: 'true',
          };

          const response = await handler({ request, env });
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          console.error('[pages-functions-dev]', error);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'The local function crashed. See the terminal.' }));
        }
      });
    },
  };
}

export default defineConfig({
  site: 'https://billwright.work',
  output: 'static',
  integrations: [
    sitemap({
      // Cloudflare Pages resolves /page/ to /page, which is what the canonical
      // tags point at — the sitemap has to agree with them.
      serialize(item) {
        item.url = item.url.replace(/(.+)\/$/, '$1');
        return item;
      },
    }),
  ],
  vite: { plugins: [pagesFunctionsInDev()] },
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
