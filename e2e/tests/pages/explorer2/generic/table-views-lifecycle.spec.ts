import { errors, type Locator, type Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { WorkloadsPodsListPagePo } from '@/e2e/po/pages/explorer/workloads-pods.po';
import type TableViewsPo from '@/e2e/po/components/table-views.po';
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

/** Saves whatever the built-in tab currently holds as a new named view, which then becomes the active tab */
async function saveAllTabAsNewView(page: Page, views: TableViewsPo, viewName: string): Promise<Locator> {
  await views.allTab().focus();
  await page.keyboard.press('ArrowDown');
  await views.menuSaveAsNew().click();
  await expect(views.renameInput()).toBeVisible();
  await views.renameInput().fill(viewName);
  await views.renameInput().press('Enter');
  await expect(views.renameInput()).toBeHidden();

  const viewTab = views.tabs().filter({ hasNotText: 'All' }).last();

  await expect(viewTab).toHaveAttribute('aria-selected', 'true');

  return viewTab;
}

/** The view's id is generated, so read it from the tab itself */
async function viewIdOf(viewTab: Locator): Promise<string> {
  const tabTestId = await viewTab.getAttribute('data-testid');
  const viewId = (tabTestId || '').replace('table-views-tab-', '');

  expect(viewId).not.toBe('');
  expect(viewId).not.toBe('all');

  return viewId;
}

/** Opens the publish confirmation for a view tab through its keyboard-reachable menu */
async function openPublishModal(page: Page, views: TableViewsPo, viewTab: Locator): Promise<void> {
  const viewId = await viewIdOf(viewTab);

  await viewTab.focus();
  await page.keyboard.press('ArrowDown');
  await views.menuPublish(viewId).click();
  await expect(views.publishModal()).toBeVisible();
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

  test('initial load keeps built-in tab in front when typed query matches an existing saved view', async ({ page }) => {
    const podsList = new WorkloadsPodsListPagePo(page);
    const views = podsList.tableViews();
    const savedViewName = 'Nginx View';

    // Save a custom view that carries the very filter that is typed later on
    await views.searchInput().focus();
    await views.searchInput().fill(filterQuery);
    await saveAllTabAsNewView(page, views, savedViewName);

    // Come back to the list afresh: no tab has been picked yet
    await podsList.goTo();
    await dismissWelcomeDialog(page);
    await expect(views.allTab()).toBeVisible();
    await podsList.sortableTable().checkLoadingIndicatorNotVisible();

    await expect(views.allTab()).toHaveAttribute('aria-selected', 'true');
    await expect(views.unsavedDot()).toHaveCount(0);

    // Locate the saved custom tab
    const savedTab = views.tabs().filter({ hasNotText: 'All' }).first();

    await expect(savedTab).toBeVisible();
    await expect(savedTab).toHaveAttribute('aria-selected', 'false');

    // Typing a query equal to the saved view's filter must not hand the selection over to that view
    await views.searchInput().focus();
    await views.searchInput().fill(filterQuery);

    await expect(views.allTab().filter({ has: views.unsavedDot() })).toBeVisible();
    await expect(views.allTab()).toHaveAttribute('aria-selected', 'true');
    await expect(savedTab).toHaveAttribute('aria-selected', 'false');

    // Visiting the saved view and returning keeps the unsaved query on the built-in tab
    await savedTab.click();
    await expect(savedTab).toHaveAttribute('aria-selected', 'true');

    await views.allTab().click();
    await expect(views.allTab()).toHaveAttribute('aria-selected', 'true');
    await expect(views.searchInput()).toHaveText(filterQuery);
    await expect(views.allTab().filter({ has: views.unsavedDot() })).toBeVisible();
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
    await expect(views.searchInput()).toHaveText('');
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

  test('publish confirmation modal shows filter-sharing warning only for views with a filter', async ({ page }) => {
    const views = new WorkloadsPodsListPagePo(page).tableViews();
    const filteredName = `e2e-publish-filtered-${Date.now()}`;

    // Test clusters do not advertise POST on table configurations, which hides Publish: advertise it
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

    // A clean view added via the New Tab button carries no filter: no warning
    await views.newTabButton().click();

    const unfilteredTab = views.tabs().filter({ hasNotText: 'All' }).first();

    await expect(unfilteredTab).toBeVisible();
    await expect(unfilteredTab).toHaveAttribute('aria-selected', 'true');

    await openPublishModal(page, views, unfilteredTab);
    await expect(views.publishModal()).toBeVisible();
    await expect(views.publishWarning()).toHaveCount(0);

    await views.publishCancelButton().click();
    await expect(views.publishModal()).toBeHidden();

    // A view that carries a filter warns that the filter is shared with everyone
    await views.allTab().click();
    await views.searchInput().focus();
    await views.searchInput().fill(filterQuery);
    await expect(views.allTab().filter({ has: views.unsavedDot() })).toBeVisible();

    const filteredTab = await saveAllTabAsNewView(page, views, filteredName);

    await openPublishModal(page, views, filteredTab);
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
