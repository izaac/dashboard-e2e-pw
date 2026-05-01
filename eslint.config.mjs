import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import playwrightPlugin from 'eslint-plugin-playwright';

/**
 * ESLint flat config — aligned with upstream Rancher Dashboard rules
 * where applicable to a pure TypeScript/Playwright project.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      'browser-logs/**',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // --- Formatting rules disabled — Prettier owns these ---
      semi:                          'off',
      indent:                        'off',
      quotes:                        'off',
      'comma-dangle':                'off',
      'object-curly-spacing':        'off',
      'arrow-spacing':               'off',
      'arrow-parens':                'off',
      'block-spacing':               'off',
      'brace-style':                 'off',
      'keyword-spacing':             'off',
      'space-infix-ops':             'off',
      'space-before-function-paren': 'off',
      'no-trailing-spaces':          'off',
      'no-whitespace-before-property': 'off',
      'rest-spread-spacing':         'off',
      'template-curly-spacing':      'off',
      'padded-blocks':               'off',

      // --- Code quality rules ---
      'object-shorthand':            'warn',
      'prefer-template':             'warn',
      'prefer-arrow-callback':       'warn',
      'prefer-const':                'error',
      'no-var':                      'error',
      curly:                         'warn',
      eqeqeq:                        'warn',
      'no-console':                  ['warn', { allow: ['warn', 'error'] }],
      'no-debugger':                 'warn',
      'no-eval':                     'warn',
      'no-caller':                   'warn',
      'no-eq-null':                  'warn',
      'no-cond-assign':              ['warn', 'except-parens'],

      // Lines between class members (upstream pattern)
      'lines-between-class-members': ['warn', 'always', { exceptAfterSingleLine: true }],

      // Blank line before return, between function decls, after variable decls
      'padding-line-between-statements': [
        'warn',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'function', next: 'function' },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
      ],

      // --- Defensive code guards ---
      'no-empty':                    ['warn', { allowEmptyCatch: false }],
      'no-useless-catch':            'warn',

      // --- TypeScript ---
      '@typescript-eslint/no-unused-vars':          ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any':          'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-empty-function':        'off',
      '@typescript-eslint/no-redeclare':             'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  // PO files — relaxed boundary types (upstream does this)
  {
    files: ['e2e/po/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  // Spec files — Playwright rules
  {
    files: ['e2e/tests/**/*.spec.ts'],
    ...playwrightPlugin.configs['flat/recommended'],
    rules: {
      ...playwrightPlugin.configs['flat/recommended'].rules,

      // --- Intentionally relaxed rules ---
      // test.skip(!envMeta.x, 'reason') is our standard pattern for
      // environment-dependent tests (missing infra, credentials, etc.)
      'playwright/no-skipped-test': 'off',
      'playwright/no-conditional-in-test': 'off',

      // Documented debounce/transition waits — acceptable when annotated
      'playwright/no-wait-for-timeout': 'off',

      // Rancher menus require force clicks due to overlapping elements
      'playwright/no-force-option': 'off',

      // --- Rules that MUST stay on ---
      'playwright/no-conditional-expect': 'warn',
      'playwright/expect-expect': 'warn',
    },
  },
  // Scripts — allow console.log (they are CLI tools)
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // Playwright configs, setup files, and fixtures — startup/diagnostic logs are intentional
  {
    files: [
      'playwright.config*.ts',
      'e2e/tests/*.setup.ts',
      'support/fixtures/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
];
