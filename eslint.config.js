import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'dist/', 'scripts/.cache/', '.claude/'] },
  js.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', '*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
  },
  {
    files: ['module/scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        foundry: 'readonly',
        game: 'readonly',
        Hooks: 'readonly',
        CONFIG: 'readonly',
        ui: 'readonly',
        fromUuid: 'readonly',
        fromUuidSync: 'readonly',
      },
    },
  },
];
