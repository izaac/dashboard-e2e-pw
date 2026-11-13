import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import type { Page } from '@playwright/test';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import UserMenuPo from '@/e2e/po/side-bars/user-menu.po';

const USER_PASSWORD = 'Welcome-e2e-Passw0rd!';

interface VersionInfo {
  major: number;
  minor: number;
  minorLabel: string;
  expectedPref: string;
}

/** Parses `/rancherversion` (e.g. `v2.15.0-alpha1`, `v2.15-head`) or skips the test when it is not a release-like version */
async function getVersionInfo(rancherApi: RancherApi): Promise<VersionInfo> {
  const version = await rancherApi.getRancherVersion();
  // Mirrors `releaseNotesVersion()` (shell/utils/release-notes.ts): version up to the first '-', verbatim
  const rawPrefix = String(version.Version ?? '').split('-')[0];
  const match = rawPrefix.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?/);

  if (!match) {
    const reason = `Cannot parse Rancher version '${version.Version}'`;

    test.skip(true, reason);
    throw new Error(reason);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);

  return { major, minor, minorLabel: `${major}.${minor}`, expectedPref: rawPrefix };
}

/** Reads and rewrites the logged in (temporary) user's own `read-whatsnew` preference via the browser session */
async function setOwnReadWhatsNew(page: Page, value: string): Promise<void> {
  const url = new URL('/v1/userpreferences', page.url()).toString();
  const csrf = (await page.context().cookies()).find((c) => c.name === 'CSRF')?.value;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (csrf) {
    headers['x-api-csrf'] = csrf;
  }

  const getResp = await page.request.get(url, { headers });

  expect(getResp.status()).toBe(200);

  const pref = (await getResp.json()).data[0];
  const { links, ...rest } = pref;
  const putResp = await page.request.put(links.update, {
    headers,
    data: { ...rest, data: { ...pref.data, 'read-whatsnew': value === '' ? '' : JSON.stringify(value) } },
  });

  expect(putResp.status()).toBe(200);
}

/** Runs `action` and asserts it triggers a 200 PUT persisting `read-whatsnew` as the expected version */
async function runAndWaitForPrefSave(page: Page, expectedPref: string, action: () => Promise<void>): Promise<void> {
  const savePromise = page.waitForResponse(
    (res) =>
      res.url().includes('/v1/userpreferences/') &&
      res.request().method() === 'PUT' &&
      res.request().postDataJSON()?.data?.['read-whatsnew'] !== undefined,
  );

  await action();

  const res = await savePromise;

  expect(res.status()).toBe(200);
  expect(res.request().postDataJSON().data['read-whatsnew']).toBe(JSON.stringify(expectedPref));
}

async function closeAndWaitForPrefSave(page: Page, welcomeDialog: WelcomeDialogPo, expectedPref: string) {
  await runAndWaitForPrefSave(page, expectedPref, () => welcomeDialog.closeButton().click());
  await expect(welcomeDialog.dialogRoot()).toHaveCount(0);
}

async function pressEscapeAndWaitForPrefSave(page: Page, welcomeDialog: WelcomeDialogPo, expectedPref: string) {
  await runAndWaitForPrefSave(page, expectedPref, () => page.keyboard.press('Escape'));
  await expect(welcomeDialog.dialogRoot()).toHaveCount(0);
}

test.describe('Release Welcome Modal', { tag: ['@generic', '@adminUser'] }, () => {
  /** Creates an isolated Standard User (never touches the shared admin userpreferences) and removes it afterwards */
  async function withStandardUser(
    rancherApi: RancherApi,
    login: (options?: { username?: string; password?: string }) => Promise<void>,
    body: () => Promise<void>,
  ): Promise<void> {
    const userResp = await rancherApi.createUser({
      username: `e2e-welcome-${Date.now()}`,
      password: USER_PASSWORD,
      globalRole: { role: 'user' },
    });

    try {
      await login({ username: userResp.body.username, password: USER_PASSWORD });
      await body();
    } finally {
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userResp.body.id, false);
    }
  }

  test('New user sees welcome modal on first login, persists read-whatsnew on close, and stays hidden on reload', async ({
    page,
    login,
    rancherApi,
    isPrime,
  }) => {
    const { minorLabel, expectedPref } = await getVersionInfo(rancherApi);

    await withStandardUser(rancherApi, login, async () => {
      const welcomeDialog = new WelcomeDialogPo(page);

      await welcomeDialog.waitForSettled();

      await expect(welcomeDialog.title()).toBeVisible();
      await expect(welcomeDialog.subtitle()).toBeVisible();
      await expect(welcomeDialog.whatsNewVersion()).toContainText(minorLabel);
      await expect.poll(() => welcomeDialog.featureItems().count()).toBeGreaterThanOrEqual(1);
      await expect(welcomeDialog.closeButton()).toBeFocused();
      await expect(welcomeDialog.registrationCard()).toHaveCount(0);

      if (!isPrime) {
        // eslint-disable-next-line playwright/no-conditional-expect -- Prime promo card is edition-specific
        await expect(welcomeDialog.primePromoCard()).toBeVisible();
      }

      await closeAndWaitForPrefSave(page, welcomeDialog, expectedPref);

      await page.reload();
      await expect(new UserMenuPo(page).self()).toBeVisible();
      await expect(welcomeDialog.dialogRoot()).toHaveCount(0);
    });
  });

  test('Reloading without closing re-shows welcome modal, and Escape dismisses and persists preference', async ({
    page,
    login,
    rancherApi,
  }) => {
    const { expectedPref } = await getVersionInfo(rancherApi);

    await withStandardUser(rancherApi, login, async () => {
      const welcomeDialog = new WelcomeDialogPo(page);

      await welcomeDialog.waitForSettled();

      await page.reload();
      await welcomeDialog.waitForSettled();

      await pressEscapeAndWaitForPrefSave(page, welcomeDialog, expectedPref);

      await page.reload();
      await expect(new UserMenuPo(page).self()).toBeVisible();
      await expect(welcomeDialog.dialogRoot()).toHaveCount(0);
    });
  });

  test('Minor version upgrade triggers welcome modal while current minor stays suppressed', async ({
    page,
    login,
    rancherApi,
  }) => {
    const { major, minor, expectedPref } = await getVersionInfo(rancherApi);

    test.skip(minor === 0, 'No earlier minor version to simulate an upgrade from');

    await withStandardUser(rancherApi, login, async () => {
      const welcomeDialog = new WelcomeDialogPo(page);
      const userMenu = new UserMenuPo(page);

      await welcomeDialog.waitForSettled();
      await closeAndWaitForPrefSave(page, welcomeDialog, expectedPref);

      // Simulate an upgrade from the previous minor
      await setOwnReadWhatsNew(page, `v${major}.${Math.max(0, minor - 1)}.0`);
      await page.reload();
      await welcomeDialog.waitForSettled();

      await closeAndWaitForPrefSave(page, welcomeDialog, expectedPref);

      // Same minor (any patch) stays suppressed
      await setOwnReadWhatsNew(page, `v${major}.${minor}.0`);
      await page.reload();
      await expect(userMenu.self()).toBeVisible();
      await expect(welcomeDialog.dialogRoot()).toHaveCount(0);
    });
  });

  test("User menu What's New entry is first and reopens welcome modal on demand", async ({
    page,
    login,
    rancherApi,
  }) => {
    const { expectedPref } = await getVersionInfo(rancherApi);

    await withStandardUser(rancherApi, login, async () => {
      const welcomeDialog = new WelcomeDialogPo(page);
      const userMenu = new UserMenuPo(page);

      await welcomeDialog.waitForSettled();
      await closeAndWaitForPrefSave(page, welcomeDialog, expectedPref);

      await userMenu.ensureOpen();
      await expect(userMenu.getMenuItems().first()).toContainText("What's New");

      await userMenu.clickMenuItem("What's New");
      await welcomeDialog.waitForSettled();

      await welcomeDialog.closeButton().click();
      await expect(welcomeDialog.dialogRoot()).toHaveCount(0);
    });
  });
});
