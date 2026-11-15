import { readFileSync } from 'node:fs';
import { type Plugin, loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

/**
 * Politique de sécurité du contenu, ajoutée au build seulement (le serveur de développement a
 * besoin de scripts en ligne et de WebSocket). Elle limite les dégâts d'une éventuelle faille
 * d'injection de script : rien ne s'exécute hors des fichiers du site, et les seules requêtes
 * sortantes permises vont au projet Supabase configuré. Avatars : images https de Google.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  let supabaseOrigin = '';
  try {
    if (supabaseUrl) {
      const url = new URL(supabaseUrl);
      if (url.protocol === 'https:') supabaseOrigin = url.origin;
    }
  } catch {
    // Adresse invalide : le site n'utilisera pas Supabase non plus (voir src/backend/config.ts).
  }
  const policy = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.googleusercontent.com",
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ');
  return {
    name: 'orapa-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // Chemins relatifs : le site marche à la racine d'un domaine comme dans un sous-dossier
    // (GitHub Pages sert le dépôt sous /<nom-du-dépôt>/).
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [contentSecurityPolicy(env['VITE_SUPABASE_URL'])],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
      // Le délai par défaut de 5 s est trop juste pour les tests qui génèrent beaucoup de mines sur
      // une machine chargée (CI, serveur de développement en parallèle).
      testTimeout: 60_000,
    },
  };
});
