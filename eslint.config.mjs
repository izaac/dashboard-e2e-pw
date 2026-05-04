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
  // PO + support files — relaxed boundary types (upstream does this) + lightweight
  // Playwright guardrails for the sleep / force-click rules. Avoid pulling
  // `flat/recommended` whole-cloth here: POs legitimately use raw locators and
  // chained `.locator(...)` selectors (that's literally what they are for), so
  // `no-raw-locators` and most other recommended rules would create noise.
  {
    files: ['e2e/po/**/*.ts', 'support/utils/**/*.ts'],
    plugins: {
      playwright: playwrightPlugin,
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Sleeps in Page Objects are a known flake source — every spec using the
      // PO inherits the timing assumption. Allow with `eslint-disable-next-line`
      // + reason for the genuine debounce / canvas-render escape hatches.
      'playwright/no-wait-for-timeout': 'warn',
      'playwright/no-force-option': 'warn',
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

      // --- Guardrails (graduated to warn so existing intentional uses can be
      //     annotated with eslint-disable-next-line + reason before promoting
      //     to error). flat/recommended sets these to warn already; we keep
      //     them explicit here so future contributors see the intent. ---
      // Documented debounce/transition waits — acceptable when annotated.
      'playwright/no-wait-for-timeout': 'warn',
      // Rancher menus require force clicks due to overlapping elements;
      // each site must annotate.
      'playwright/no-force-option': 'warn',
      // Specs should not contain raw `page.locator(...)` or chained
      // `.locator(...)` selectors — POs own those. Setup/auth files override.
      'playwright/no-raw-locators': 'warn',

      // --- Rules that MUST stay on ---
      'playwright/no-conditional-expect': 'warn',
      'playwright/expect-expect': 'warn',

      // --- Spec import discipline ---
      // `test` and `expect` must come from `@/support/fixtures` (which adds
      // the project's custom fixtures). Direct imports from `@playwright/test`
      // bypass them and cause `login`, `rancherApi`, `envMeta`, etc. to be
      // missing on the test fixture argument.
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@playwright/test',
              importNames: ['test', 'expect'],
              message: "Import 'test' and 'expect' from '@/support/fixtures' instead — that file re-exports them with the project's custom fixtures.",
            },
          ],
        },
      ],
    },
  },
  // Setup files exempt from spec-only rules (they bootstrap auth/state and
  // are allowed to use raw locators + import directly from @playwright/test).
  {
    files: ['e2e/tests/auth.setup.ts', 'e2e/tests/*.setup.ts'],
    rules: {
      'playwright/no-raw-locators': 'off',
      'no-restricted-imports': 'off',
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
