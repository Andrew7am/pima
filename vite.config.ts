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

// ---- SEO prerendering -------------------------------------------------------
// Shape of an approved house as pulled from Supabase for static generation.
interface SeoHouse {
  id: string;
  name: string;
  description: string;
  governorate: string;
  address: string;
  lat: number;
  lng: number;
  rooms_count: number;
  beds_count: number;
  price_per_night_per_person: number;
  services: string[];
  images: string[];
  rating: number;
  reviews_count: number;
  property_type?: string;
  created_at?: string;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: unknown) =>
  esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const trunc = (s: string, n: number) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const propTypeLabel = (t?: string) =>
  t === 'student' ? 'سكن طلاب' : t === 'staff' ? 'سكن موظفين' : 'بيت مؤتمرات';

// Build the per-house <head> SEO block (replaces the SEO:START..SEO:END region).
function houseHead(h: SeoHouse): string {
  const label = propTypeLabel(h.property_type);
  const title = `${h.name} — ${label} في ${h.governorate} | بيما`;
  const desc =
    trunc(h.description, 155) ||
    `${label} ${h.name} في ${h.governorate} — ${h.rooms_count} غرفة و${h.beds_count} سرير بسعر ${h.price_per_night_per_person} ج.م لليلة للفرد. احجز أونلاين عبر بيما.`;
  const url = `${SITE_URL}/house/${encodeURIComponent(h.id)}/`;
  const img = (h.images || []).find((i) => /^https?:\/\//.test(i)) || `${SITE_URL}/pima-hero.png`;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: h.name,
    description: trunc(h.description, 300),
    url,
    image: img,
    address: {
      '@type': 'PostalAddress',
      addressRegion: h.governorate,
      addressLocality: h.governorate,
      streetAddress: h.address || undefined,
      addressCountry: 'EG',
    },
    priceRange: `${h.price_per_night_per_person} EGP`,
  };
  if (h.lat && h.lng) ld.geo = { '@type': 'GeoCoordinates', latitude: h.lat, longitude: h.lng };
  if (h.reviews_count > 0 && h.rating > 0)
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: h.rating,
      reviewCount: h.reviews_count,
      bestRating: 5,
    };
  return [
    '<!-- SEO:START (house) -->',
    `    <title>${esc(title)}</title>`,
    `    <meta name="description" content="${escAttr(desc)}" />`,
    '    <meta name="robots" content="index, follow, max-image-preview:large" />',
    `    <link rel="canonical" href="${url}" />`,
    '    <meta property="og:type" content="website" />',
    '    <meta property="og:site_name" content="بيما" />',
    '    <meta property="og:locale" content="ar_EG" />',
    `    <meta property="og:title" content="${escAttr(title)}" />`,
    `    <meta property="og:description" content="${escAttr(desc)}" />`,
    `    <meta property="og:url" content="${url}" />`,
    `    <meta property="og:image" content="${escAttr(img)}" />`,
    `    <meta property="og:image:alt" content="${escAttr(h.name)}" />`,
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${escAttr(title)}" />`,
    `    <meta name="twitter:description" content="${escAttr(desc)}" />`,
    `    <meta name="twitter:image" content="${escAttr(img)}" />`,
    `    <script type="application/ld+json">\n${JSON.stringify(ld)}\n    </script>`,
    '    <!-- SEO:END -->',
  ].join('\n');
}

// Build the crawlable per-house shell (replaces the SHELL:START..SHELL:END region).
function houseShell(h: SeoHouse): string {
  const label = propTypeLabel(h.property_type);
  const services = (h.services || []).slice(0, 12).map((s) => `<li>${esc(s)}</li>`).join('');
  return `<!-- SHELL:START -->
      <div style="max-width:760px;margin:0 auto;padding:24px;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;color:#2D2D1F;line-height:1.9" dir="rtl">
        <a href="/" style="color:#3A6B4C;font-weight:700;text-decoration:none">بيما — الرئيسية</a>
        <h1 style="font-size:26px;font-weight:900;margin:16px 0 6px">${esc(h.name)}</h1>
        <p style="color:#3A6B4C;font-weight:700;margin:0 0 12px">${esc(label)} في محافظة ${esc(h.governorate)}${h.address ? ` — ${esc(h.address)}` : ''}</p>
        <p style="margin:0 0 16px">${esc(trunc(h.description, 500))}</p>
        <ul style="list-style:none;padding:0;margin:0 0 16px;display:flex;flex-wrap:wrap;gap:8px 20px;font-weight:700">
          <li>السعر: ${esc(h.price_per_night_per_person)} ج.م / ليلة للفرد</li>
          <li>عدد الغرف: ${esc(h.rooms_count)}</li>
          <li>عدد الأسرّة: ${esc(h.beds_count)}</li>
          ${h.reviews_count > 0 ? `<li>التقييم: ${esc(h.rating)} من 5 (${esc(h.reviews_count)} تقييم)</li>` : ''}
        </ul>
        ${services ? `<h2 style="font-size:16px;font-weight:900;margin:0 0 8px">الخدمات والمرافق</h2><ul style="margin:0 0 16px;padding-inline-start:20px">${services}</ul>` : ''}
        <p style="color:#8A8A70;font-size:13px;margin-top:20px">جارٍ تحميل التطبيق لعرض الصور والأسعار الموسمية والحجز…</p>
        <noscript><p>لعرض الصور والحجز يلزم تفعيل JavaScript. للتواصل والحجز افتح ${escAttr(SITE_URL)}.</p></noscript>
      </div>
    <!-- SHELL:END -->`;
}

// Generates dist/sitemap.xml + a static, crawlable dist/house/<id>/index.html for
// every approved house. Pulls houses from Supabase (anon key + RLS => only public
// rows). Fail-soft: any error still emits a valid homepage-only sitemap so a build
// never breaks over SEO plumbing. The prerendered files are the same SPA bundle
// with the SEO <head> and #root shell swapped for house-specific content, so a
// no-JS crawler indexes real content and React still hydrates the full app.
function seoPagesPlugin(supabaseUrl: string, anonKey: string): Plugin {
  return {
    name: 'seo-pages',
    apply: 'build',
    async writeBundle(options) {
      const outDir = options.dir || 'dist';
      const today = new Date().toISOString().slice(0, 10);
      const urls: { loc: string; lastmod?: string; priority: string }[] = [
        { loc: `${SITE_URL}/`, lastmod: today, priority: '1.0' },
      ];
      let template = '';
      try {
        template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      } catch {
        console.warn('[seo-pages] dist/index.html missing; skipping house prerender');
      }
      const seoRe = /<!-- SEO:START[\s\S]*?SEO:END -->/;
      const shellRe = /<!-- SHELL:START -->[\s\S]*?<!-- SHELL:END -->/;
      const safeId = /^[A-Za-z0-9_-]+$/;

      try {
        if (supabaseUrl && anonKey) {
          const cols =
            'id,name,description,governorate,address,lat,lng,rooms_count,beds_count,price_per_night_per_person,services,images,rating,reviews_count,property_type,created_at';
          const res = await fetch(
            `${supabaseUrl}/rest/v1/houses?select=${cols}&status=eq.approved`,
            { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
          );
          if (res.ok) {
            const rows = (await res.json()) as SeoHouse[];
            let prerendered = 0;
            for (const h of rows) {
              urls.push({
                loc: `${SITE_URL}/house/${encodeURIComponent(h.id)}/`,
                lastmod: (h.created_at || '').slice(0, 10) || today,
                priority: '0.8',
              });
              if (template && safeId.test(h.id) && seoRe.test(template) && shellRe.test(template)) {
                const page = template.replace(seoRe, houseHead(h)).replace(shellRe, houseShell(h));
                const dir = path.join(outDir, 'house', h.id);
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, 'index.html'), page);
                prerendered++;
              }
            }
            console.log(`[seo-pages] ${rows.length} houses in sitemap, ${prerendered} prerendered`);
          } else {
            console.warn(`[seo-pages] houses fetch failed (${res.status}); homepage-only`);
          }
        } else {
          console.warn('[seo-pages] Supabase env missing; homepage-only sitemap');
        }
      } catch (e) {
        console.warn('[seo-pages] error; homepage-only sitemap:', (e as Error).message);
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
      seoPagesPlugin(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Split the heaviest third-party libs into their own long-cached chunks
      // so the initial app bundle is smaller and a code change doesn't bust
      // the vendor cache. Screens are already route-level lazy-loaded.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('leaflet')) return 'vendor-leaflet';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router') || id.includes('/scheduler/')) return 'vendor-react';
            return 'vendor';
          },
        },
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
