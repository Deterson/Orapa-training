import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  // Chemins relatifs : le site marche à la racine d'un domaine comme dans un sous-dossier
  // (GitHub Pages sert le dépôt sous /<nom-du-dépôt>/).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Les tests du solveur d'unicité explorent beaucoup de dispositions : le délai par défaut
    // de 5 s est trop juste sur une machine chargée (CI, serveur de développement en parallèle).
    testTimeout: 60_000,
  },
});
