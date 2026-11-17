import { test, expect } from '@/support/fixtures';
import type { Page, Request } from '@playwright/test';
import { ConfigMapsPagePo } from '@/e2e/po/pages/explorer/configmaps.po';
import type SortableTablePo from '@/e2e/po/components/sortable-table.po';
import type TableViewsPo from '@/e2e/po/components/table-views.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

/**
 * #19854: grouping a list by Description rendered the header value as typed
 * markup, so the header showed "bold italic end" and asked the server for the
 * `x` image. The header now escapes the value. Fixed by dashboard 300e0de.
 */
const MARKUP_DESCRIPTION = '<b>bold</b> <i>italic</i> <img src=x> end';

/** About 1,400 characters of plain text, to check the header keeps the whole value */
const LONG_DESCRIPTION =
  'Long plain text description with no markup, written to fill the group header with well over a thousand characters. '
    .repeat(12)
    .trim();

const DESCRIPTION_ANNOTATION = 'field.cattle.io/description';
const DESCRIPTION_COLUMN = 'Description';

/** Opens ConfigMaps on its All tab and waits until the table has loaded */
async function openConfigMaps(page: Page): Promise<{ configMaps: ConfigMapsPagePo; views: TableViewsPo }> {
  const configMaps = new ConfigMapsPagePo(page);

  await configMaps.goTo();
  // Prime builds mount the release welcome dialog over the list a moment after it renders
  await new WelcomeDialogPo(page).dismissIfVisible();

  const views = configMaps.tableViews();

  await expect(views.allTab()).toBeVisible();
  await configMaps.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

  return { configMaps, views };
}

/** Shows the Description column, which the ConfigMaps list does not carry by default */
async function showDescriptionColumn(page: Page, views: TableViewsPo, table: SortableTablePo): Promise<void> {
  // The view state outlives a run, so the column may already be on
  if ((await table.headerNames()).includes(DESCRIPTION_COLUMN)) {
    return;
  }

  await views.viewMenuButton().click();
  await views.viewColumnsItem().click();
  await views.columnItem('description').click();
  await page.keyboard.press('Escape');

  await expect.poll(async () => (await table.headerNames()).includes(DESCRIPTION_COLUMN)).toBe(true);
}

/** Scopes the list to the test's namespace, then groups it through View > Group By > Description */
async function groupByDescription(views: TableViewsPo, namespace: string): Promise<void> {
  await views.typeQuery(`namespace:${namespace}`);
  await views.blurQuery();

  await views.viewMenuButton().click();
  await views.viewGroupItem().click();
  await views.groupOption('description').click();
}

test.describe('Group By header text', { tag: ['@components', '@adminUser'] }, () => {
  const stamp = Date.now();

  let testIndex = 0;
  let namespace: string;
  let markupConfigMap: string;
  let longConfigMap: string;
  let originalTableViews: string | undefined;

  test.beforeAll(async ({ rancherApi }) => {
    // Grouping and column choices are view state: remember it to leave the suite as it was found
    const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

    originalTableViews = prefs.body.data[0]?.data?.['table-views'];
  });

  test.afterAll(async ({ rancherApi }) => {
    await rancherApi.setUserPreference({ 'table-views': originalTableViews ?? '{}' });
  });

  test.beforeEach(async ({ login, rancherApi }) => {
    await login();
    await rancherApi.setUserPreference({ 'table-views': '{}' });

    // Own namespace per test: the previous one may still be terminating
    testIndex += 1;
    namespace = rancherApi.createE2EResourceName(`group-by-header-${testIndex}`);
    markupConfigMap = `cm-markup-${stamp}`;
    longConfigMap = `cm-long-${stamp}`;

    await rancherApi.createNamespace(namespace);
    await rancherApi.createConfigMap(namespace, markupConfigMap, {
      metadata: { annotations: { [DESCRIPTION_ANNOTATION]: MARKUP_DESCRIPTION } },
    });
    await rancherApi.createConfigMap(namespace, longConfigMap, {
      metadata: { annotations: { [DESCRIPTION_ANNOTATION]: LONG_DESCRIPTION } },
    });
  });

  test.afterEach(async ({ rancherApi }) => {
    // Runs on failure too. Nothing else uses this namespace, so no wait on the finaliser
    await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
  });

  test('Description column shows the description set on the ConfigMap', async ({ page }) => {
    const { configMaps, views } = await openConfigMaps(page);
    const table = configMaps.list().resourceTable().sortableTable();

    await showDescriptionColumn(page, views, table);

    await views.typeQuery(`namespace:${namespace}`);
    await views.blurQuery();

    // The header the helper waited for is the Description column; the row text is the annotation
    await expect(table.rowElementWithName(markupConfigMap)).toContainText(MARKUP_DESCRIPTION);
    await expect(table.rowElementWithName(longConfigMap)).toContainText(LONG_DESCRIPTION);
  });

  test('Group By Description shows the typed markup as text and fetches no image', async ({ page }) => {
    const requested: string[] = [];

    // Attached before navigation so the whole grouped render is covered
    page.on('request', (request: Request) => requested.push(request.url()));

    const { configMaps, views } = await openConfigMaps(page);
    const table = configMaps.list().resourceTable().sortableTable();

    await groupByDescription(views, namespace);

    const markupHeader = table.groupTab(MARKUP_DESCRIPTION);

    // Read as markup the header would say "bold italic end", so the typed text only shows if it is literal
    await expect(markupHeader).toBeVisible();
    await expect(markupHeader).toHaveText(MARKUP_DESCRIPTION);

    // No <b>, <i> or <img> inside the header
    await expect(table.groupTabMarkupElements(MARKUP_DESCRIPTION)).toHaveCount(0);

    // `img src=x` would be one request for a path ending in /x
    expect(requested.length).toBeGreaterThan(0);
    expect(requested.map((url) => new URL(url).pathname).filter((path) => path.endsWith('/x'))).toEqual([]);
  });

  test('Group By Description shows the whole long description in the header', async ({ page }) => {
    const { configMaps, views } = await openConfigMaps(page);
    const table = configMaps.list().resourceTable().sortableTable();

    await groupByDescription(views, namespace);

    const longHeader = table.groupTab(LONG_DESCRIPTION);

    // The whole value, not its height: truncation is tracked separately
    await expect(longHeader).toBeVisible();
    await expect(longHeader).toHaveText(LONG_DESCRIPTION);
  });
});
