import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://billwright.pages.dev',
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
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
