import { test, expect } from '@/support/fixtures';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';

// Column indices for the Users table (0-based across all <th> including the checkbox).
// Layout: [checkbox, Enabled, ID, Name, Provider, Local Username, Last Login, Disable After, Delete After, Age]
const LAST_LOGIN_COLUMN = 6;

test.describe('Users: Last Login sorting', { tag: ['@usersAndAuths', '@adminUser'] }, () => {
  // Tests share the two test users — second test depends on Last Login being populated by the first
  test.describe.configure({ mode: 'serial' });

  const runTimestamp = Date.now();
  const userIds: string[] = [];
  let userNullName: string;
  let userActiveName: string;

  test.beforeAll(async ({ rancherApi, envMeta }) => {
    // Pre-clean any leftover llsort-* users from prior failed runs. Without
    // this, orphans from earlier timestamped pools accumulate forever and a
    // partial-create from a prior failure could pad the row count enough
    // for `toHaveCount(2)` after filter to coincidentally pass.
    const allUsers = await rancherApi.getRancherResource('v3', 'users');
    const orphanIds: string[] = (allUsers.body?.data ?? [])
      .filter((u: any) => typeof u?.username === 'string' && /^llsort-(null|active)-/.test(u.username))
      .map((u: any) => u.id as string);

    await Promise.all(orphanIds.map((id) => rancherApi.deleteRancherResource('v3', 'users', id, false)));

    const respNull = await rancherApi.createUser(
      {
        username: `llsort-null-${runTimestamp}`,
        globalRole: { role: 'user' },
        password: envMeta.password,
      },
      { createNameOptions: { onlyContext: true } },
    );

    userNullName = respNull.body.username;
    userIds.push(respNull.body.id);

    const respActive = await rancherApi.createUser(
      {
        username: `llsort-active-${runTimestamp}`,
        globalRole: { role: 'user' },
        password: envMeta.password,
      },
      { createNameOptions: { onlyContext: true } },
    );

    userActiveName = respActive.body.username;
    userIds.push(respActive.body.id);
  });

  test.afterAll(async ({ rancherApi }) => {
    for (const id of userIds) {
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', id, false);
    }
  });

  // eslint-disable-next-line playwright/expect-expect -- login fixture asserts URL via expect
  test('populate Last Login for the active test user', async ({ login, envMeta }) => {
    // Logging in once as the active user causes Rancher to populate its
    // cattle.io/last-login label, which the next test sorts on.
    await login({ username: userActiveName, password: envMeta.password });
  });

  test('places null Last Login at the top in ascending and at the bottom in descending', async ({ page, login }) => {
    await login();

    const usersPo = new UsersPo(page);

    await usersPo.goTo();
    await usersPo.waitForPage();

    const table = usersPo.list().resourceTable().sortableTable();

    await table.checkLoadingIndicatorNotVisible();

    // Narrow the table to just the two users created in this run so ordering is
    // deterministic even if a previous failed run left orphan users behind.
    await table.filter(`-${runTimestamp}`);
    await table.checkLoadingIndicatorNotVisible();
    await expect(table.rowElements()).toHaveCount(2);

    // First click selects the column for sorting in ASC order (icon points down).
    // Null Last Login should bubble to the top, populated value to the bottom.
    await table.sort(LAST_LOGIN_COLUMN).click();
    await table.checkLoadingIndicatorNotVisible();
    await expect(table.sortIcon(LAST_LOGIN_COLUMN, 'down')).toBeVisible();

    await expect(table.row(0).self()).toContainText(userNullName);
    await expect(table.row(1).self()).toContainText(userActiveName);

    // Second click flips to DESC order (icon points up).
    // Populated Last Login on top, null user at the bottom.
    await table.sort(LAST_LOGIN_COLUMN).click();
    await table.checkLoadingIndicatorNotVisible();
    await expect(table.sortIcon(LAST_LOGIN_COLUMN, 'up')).toBeVisible();

    await expect(table.row(0).self()).toContainText(userActiveName);
    await expect(table.row(1).self()).toContainText(userNullName);
  });
});
