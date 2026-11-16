import { errors, type Locator, type Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { ConfigMapsPagePo } from '@/e2e/po/pages/explorer/configmaps.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { WorkloadsDeploymentsListPagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import JWTAuthenticationPagePo from '@/e2e/po/pages/cluster-manager/jwt-authentication.po';
import NotificationsCenterPo from '@/e2e/po/components/notification-center.po';
import type TableViewsPo from '@/e2e/po/components/table-views.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

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

/** A saved view as the preference stores it */
function savedView(id: string, name: string) {
  return { id, name, query: '', labelColumns: [] };
}

/** The group header of a month, as the table words it: the month's name and the year */
function monthHeader(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

test.describe('Table Views dev review fixes (#19392)', { tag: ['@generic', '@adminUser'] }, () => {
  const stamp = Date.now();
  const nsName = `e2e-views-review-${stamp}`;
  const configMapNames = [`cm-a-${stamp}`, `cm-b-${stamp}`, `cm-c-${stamp}`];

  let originalTableViews: string | undefined;

  test.beforeAll(async ({ rancherApi }) => {
    // Saved views live in the user's preferences: remember what was there so it can be put back
    const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

    originalTableViews = prefs.body.data[0]?.data?.['table-views'];

    await rancherApi.createNamespace(nsName);

    for (const name of configMapNames) {
      await rancherApi.createConfigMap(nsName, name);
    }
  });

  test.afterAll(async ({ rancherApi }) => {
    await rancherApi.setUserPreference({ 'table-views': originalTableViews ?? '{}' });
    await rancherApi.deleteNamespace([nsName]);
  });

  test.beforeEach(async ({ login, rancherApi }) => {
    // Every test starts from lists with no saved views
    await rancherApi.setUserPreference({ 'table-views': '{}' });

    await login();
  });

  /** Opens ConfigMaps on its All tab and waits until the table has loaded */
  async function openConfigMaps(page: Page): Promise<{ configMaps: ConfigMapsPagePo; views: TableViewsPo }> {
    const configMaps = new ConfigMapsPagePo(page);

    await configMaps.goTo();
    await dismissWelcomeDialog(page);

    const views = configMaps.tableViews();

    await expect(views.allTab()).toBeVisible();
    await configMaps.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    return { configMaps, views };
  }

  test('tab menu stays inside a short window and its last entry can be reached', async ({ page }) => {
    const { views } = await openConfigMaps(page);

    await page.setViewportSize({ width: 1280, height: 320 });

    await views.tabMenuButton('all').click();
    await expect(views.menu()).toBeVisible();
    await expect(views.menu()).toBeInViewport({ ratio: 1 });

    // Too tall for the window, so the menu scrolls inside itself
    await views.menuImportView('all').scrollIntoViewIfNeeded();
    await expect(views.menuImportView('all')).toBeInViewport({ ratio: 1 });
  });

  test('filter suggestions say they are loading and Enter picks nothing meanwhile', async ({ page }) => {
    const { views } = await openConfigMaps(page);
    const release = await views.holdSuggestionRequests();

    try {
      await views.typeQuery('name:');

      await expect(views.suggestionsLoading()).toBeVisible();
      await expect(views.suggestions()).toHaveAttribute('aria-busy', 'true');

      await views.searchInput().press('Enter');
      await views.searchInput().press('ArrowDown');
      await views.searchInput().press('Enter');

      // Nothing got picked: no value, no stray space, no complaint about the filter
      await expect(views.searchInput()).toHaveText('name:');
      await expect(views.queryProblem()).toBeHidden();
    } finally {
      release();
    }

    await expect(views.suggestionsLoading()).toBeHidden();
    await expect(views.suggestionOptions().first()).toBeVisible();

    // Once the answer is in, Enter picks the highlighted value
    await views.searchInput().press('Enter');
    await expect(views.searchInput()).not.toHaveText('name:');
  });

  test('Group By Age (month) names the month and the year in the group header', async ({ page }) => {
    const { configMaps, views } = await openConfigMaps(page);
    const table = configMaps.list().resourceTable().sortableTable();

    await views.viewMenuButton().click();
    await views.viewGroupItem().click();
    await views.groupOption('month:age').click();

    // The ConfigMaps of this spec were just created, so their month is this one
    await expect(table.groupTab(monthHeader(new Date()))).toBeVisible();
  });

  test('Reset to Default on a view goes back to the list default and Discard brings the saved view back', async ({
    page,
  }) => {
    const { configMaps, views } = await openConfigMaps(page);
    const table = configMaps.list().resourceTable().sortableTable();
    const filter = `name:${configMapNames[0]}`;

    await views.typeQuery(filter);
    await views.blurQuery();
    await expect(views.searchInput()).toHaveText(filter);

    const viewTab = await saveAllTabAsNewView(page, views, `Reset ${stamp}`);
    const viewId = await viewIdOf(viewTab);

    await viewTab.focus();
    await page.keyboard.press('ArrowDown');
    await expect(views.menuResetToDefault(viewId)).toBeEnabled();
    await views.menuResetToDefault(viewId).click();

    // The list's own default: no filter. The view itself is only changed once saved
    await expect(views.searchInput()).toHaveText('');
    await expect(views.unsavedDot()).toBeVisible();
    await table.checkLoadingIndicatorNotVisible();

    await viewTab.focus();
    await page.keyboard.press('ArrowDown');
    await views.menuDiscardChanges().click();
    await expect(views.searchInput()).toHaveText(filter);
  });

  test('Share View and Import View are offered on the All tab and Import refuses text that is not a view', async ({
    page,
  }) => {
    const { configMaps, views } = await openConfigMaps(page);
    const table = configMaps.list().resourceTable().sortableTable();

    await views.tabMenuButton('all').click();
    await expect(views.menuShareView('all')).toBeVisible();
    await expect(views.menuImportView('all')).toBeVisible();
    // The All tab has nothing saved to go back to, and cannot be deleted
    await expect(views.menuResetToDefault('all')).toHaveCount(0);

    await views.menuShareView('all').click();
    await expect(views.shareModal()).toBeVisible();
    await expect(views.shareText()).not.toBeEmpty();
    // No filter, so nothing in the text can reveal names
    await expect(views.shareWarning()).toBeHidden();
    await views.shareCloseButton().click();
    await expect(views.shareModal()).toBeHidden();
    await table.checkLoadingIndicatorNotVisible();

    await views.allTab().focus();
    await page.keyboard.press('ArrowDown');
    await expect(views.menu()).toBeVisible();
    await views.menuImportView('all').focus();
    await page.keyboard.press('Enter');
    await expect(views.importModal()).toBeVisible();
    await views.importInput().fill('hello not a view');

    await expect(views.importProblem()).toContainText("This isn't a shared view");
    await expect(views.importConfirmButton()).toBeDisabled();
  });

  test('deleting a view in front of the All tab leaves the All tab where it was', async ({ page, rancherApi }) => {
    const [first, second, third] = ['first', 'second', 'third'].map((name) => `${name}-${stamp}`);

    // Saved as [First, All, Second, Third] with Third as the default, which leads: [Third, First, All, Second]
    await rancherApi.setUserPreference({
      'table-views': JSON.stringify({
        metadata: { version: 1 },
        payload: {
          configmap: {
            views: [savedView(first, 'First'), savedView(second, 'Second'), savedView(third, 'Third')],
            defaultViewId: third,
            allIndex: 1,
          },
        },
      }),
    });

    const { views } = await openConfigMaps(page);

    async function expectTabOrder(ids: string[]): Promise<void> {
      await expect(views.tabs()).toHaveCount(ids.length);

      for (const [index, id] of ids.entries()) {
        await expect(views.tabs().nth(index)).toHaveAttribute('data-testid', `table-views-tab-${id}`);
      }
    }

    await expectTabOrder([third, first, 'all', second]);

    await views.tabMenuButton(first).click();
    await views.menuDelete(first).click();

    // A view in front of All is gone: All stays in front of Second, it does not slip behind it
    await expectTabOrder([third, 'all', second]);

    // Undo puts the view back in front of All
    await views.undoDeleteButton().click();
    await expectTabOrder([third, first, 'all', second]);
  });

  test('exporting selected rows reports completion in the notification center', async ({ page }) => {
    const { configMaps, views } = await openConfigMaps(page);
    const table = configMaps.list().resourceTable().sortableTable();
    const selected = configMapNames.slice(0, 2);

    // Narrow the table to the ConfigMaps of this spec
    await views.typeQuery(`namespace:${nsName}`);
    await views.blurQuery();
    await expect(table.rowWithName(selected[0]).self()).toBeVisible();

    for (const name of selected) {
      await table.rowWithName(name).checkbox().check();
    }

    await views.selectionActionsButton().click();
    await views.selectionExportAction().click();
    await expect(views.exportModal()).toBeVisible();
    await views.exportFormat('CSV').check();

    const downloadPromise = page.waitForEvent('download');

    await views.exportDownloadButton().click();
    await downloadPromise;

    // The modal does not wait for the file: the notification center carries the outcome
    await expect(views.exportModal()).toBeHidden();

    const notifications = new NotificationsCenterPo(page);

    await notifications.toggle();

    const done = notifications.items().filter({ hasText: 'Export completed' });

    await expect(done).toHaveCount(1);
    await expect(done).toContainText('2 selected ConfigMaps have been exported to configmap.csv');
  });

  test('overview state link opens the list on its All tab with the state in the filter', async ({ page }) => {
    const dashboard = new ClusterDashboardPagePo(page, 'local');
    const deployments = new WorkloadsDeploymentsListPagePo(page);

    await dashboard.goTo();
    await dismissWelcomeDialog(page);
    await dashboard.waitForPage();

    const status = dashboard.resourceStatus();

    await expect(status.deploymentsCard().self()).toBeVisible();
    await status.deploymentsCard().stateLink('Active').click();
    await deployments.waitForPage('stateFilter=active');

    const views = deployments.tableViews();

    await expect(views.allTab()).toHaveAttribute('aria-selected', 'true');
    await expect(views.searchInput()).toHaveText('state:active');
  });

  // The three below are the known defects found while validating #19392. They are written out as
  // they should behave once fixed, and stay skipped until the linked issues are closed.

  test.fixme(
    'JWT Authentication keeps the row selection when a cluster changes (rancher/dashboard#19857)',
    async ({ page, rancherApi }) => {
      const namespace = 'fleet-default';
      const clusterNames = [`e2e-jwt-a-${stamp}`, `e2e-jwt-b-${stamp}`];
      const mgmtIds: string[] = [];

      try {
        for (const name of clusterNames) {
          // An imported Generic cluster that never gets an agent
          await rancherApi.createRancherResource('v1', 'provisioning.cattle.io.clusters', {
            type: 'provisioning.cattle.io.cluster',
            metadata: { name, namespace },
            spec: {},
          });

          const ready = await rancherApi.waitForRancherResource(
            'v1',
            'provisioning.cattle.io.clusters',
            `${namespace}/${name}`,
            (resp: any) => Boolean(resp.body?.status?.clusterName),
            10,
            1000,
          );

          expect(ready).toBeTruthy();

          const prov = await rancherApi.getRancherResource(
            'v1',
            'provisioning.cattle.io.clusters',
            `${namespace}/${name}`,
            0,
          );

          mgmtIds.push(prov.body.status.clusterName);
        }

        const jwt = new JWTAuthenticationPagePo(page);

        await jwt.goTo();

        const table = jwt.list().resourceTable().sortableTable();

        await expect(table.rowWithName(clusterNames[0]).self()).toBeVisible();
        await table.rowWithName(clusterNames[0]).checkbox().check();
        await expect(table.rowWithName(clusterNames[0]).checkbox()).toBeChecked();

        // Any change to a management cluster
        const mgmt = await rancherApi.getRancherResource('v3', 'clusters', mgmtIds[1], 0);

        await rancherApi.updateRancherResource('v3', 'clusters', mgmtIds[1], {
          ...mgmt.body,
          annotations: { ...(mgmt.body.annotations || {}), 'qa-tick': String(Date.now()) },
        });

        await expect(table.rowWithName(clusterNames[0]).checkbox()).toBeChecked();
      } finally {
        for (const name of clusterNames) {
          await rancherApi.deleteRancherResource(
            'v1',
            'provisioning.cattle.io.clusters',
            `${namespace}/${name}`,
            false,
          );
        }
      }
    },
  );

  test.fixme(
    'Export As on selected rows includes the optional columns that are turned on (rancher/dashboard#19858)',
    async ({ page, rancherApi }) => {
      const described = `cm-desc-${stamp}`;

      await rancherApi.createConfigMap(nsName, described, {
        metadata: { annotations: { 'field.cattle.io/description': 'with a description' } },
      });

      const { configMaps, views } = await openConfigMaps(page);
      const table = configMaps.list().resourceTable().sortableTable();

      await views.viewMenuButton().click();
      await views.viewColumnsItem().click();
      await views.columnItem('description').click();
      await page.keyboard.press('Escape');

      await views.typeQuery(`namespace:${nsName}`);
      await views.blurQuery();
      await table.rowWithName(described).checkbox().check();

      await views.selectionActionsButton().click();
      await views.selectionExportAction().click();
      await views.exportFormat('CSV').check();

      const downloadPromise = page.waitForEvent('download');

      await views.exportDownloadButton().click();

      const stream = await (await downloadPromise).createReadStream();
      let csv = '';

      for await (const chunk of stream) {
        csv += chunk.toString();
      }

      expect(csv.split('\n')[0]).toContain('Description');
    },
  );

  test.fixme(
    'Group By Description shows the description as typed and not as markup (rancher/dashboard#19854)',
    async ({ page, rancherApi }) => {
      const markup = '<b>bold</b> <i>italic</i> end';

      await rancherApi.createConfigMap(nsName, `cm-markup-${stamp}`, {
        metadata: { annotations: { 'field.cattle.io/description': markup } },
      });

      const { configMaps, views } = await openConfigMaps(page);
      const table = configMaps.list().resourceTable().sortableTable();

      await views.viewMenuButton().click();
      await views.viewGroupItem().click();
      await views.groupOption('description').click();

      // Read as markup the header would say "bold italic end", so the typed text only shows if it is literal
      await expect(table.groupTab(markup)).toBeVisible();
    },
  );
});
