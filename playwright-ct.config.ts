import { defineConfig, devices } from '@playwright/experimental-ct-vue';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Playwright component testing config.
 *
 * Deliberately separate from playwright.config.ts: component tests mount real
 * dashboard SFCs in a Vite build and need none of the e2e cluster/auth setup,
 * so nothing here is shared with (or able to affect) the e2e run.
 *
 * The dashboard checkout is resolved at build time, never hardcoded:
 *   DASHBOARD_ROOT=/path/to/dashboard npx playwright test -c playwright-ct.config.ts
 */
const CT_ROOT = __dirname;
const DASHBOARD_ROOT = path.resolve(CT_ROOT, process.env.DASHBOARD_ROOT ?? '../dashboard');

/**
 * Passing our own plugin list makes component testing skip its injected Vue
 * plugin, so the plugin is registered here. `script.fs` is required: without it
 * @vue/compiler-sfc cannot resolve props typed with imported types
 * (RcSeparator, RcButton, ...) and the build fails.
 */
const vueWithFs = vue({
  script: {
    fs: {
      fileExists: (f: string) => fs.existsSync(f),
      readFile: (f: string) => fs.readFileSync(f, 'utf-8'),
      realpath: (f: string) => fs.realpathSync(f),
    },
  } as any,
});

export default defineConfig({
  testDir: './component-tests',
  outputDir: './component-tests/test-results',
  timeout: 30_000,
  use: {
    ctPort: 3100,
    // Same as the e2e config: on NixOS the devshell points at system Chromium
    // because Playwright's bundled build cannot load its shared libraries.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
    ctViteConfig: {
      plugins: [vueWithFs],
      // LabeledSelect and friends use scoped SCSS built on the app's globals.
      css: {
        preprocessorOptions: {
          scss: {
            loadPaths: [path.join(CT_ROOT, 'playwright'), path.join(DASHBOARD_ROOT, 'shell/assets/styles')],
            additionalData: '@import "vars";',
            silenceDeprecations: ['import', 'global-builtin'],
          },
        },
      },
      resolve: {
        dedupe: ['vue', 'vuex', 'vue-select', 'vee-validate', 'lodash'],
        alias: [
          { find: /^@shell$/, replacement: path.join(DASHBOARD_ROOT, 'shell') },
          { find: /^@shell\/(.*)$/, replacement: path.join(DASHBOARD_ROOT, 'shell/$1') },
          { find: /^~shell\/(.*)$/, replacement: path.join(DASHBOARD_ROOT, 'shell/$1') },
          {
            find: /^@components\/(.*)$/,
            replacement: path.join(DASHBOARD_ROOT, 'pkg/rancher-components/src/components/$1'),
          },
          { find: /^@pkg\/(.*)$/, replacement: path.join(DASHBOARD_ROOT, 'pkg/$1') },
          { find: /^@\/(.*)$/, replacement: path.join(DASHBOARD_ROOT, '$1') },
          { find: /^~\/(.*)$/, replacement: path.join(DASHBOARD_ROOT, '$1') },
        ],
      },
      server: { fs: { allow: [DASHBOARD_ROOT, CT_ROOT] } },
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
