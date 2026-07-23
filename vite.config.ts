import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv, type Plugin} from 'vite';

const SITE_URL = 'https://pimastay.com';

// Writes dist/version.json with a fresh build id on every production build.
// The client (src/lib/versionCheck.ts) polls this file to detect a new
// deploy and show a non-intrusive "update available" banner — see App.tsx.
function versionFilePlugin(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir || 'dist';
      fs.writeFileSync(path.join(outDir, 'version.json'), JSON.stringify({ version: String(Date.now()) }));
    },
  };
}

// Generates dist/sitemap.xml on every production build. Pulls the list of
// approved houses from Supabase (anon key + RLS => only public rows) so every
// listing gets its own crawlable URL. Fail-soft: any error still emits a valid
// sitemap with the homepage so a build never breaks over SEO plumbing.
function sitemapPlugin(supabaseUrl: string, anonKey: string): Plugin {
  return {
    name: 'sitemap',
    apply: 'build',
    async writeBundle(options) {
      const outDir = options.dir || 'dist';
      const today = new Date().toISOString().slice(0, 10);
      const urls: { loc: string; lastmod?: string; priority: string }[] = [
        { loc: `${SITE_URL}/`, lastmod: today, priority: '1.0' },
      ];
      try {
        if (supabaseUrl && anonKey) {
          const res = await fetch(
            `${supabaseUrl}/rest/v1/houses?select=id,created_at&status=eq.approved`,
            { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
          );
          if (res.ok) {
            const rows = (await res.json()) as { id: string; created_at?: string }[];
            for (const r of rows) {
              urls.push({
                loc: `${SITE_URL}/?house=${encodeURIComponent(r.id)}`,
                lastmod: (r.created_at || '').slice(0, 10) || today,
                priority: '0.8',
              });
            }
            console.log(`[sitemap] ${rows.length} approved houses included`);
          } else {
            console.warn(`[sitemap] houses fetch failed (${res.status}); homepage-only sitemap`);
          }
        } else {
          console.warn('[sitemap] Supabase env missing; homepage-only sitemap');
        }
      } catch (e) {
        console.warn('[sitemap] error; homepage-only sitemap:', (e as Error).message);
      }
      const body = urls
        .map(
          (u) =>
            `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
        )
        .join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      versionFilePlugin(),
      sitemapPlugin(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
