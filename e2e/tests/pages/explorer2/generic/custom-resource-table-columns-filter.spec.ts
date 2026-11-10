import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import TableViewsPo from '@/e2e/po/components/table-views.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

const CRD_NAME = 'testwidgets.qa.cattle.io';
const SCHEMA_ID = 'qa.cattle.io.testwidget';
const INSTANCES_TYPE = 'qa.cattle.io.testwidgets';
const NAMESPACE = 'default';

interface Widget {
  name: string;
  tier: string;
  replicas: number;
  owner?: string;
  releasePlan?: string;
}

// widget-bronze omits the optional owner and releasePlan fields on purpose
const WIDGETS: Widget[] = [
  { name: 'widget-gold', tier: 'Gold', owner: 'Alice', replicas: 10, releasePlan: '2027-Q1' },
  { name: 'widget-silver', tier: 'Silver', owner: 'Bob', replicas: 5, releasePlan: '2026-Q4' },
  { name: 'widget-bronze', tier: 'Bronze', replicas: 2 },
];

const crdBody = {
  apiVersion: 'apiextensions.k8s.io/v1',
  kind: 'CustomResourceDefinition',
  metadata: { name: CRD_NAME },
  spec: {
    group: 'qa.cattle.io',
    scope: 'Namespaced',
    names: {
      plural: 'testwidgets',
      singular: 'testwidget',
      kind: 'TestWidget',
      listKind: 'TestWidgetList',
    },
    versions: [
      {
        name: 'v1',
        served: true,
        storage: true,
        schema: {
          openAPIV3Schema: {
            type: 'object',
            properties: {
              spec: {
                type: 'object',
                properties: {
                  tier: { type: 'string' },
                  owner: { type: 'string' },
                  replicas: { type: 'integer' },
                  releasePlan: { type: 'string' },
                },
              },
            },
          },
        },
        additionalPrinterColumns: [
          {
            name: 'Tier',
            type: 'string',
            jsonPath: '.spec.tier',
          },
          {
            name: 'Owner',
            type: 'string',
            jsonPath: '.spec.owner',
          },
          {
            name: 'Replicas',
            type: 'integer',
            jsonPath: '.spec.replicas',
          },
          {
            name: 'Release Plan',
            type: 'string',
            jsonPath: '.spec.releasePlan',
          },
        ],
      },
    ],
  },
};

function widgetBody(widget: Widget) {
  return {
    apiVersion: 'qa.cattle.io/v1',
    kind: 'TestWidget',
    metadata: { name: widget.name, namespace: NAMESPACE },
    spec: {
      tier: widget.tier,
      replicas: widget.replicas,
      ...(widget.owner !== undefined && { owner: widget.owner }),
      ...(widget.releasePlan !== undefined && { releasePlan: widget.releasePlan }),
    },
  };
}

/** Header labels in lower case, so assertions do not depend on how the table styles them */
async function lowerCaseHeaders(table: SortableTablePo): Promise<string[]> {
  return (await table.headerNames()).map((name) => name.toLowerCase());
}

/** Opens View > Columns Configuration and waits for the column rows to show */
async function openColumnsMenu(views: TableViewsPo): Promise<void> {
  await views.viewMenuButton().click();
  await expect(views.viewColumnsItem()).toBeVisible();
  await views.viewColumnsItem().hover();

  // Hover opens the submenu; fall back to a click if it did not
  await expect(async () => {
    if (!(await views.columnItem('name').isVisible())) {
      await views.viewColumnsItem().click();
    }

    await expect(views.columnItem('name')).toBeVisible({ timeout: 1000 });
  }).toPass();
}

/** Closes the submenu and the dropdown, whichever level Escape lands on first */
async function closeColumnsMenu(page: Page, views: TableViewsPo): Promise<void> {
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(views.viewColumnsItem()).toBeHidden({ timeout: 1000 });
  }).toPass();
}

test.describe('Custom resource table columns and field filtering', { tag: ['@generic', '@adminUser'] }, () => {
  let originalTableViews: string | undefined;
  let listPage: PagePo;
  let table: SortableTablePo;
  let views: TableViewsPo;

  test.beforeAll(async ({ rancherApi }) => {
    test.setTimeout(120_000);

    const crd = await rancherApi.createRancherResource(
      'v1',
      'apiextensions.k8s.io.customresourcedefinitions',
      crdBody,
      false,
    );

    // 409 means a previous run left the definition behind, which is fine to reuse
    expect([200, 201, 409]).toContain(crd.status);

    await expect
      .poll(async () => (await rancherApi.getRancherResource('v1', 'schemas', SCHEMA_ID, 0)).status, {
        timeout: 60_000,
      })
      .toBe(200);

    for (const widget of WIDGETS) {
      await expect
        .poll(
          async () => {
            const { status } = await rancherApi.createRancherResource('v1', INSTANCES_TYPE, widgetBody(widget), false);

            // 409 means a previous run left the instance behind, which is fine to reuse
            return [200, 201, 409].includes(status);
          },
          { timeout: 30_000 },
        )
        .toBe(true);
    }
  });

  test.afterAll(async ({ rancherApi }) => {
    for (const widget of WIDGETS) {
      await rancherApi.deleteRancherResource('v1', INSTANCES_TYPE, `${NAMESPACE}/${widget.name}`, false);
    }

    await rancherApi.deleteRancherResource('v1', 'apiextensions.k8s.io.customresourcedefinitions', CRD_NAME, false);
  });

  test.beforeEach(async ({ login, page, rancherApi }) => {
    // Column visibility lives in the user's saved table views: start from none, and restore afterwards
    const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

    originalTableViews = prefs.body.data[0]?.data?.['table-views'];
    await rancherApi.setUserPreference({ 'table-views': '{}' });

    await login();

    listPage = new PagePo(page, `/c/local/explorer/${SCHEMA_ID}`);
    table = new SortableTablePo(page, '.sortable-table');
    views = new TableViewsPo(page);

    await listPage.goTo();
    await new WelcomeDialogPo(page).dismissIfVisible();

    await expect(table.self()).toBeVisible();
    await expect(table.headerContentCells().first()).toBeVisible();
    await expect(table.rowElementWithName('widget-gold')).toBeVisible();
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.setUserPreference({ 'table-views': originalTableViews ?? '{}' });
  });

  test('should render CRD additionalPrinterColumns automatically as table headers with resource values', async () => {
    await expect
      .poll(() => lowerCaseHeaders(table))
      .toEqual(expect.arrayContaining(['tier', 'owner', 'replicas', 'release plan']));

    for (const widget of WIDGETS) {
      const row = table.rowElementWithName(widget.name);

      await expect(row).toBeVisible();
      await expect(row).toContainText(widget.tier);
      await expect(row).toContainText(`${widget.replicas}`);

      // Optional fields fall back to an empty match, so a widget without them still just has to render its row
      await expect(row).toContainText(widget.owner ?? '');
      await expect(row).toContainText(widget.releasePlan ?? '');
    }
  });

  test('should hide an optional CRD column via View Columns menu and restore it with reset button', async ({
    page,
  }) => {
    await expect.poll(() => lowerCaseHeaders(table)).toContain('tier');

    await openColumnsMenu(views);
    await expect(views.columnItem('tier')).toBeVisible();
    await views.columnItem('tier').click();
    await closeColumnsMenu(page, views);

    await expect.poll(() => lowerCaseHeaders(table)).not.toContain('tier');
    // The other printer columns are untouched
    await expect.poll(() => lowerCaseHeaders(table)).toEqual(expect.arrayContaining(['owner', 'replicas']));
    await expect(table.rowElementWithName('widget-gold')).not.toContainText('Gold');

    await openColumnsMenu(views);
    await expect(views.resetColumnsButton()).toBeEnabled();
    await views.resetColumnsButton().click();
    await closeColumnsMenu(page, views);

    await expect.poll(() => lowerCaseHeaders(table)).toContain('tier');
    await expect(table.rowElementWithName('widget-gold')).toContainText('Gold');
  });

  test('should keep essential core columns locked in Columns menu', async ({ page }) => {
    await openColumnsMenu(views);

    // The name column is locked: no reorder grip, and a click does not hide it
    await expect(views.columnItem('name')).toHaveClass(/locked/);
    await expect(views.columnHandle('name')).toHaveCount(0);

    // Optional printer columns are not locked and can be reordered
    await expect(views.columnItem('tier')).not.toHaveClass(/locked/);
    await expect(views.columnHandle('tier')).toBeVisible();

    // A disabled row refuses a real click, so dispatch the event to prove the handler ignores it too
    await views.columnItem('name').dispatchEvent('click');
    await expect(views.columnItem('name')).toHaveClass(/shown/);

    await closeColumnsMenu(page, views);

    await expect.poll(() => lowerCaseHeaders(table)).toContain('name');
  });

  test('should filter custom resources by free-text matching printer column values', async () => {
    await views.searchInput().fill('Silver');
    await expect(views.searchInput()).toHaveText('Silver');

    await expect(table.rowElementWithName('widget-silver')).toBeVisible();
    await expect(table.rowElementWithName('widget-gold')).toHaveCount(0);
    await expect(table.rowElementWithName('widget-bronze')).toHaveCount(0);

    // Free text also reaches a column that is not the name
    await views.searchInput().fill('Bob');
    await expect(views.searchInput()).toHaveText('Bob');

    await expect(table.rowElementWithName('widget-silver')).toBeVisible();
    await expect(table.rowElementWithName('widget-gold')).toHaveCount(0);
    await expect(table.rowElementWithName('widget-bronze')).toHaveCount(0);
  });

  test('should filter custom resources by structured field:value syntax', async () => {
    await views.searchInput().fill('owner:Alice');
    await expect(views.searchInput()).toHaveText('owner:Alice');

    await expect(table.rowElementWithName('widget-gold')).toBeVisible();
    await expect(table.rowElementWithName('widget-silver')).toHaveCount(0);
    await expect(table.rowElementWithName('widget-bronze')).toHaveCount(0);

    await views.searchInput().fill('tier:Bronze');
    await expect(views.searchInput()).toHaveText('tier:Bronze');

    await expect(table.rowElementWithName('widget-bronze')).toBeVisible();
    await expect(table.rowElementWithName('widget-gold')).toHaveCount(0);
    await expect(table.rowElementWithName('widget-silver')).toHaveCount(0);
  });

  test('should filter custom resources using negation operator on printer fields', async () => {
    await views.searchInput().fill('not tier:Bronze');
    await expect(views.searchInput()).toHaveText('not tier:Bronze');

    await expect(table.rowElementWithName('widget-gold')).toBeVisible();
    await expect(table.rowElementWithName('widget-silver')).toBeVisible();
    await expect(table.rowElementWithName('widget-bronze')).toHaveCount(0);
  });

  test('should combine multiple custom resource field filters with logical AND', async () => {
    await views.searchInput().fill('tier:Gold owner:Alice');
    await expect(views.searchInput()).toHaveText('tier:Gold owner:Alice');

    await expect(table.rowElementWithName('widget-gold')).toBeVisible();
    await expect(table.rowElementWithName('widget-silver')).toHaveCount(0);
    await expect(table.rowElementWithName('widget-bronze')).toHaveCount(0);

    // Both conditions must hold: Gold with a different owner matches nothing
    await views.searchInput().fill('tier:Gold owner:Bob');
    await expect(views.searchInput()).toHaveText('tier:Gold owner:Bob');

    await expect(table.rowElementWithName('widget-gold')).toHaveCount(0);
    await expect(table.rowElementWithName('widget-silver')).toHaveCount(0);
    await expect(table.rowElementWithName('widget-bronze')).toHaveCount(0);
  });

  test('should normalize multi-word printer column names to hyphens in query filtering', async () => {
    await views.searchInput().fill('release-plan:2027-Q1');
    await expect(views.searchInput()).toHaveText('release-plan:2027-Q1');

    await expect(table.rowElementWithName('widget-gold')).toBeVisible();
    await expect(table.rowElementWithName('widget-silver')).toHaveCount(0);
    await expect(table.rowElementWithName('widget-bronze')).toHaveCount(0);
  });
});
