import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import UserMenuPo from '@/e2e/po/side-bars/user-menu.po';
import AccountPagePo from '@/e2e/po/pages/account-api-keys.po';
import CreateKeyPagePo from '@/e2e/po/pages/account-api-keys-create_key.po';

/**
 * Upstream cypress account-api-keys.spec is fully commented out behind
 * rancher/dashboard#12325 (current-session token deletion errors). The List
 * describe below sidesteps that bug entirely:
 *   - tokens are created via API with a description (never the current
 *     session),
 *   - tests only do read-only paginate/filter/sort on the UI,
 *   - cleanup deletes by id via API (one at a time), so the current session
 *     is never selected.
 * When upstream un-skips the CRUD describe (password change + bulk delete)
 * we can port those too.
 */

test.describe('Account and API Keys', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, () => {
  test('Can navigate to Account and API Keys page', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);
    const userMenu = new UserMenuPo(page);
    const accountPage = new AccountPagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await userMenu.clickMenuItem('Account & API Keys');
    await accountPage.waitForPage();
    await accountPage.waitForPage();
    await expect(accountPage.titleLocator()).toBeVisible();
  });

  test('Can create API keys', async ({ page, login, rancherApi }) => {
    await login();

    const accountPage = new AccountPagePo(page);
    const createKeyPage = new CreateKeyPagePo(page);
    const apiKeysList = accountPage.list();
    const keyDesc = `e2e-api-key-${Date.now()}`;
    let createdKeyId = '';

    try {
      await accountPage.goTo();
      await accountPage.waitForPage();

      await accountPage.create();
      await createKeyPage.waitForPage();
      await createKeyPage.waitForPage();
      await createKeyPage.description().set(keyDesc);

      const createResponse = page.waitForResponse(
        (resp) => resp.url().includes('/v3/tokens') && resp.request().method() === 'POST',
      );

      await createKeyPage.create();
      const resp = await createResponse;

      expect(resp.status()).toBe(201);
      const body = await resp.json();

      createdKeyId = body.id;

      const accessKey = (await createKeyPage.apiAccessKey().textContent()) ?? '';

      expect(accessKey.length).toBeGreaterThan(0);
      await createKeyPage.done();

      // Filter table to find our key (table may be paginated)
      await expect(apiKeysList.self()).toBeVisible();
      const sortableTable = apiKeysList.resourceTable().sortableTable();

      await sortableTable.filter(keyDesc);

      const keyRow = apiKeysList.rowWithName(accessKey.trim());

      await expect(keyRow.self()).toBeVisible();
      await expect(apiKeysList.details(accessKey.trim(), 3)).toContainText(keyDesc);
    } finally {
      if (createdKeyId) {
        await rancherApi.deleteRancherResource('v3', 'tokens', createdKeyId, false);
      }
    }
  });

  test.describe('List', () => {
    // 26 seed tokens + per-page preference are shared across the four tests via
    // beforeAll/afterAll. Run serial so workers don't race the shared setup.
    test.describe.configure({ mode: 'serial' });

    const TOKENS_PER_PAGE = 10;
    const DESCRIPTION_COLUMN = 3; // [checkbox, state, AccessKey, Description, ...]
    const pageTimestamp = Date.now();
    const tokenDesc = `e2e-pgn-${pageTimestamp}`;
    // 'aaa-' prefix sorts ahead of 'e2e-' in ASC; reused as a sort/filter anchor
    const uniqueTokenDesc = `aaa-${tokenDesc}-unique`;
    const createdTokenIds: string[] = [];
    let savedPerPage: string | undefined;

    test.beforeAll(async ({ rancherApi }) => {
      // Pre-clean any leftover pagination-pool tokens from a prior run. Without
      // this, orphaned `e2e-pgn-*` tokens inflate the list count and the
      // pagination assertions flake on dirty environments.
      const allTokens = await rancherApi.getRancherResource('v3', 'tokens');

      if (allTokens.body?.data) {
        const orphanIds: string[] = allTokens.body.data
          .filter((t: any) => typeof t?.description === 'string' && t.description.startsWith('e2e-pgn-'))
          .map((t: any) => t.id as string);

        await Promise.all(orphanIds.map((id) => rancherApi.deleteRancherResource('v3', 'tokens', id, false)));
      }

      // Save per-page so afterAll can restore even if a test mutates it
      const prefsResp = await rancherApi.getRancherResource('v1', 'userpreferences');

      savedPerPage = prefsResp.body.data[0]?.data?.['per-page'];
      await rancherApi.setUserPreference({ 'per-page': String(TOKENS_PER_PAGE) });

      // Create 25 tokens with the shared description + 1 with the unique one.
      // Push each id into createdTokenIds the instant its create resolves so a
      // partial failure mid-Promise.all still surfaces every successful token
      // to afterAll cleanup.
      const createAndTrack = async (desc: string) => {
        const resp = await rancherApi.createToken(desc);

        createdTokenIds.push(resp.body.id as string);
      };

      await Promise.all([
        ...Array.from({ length: 25 }, () => createAndTrack(tokenDesc)),
        createAndTrack(uniqueTokenDesc),
      ]);
    });

    test.afterAll(async ({ rancherApi }) => {
      // allSettled so one failed delete does not strand the rest. Pre-clean on
      // the next run handles anything that does slip through.
      await Promise.allSettled(
        createdTokenIds.map((id) => rancherApi.deleteRancherResource('v3', 'tokens', id, false)),
      );
      await rancherApi.setUserPreference({ 'per-page': savedPerPage ?? '100' });
    });

    test('pagination is visible and user is able to navigate through tokens data', async ({ page, login }) => {
      await login();

      const accountPage = new AccountPagePo(page);

      await accountPage.goTo();
      await accountPage.waitForPage();

      const table = accountPage.sortableTable();

      await table.checkLoadingIndicatorNotVisible();

      // Filter to the deterministic test pool (26 tokens) so total is independent of
      // any other tokens the admin user already owns
      await table.filter(tokenDesc);
      await table.checkLoadingIndicatorNotVisible();
      await expect(table.paginationText()).toContainText(`1 - ${TOKENS_PER_PAGE} of 26`);

      // Page 1 — beginning/prev disabled, next/end enabled
      await expect(table.pagination()).toBeVisible();
      await expect(table.paginationBeginButton()).toBeDisabled();
      await expect(table.paginationPrevButton()).toBeDisabled();
      await expect(table.paginationNextButton()).toBeEnabled();
      await expect(table.paginationEndButton()).toBeEnabled();

      // Next → page 2
      await table.paginationNextButton().click();
      await expect(table.paginationText()).toContainText('11 - 20 of 26');
      await expect(table.paginationBeginButton()).toBeEnabled();
      await expect(table.paginationPrevButton()).toBeEnabled();

      // Prev → page 1
      await table.paginationPrevButton().click();
      await expect(table.paginationText()).toContainText(`1 - ${TOKENS_PER_PAGE} of 26`);
      await expect(table.paginationBeginButton()).toBeDisabled();
      await expect(table.paginationPrevButton()).toBeDisabled();

      // End → last page (rows 21-26)
      await table.paginationEndButton().click();
      await expect(table.paginationText()).toContainText('21 - 26 of 26');
      await expect(table.paginationNextButton()).toBeDisabled();
      await expect(table.paginationEndButton()).toBeDisabled();

      // Beginning → page 1
      await table.paginationBeginButton().click();
      await expect(table.paginationText()).toContainText(`1 - ${TOKENS_PER_PAGE} of 26`);
      await expect(table.paginationBeginButton()).toBeDisabled();
    });

    test('filter tokens', async ({ page, login }) => {
      await login();

      const accountPage = new AccountPagePo(page);

      await accountPage.goTo();
      await accountPage.waitForPage();

      const table = accountPage.sortableTable();

      await table.checkLoadingIndicatorNotVisible();

      // Filter by exact unique description → 1 result
      await table.filter(uniqueTokenDesc);
      await expect(table.rowElements()).toHaveCount(1);
      await expect(table.rowElementWithName(uniqueTokenDesc)).toBeVisible();

      // Filter by run prefix → all 26 tokens in the test pool
      await table.filter(tokenDesc);
      await expect(table.paginationText()).toContainText('of 26');
    });

    test('sorting changes the order of paginated tokens data', async ({ page, login }) => {
      await login();

      const accountPage = new AccountPagePo(page);

      await accountPage.goTo();
      await accountPage.waitForPage();

      const table = accountPage.sortableTable();

      await table.checkLoadingIndicatorNotVisible();

      // Constrain to our pool so order is deterministic
      await table.filter(tokenDesc);
      await table.checkLoadingIndicatorNotVisible();

      // Sort ASC by Description — 'aaa-...' is the lexicographic first row → page 1
      await table.sort(DESCRIPTION_COLUMN).click();
      await table.checkLoadingIndicatorNotVisible();
      await expect(table.sortIcon(DESCRIPTION_COLUMN, 'down')).toBeVisible();
      await expect(table.rowElementWithName(uniqueTokenDesc)).toBeVisible();

      // Last page → 'aaa-...' must NOT appear
      await table.paginationEndButton().click();
      await expect(table.rowElementWithName(uniqueTokenDesc)).toBeHidden();

      // Toggle to DESC by clicking Description column sort handle. Sort toggle resets to page 1.
      await table.sort(DESCRIPTION_COLUMN).click();
      await table.checkLoadingIndicatorNotVisible();
      await expect(table.sortIcon(DESCRIPTION_COLUMN, 'up')).toBeVisible();

      // Page 1 in DESC: 'aaa-...' must NOT appear (the highest-sorting prefix is 'e2e-pgn-...')
      await expect(table.paginationBeginButton()).toBeDisabled();
      await expect(table.rowElementWithName(uniqueTokenDesc)).toBeHidden();

      // Last page in DESC → 'aaa-...' bubbles to the end
      await table.paginationEndButton().click();
      await expect(table.rowElementWithName(uniqueTokenDesc)).toBeVisible();
    });

    test('pagination is hidden', async ({ page, login }) => {
      // Mock the tokens API to return a 3-row collection so total < per-page → no pagination
      await page.route(/\/v3\/tokens(\?|$)/, (route) => {
        const ts = new Date().toISOString();
        const items = Array.from({ length: 3 }, (_, i) => ({
          id: `mock-token-${i}`,
          type: 'token',
          description: `mock-token-${i}`,
          name: `mock-token-${i}`,
          userId: 'user-mock',
          ttl: 3600000,
          current: false,
          enabled: true,
          expired: false,
          created: ts,
        }));

        route.fulfill({
          json: {
            type: 'collection',
            resourceType: 'token',
            count: items.length,
            data: items,
          },
        });
      });

      await login();

      const accountPage = new AccountPagePo(page);

      await accountPage.goTo();
      await accountPage.waitForPage();

      const table = accountPage.sortableTable();

      await table.checkLoadingIndicatorNotVisible();
      await expect(table.rowElements()).toHaveCount(3);
      await expect(table.pagination()).toBeHidden();
    });
  });
});
