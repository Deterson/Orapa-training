import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    // La logique du jeu ne doit jamais dépendre du navigateur (voir CLAUDE.md).
    files: ['src/game/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'navigator',
      ],
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
