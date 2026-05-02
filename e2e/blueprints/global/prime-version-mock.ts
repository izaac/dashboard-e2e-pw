import type { Page } from '@playwright/test';

/**
 * Intercept `/rancherversion` and force `RancherPrime: 'true'` so `@prime`-tagged
 * tests can run against any local Rancher (community or Prime) without flipping
 * the backend. Mirrors the upstream cypress pattern in
 * `cypress/e2e/tests/pages/generic/prime.spec.ts`.
 */
export async function interceptVersionAndSetToPrime(page: Page): Promise<void> {
  await page.route('**/rancherversion', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        Version: '9bf6631da',
        GitCommit: '9bf6631da',
        RancherPrime: 'true',
      }),
    }),
  );
}
