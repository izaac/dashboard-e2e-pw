import { errors, type APIResponse, type Page, type Route } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { WorkloadsPodsListPagePo } from '@/e2e/po/pages/explorer/workloads-pods.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';

/** The Prime welcome dialog mounts a moment after the list renders, and only on Prime builds */
async function dismissWelcomeDialog(page: Page): Promise<void> {
  const welcome = new WelcomeDialogPo(page);

  try {
    await welcome.self().waitFor({ state: 'visible', timeout: 5000 });
  } catch (e) {
    if (!(e instanceof errors.TimeoutError)) {
      throw e;
    }

    return;
  }

  await welcome.dismissIfVisible();
}

test.describe('Table Views Lifecycle and State Management', { tag: ['@generic', '@adminUser'] }, () => {
  const nsName = `e2e-views-test-${Date.now()}`;
  const filterQuery = 'name:nginx';

  let originalTableViews: string | undefined;

  test.beforeAll(async ({ rancherApi }) => {
    // Saved views live in the user's preferences: remember what was there so it can be put back
    const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

    originalTableViews = prefs.body.data[0]?.data?.['table-views'];

    await rancherApi.createNamespace(nsName);
  });

  test.afterAll(async ({ rancherApi }) => {
    await rancherApi.setUserPreference({ 'table-views': originalTableViews ?? '{}' });
    await rancherApi.deleteNamespace([nsName]);
  });

  test.beforeEach(async ({ login, page, rancherApi }) => {
    // Every test starts from a table with no saved views
    await rancherApi.setUserPreference({ 'table-views': '{}' });

    // Test clusters do not advertise POST on table configurations, which hides Publish: advertise it
    const advertiseWrite = (schema: { collectionMethods?: string[]; resourceMethods?: string[] }) => {
      schema.collectionMethods = ['GET', 'POST', 'PUT', 'DELETE'];
      schema.resourceMethods = ['GET', 'PUT', 'DELETE'];
    };
    const fulfillJson = async (route: Route, response: APIResponse, body: unknown) => {
      const headers = { ...response.headers() };

      delete headers['content-length'];
      delete headers['content-encoding'];
      await route.fulfill({ status: response.status(), headers, json: body });
    };

    await page.route(/\/v1\/schemas(\?.*)?$/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      let schema = (body.data ?? []).find((s: { id: string }) => s.id === 'ui.cattle.io.tableconfiguration');

      if (!schema) {
        schema = {
          id: 'ui.cattle.io.tableconfiguration',
          type: 'schema',
          links: {
            collection: `${new URL(route.request().url()).origin}/v1/ui.cattle.io.tableconfigurations`,
          },
          collectionMethods: ['GET', 'POST', 'PUT', 'DELETE'],
          resourceMethods: ['GET', 'PUT', 'DELETE'],
        };
        body.data.push(schema);
      } else {
        advertiseWrite(schema);
      }

      await fulfillJson(route, response, body);
    });

    await page.route(/\/v1\/schemas\/ui\.cattle\.io\.tableconfiguration(\?.*)?$/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      advertiseWrite(body);

      await fulfillJson(route, response, body);
    });

    await login();

    const podsList = new WorkloadsPodsListPagePo(page);

    await podsList.goTo();
    await dismissWelcomeDialog(page);
    await expect(podsList.tableViews().allTab()).toBeVisible();
    await podsList.sortableTable().checkLoadingIndicatorNotVisible();
  });

  test('undo and redo search query modifications via keyboard shortcuts', async ({ page }) => {
    const views = new WorkloadsPodsListPagePo(page).tableViews();

    await views.searchInput().focus();
    await views.searchInput().pressSequentially('name:nginx namespace:default');
    await expect(views.searchInput()).toHaveText('name:nginx namespace:default');

    // Undo steps back one word at a time
    await views.searchInput().press('ControlOrMeta+z');
    await expect(views.searchInput()).toHaveText('name:nginx');

    await views.searchInput().press('ControlOrMeta+Shift+Z');
    await expect(views.searchInput()).toHaveText('name:nginx namespace:default');
  });

  test('search clear button is an undoable action', async ({ page }) => {
    const views = new WorkloadsPodsListPagePo(page).tableViews();

    await views.searchInput().focus();
    await views.searchInput().fill(filterQuery);
    await expect(views.searchInput()).toHaveText(filterQuery);

    await views.searchClearButton().click();
    await expect(views.searchInput()).toHaveText('');

    await views.searchInput().press('ControlOrMeta+z');
    await expect(views.searchInput()).toHaveText(filterQuery);
  });

  test('initial load retains built-in tab as active with dirty indicator when filter is typed', async ({ page }) => {
    const views = new WorkloadsPodsListPagePo(page).tableViews();

    // No tab has been picked: the table's own tab is the one in force and nothing is unsaved
    await expect(views.allTab()).toHaveAttribute('aria-selected', 'true');
    await expect(views.unsavedDot()).toHaveCount(0);

    await views.searchInput().focus();
    await views.searchInput().fill(filterQuery);

    // The dot sits on the built-in tab, and the tab stays the active one
    await expect(views.allTab().filter({ has: views.unsavedDot() })).toBeVisible();
    await expect(views.allTab()).toHaveAttribute('aria-selected', 'true');
  });

  test('save changes to new view creates clean new view and clears source view dirty state', async ({ page }) => {
    const views = new WorkloadsPodsListPagePo(page).tableViews();
    const viewName = `e2e-view-${Date.now()}`;

    await views.searchInput().focus();
    await views.searchInput().fill(filterQuery);
    await expect(views.allTab().filter({ has: views.unsavedDot() })).toBeVisible();

    await views.tabMenuButton('all').click();
    await views.menuSaveAsNew().click();

    await expect(views.renameInput()).toBeVisible();
    await views.renameInput().fill(viewName);
    await views.renameInput().press('Enter');
    await expect(views.renameInput()).toBeHidden();

    // The new view is in force, carries the filter and has nothing unsaved
    const newTab = views.tabs().filter({ hasText: viewName });

    await expect(newTab).toBeVisible();
    await expect(newTab).toHaveAttribute('aria-selected', 'true');
    await expect(views.searchInput()).toHaveText(filterQuery);
    await expect(views.unsavedDot()).toHaveCount(0);

    // The view it was copied from is left as saved
    await views.allTab().click();
    await expect(views.allTab()).toHaveAttribute('aria-selected', 'true');
    await expect(views.unsavedDot()).toHaveCount(0);
  });

  test('dismissing rename input retains default copied view name and keeps source tab clean', async ({ page }) => {
    const views = new WorkloadsPodsListPagePo(page).tableViews();

    await views.searchInput().focus();
    await views.searchInput().fill(filterQuery);
    await expect(views.allTab().filter({ has: views.unsavedDot() })).toBeVisible();

    await views.tabMenuButton('all').click();
    await views.menuSaveAsNew().click();

    await expect(views.renameInput()).toBeVisible();
    await views.renameInput().press('Escape');
    await expect(views.renameInput()).toBeHidden();

    // Walking away from naming the copy keeps the default name and selects the copy
    const defaultCopyTab = views.tabs().filter({ hasText: 'All (copy)' });

    await expect(defaultCopyTab).toHaveAttribute('aria-selected', 'true');

    // The view it was copied from is left as saved
    await views.allTab().click();
    await expect(views.allTab().filter({ has: views.unsavedDot() })).toHaveCount(0);
  });

  test('publish confirmation modal displays filter-sharing warning and dismisses cleanly', async ({ page }) => {
    const views = new WorkloadsPodsListPagePo(page).tableViews();
    const viewName = `e2e-publish-${Date.now()}`;

    // Ensure the table configuration schema has POST in collectionMethods so Publish is offered
    await page.evaluate(() => {
      const store = (window as any).$globalApp?.$store;

      if (!store) {
        return false;
      }

      const schemas = store.state.management?.types?.schema?.map;
      const key = 'ui.cattle.io.tableconfiguration';

      let schema = schemas?.get(key);

      if (!schema) {
        schema = {
          id: key,
          type: 'schema',
          collectionMethods: ['GET', 'POST', 'PUT', 'DELETE'],
          resourceMethods: ['GET', 'PUT', 'DELETE'],
        };
        schemas?.set(key, schema);
      } else {
        schema.collectionMethods = ['GET', 'POST', 'PUT', 'DELETE'];
        schema.resourceMethods = ['GET', 'PUT', 'DELETE'];
      }

      return !!schema.collectionMethods?.includes('POST');
    });

    // Save a view that carries a filter
    await views.searchInput().focus();
    await views.searchInput().fill(filterQuery);
    await views.tabMenuButton('all').click();
    await views.menuSaveAsNew().click();
    await expect(views.renameInput()).toBeVisible();
    await views.renameInput().fill(viewName);
    await views.renameInput().press('Enter');
    await expect(views.renameInput()).toBeHidden();

    const newTab = views.tabs().filter({ hasText: viewName });

    await expect(newTab).toHaveAttribute('aria-selected', 'true');

    // The view's id is generated, so read it from the tab itself
    const tabTestId = await newTab.getAttribute('data-testid');
    const viewId = (tabTestId || '').replace('table-views-tab-', '');

    expect(viewId).not.toBe('');
    expect(viewId).not.toBe('all');

    await newTab.focus();
    await page.keyboard.press('ArrowDown');
    await views.menuPublish(viewId).click();

    await expect(views.publishModal()).toBeVisible();
    await expect(views.publishWarning()).toBeVisible();

    await views.publishCancelButton().click();
    await expect(views.publishModal()).toBeHidden();
  });

  test('all tab counter updates reactively on pod creation and deletion without page reload', async ({
    page,
    rancherApi,
  }) => {
    const views = new WorkloadsPodsListPagePo(page).tableViews();
    const podName = `e2e-views-pod-${Date.now()}`;
    const readCount = async (): Promise<number> => {
      const match = (await views.allTab().textContent())?.match(/\((\d+)\)/);

      return match ? Number(match[1]) : NaN;
    };

    // The count arrives after the tab, so wait for it before reading
    await expect(views.allTab()).toHaveText(/\(\d+\)/);
    const before = await readCount();

    expect(before).not.toBeNaN();

    try {
      await rancherApi.createPod(nsName, podName, SMALL_CONTAINER.image);

      await expect(views.allTab()).toContainText(`(${before + 1})`, { timeout: 30000 });

      await rancherApi.deleteRancherResource('v1', 'pods', `${nsName}/${podName}`);

      await expect(views.allTab()).toContainText(`(${before})`, { timeout: 60000 });
    } finally {
      await rancherApi.deleteRancherResource('v1', 'pods', `${nsName}/${podName}`, false);
    }
  });
});
