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
      // --- Upstream-aligned rules ---
      semi:                          ['warn', 'always'],
      indent:                        ['warn', 2],
      quotes:                        ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'comma-dangle':                ['warn', 'only-multiline'],
      'object-curly-spacing':        ['warn', 'always'],
      'arrow-spacing':               ['warn', { before: true, after: true }],
      'arrow-parens':                'warn',
      'block-spacing':               ['warn', 'always'],
      'brace-style':                 ['warn', '1tbs'],
      'keyword-spacing':             'warn',
      'space-infix-ops':             'warn',
      'space-before-function-paren': ['warn', 'never'],
      'no-trailing-spaces':          'warn',
      'no-whitespace-before-property': 'warn',
      'rest-spread-spacing':         'warn',
      'template-curly-spacing':      ['warn', 'always'],
      'padded-blocks':               ['warn', 'never'],
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
      'playwright/no-wait-for-timeout': 'warn',
      'playwright/no-conditional-in-test': 'warn',
    },
  },
];
