import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, type Plugin} from 'vite';

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

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), versionFilePlugin()],
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
