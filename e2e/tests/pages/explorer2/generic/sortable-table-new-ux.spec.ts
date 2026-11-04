import { test, expect } from '@/support/fixtures';
import fs from 'fs';
import path from 'path';
import type { Locator, Page, Route } from '@playwright/test';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { ConfigMapsPagePo } from '@/e2e/po/pages/explorer/configmaps.po';
import ClusterScanPagePo from '@/e2e/po/pages/compliance/clusterscan.po';
import PagePo from '@/e2e/po/pages/page.po';
import { LONG } from '@/support/timeouts';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-19147-sortable-table-new-ux-design-evidence';

const VIEWPORT = { width: 1440, height: 900 };

// ---------------------------------------------------------------------------
// Seeded ConfigMaps (Test C). Created out of name order, with a gap longer than the one second
// resolution of creationTimestamp, so creation order (c, a, b) differs from name order (a, b, c)
// ---------------------------------------------------------------------------
const CM_NAMESPACE = 'default';
const CM_PREFIX = 'qa19147-sort-';
const CM_CREATION_ORDER = ['c', 'a', 'b'].map((s) => `${ CM_PREFIX }${ s }`);
const CM_NAME_ORDER = [...CM_CREATION_ORDER].sort();
const TIMESTAMP_GAP_MS = 1_100;

// ---------------------------------------------------------------------------
// Mocked compliance scan (Tests D and E). Nothing here touches the real API: the compliance
// schemas, the scan and its report are all answered by page.route
// ---------------------------------------------------------------------------
const COMPLIANCE_GROUP = 'compliance.cattle.io';
const SCAN_NAME = 'scan-qa19147';
const REPORT_NAME = 'scan-report-qa19147';
const PROFILE_NAME = 'qa19147-profile';
const SCAN_TYPE = `${ COMPLIANCE_GROUP }.clusterscan`;
const REPORT_TYPE = `${ COMPLIANCE_GROUP }.clusterscanreport`;
const COMPLIANCE_SCHEMAS = [
  { id: SCAN_TYPE, kind: 'ClusterScan', resource: 'clusterscans' },
  { id: REPORT_TYPE, kind: 'ClusterScanReport', resource: 'clusterscanreports' },
  { id: `${ COMPLIANCE_GROUP }.clusterscanprofile`, kind: 'ClusterScanProfile', resource: 'clusterscanprofiles' },
  { id: `${ COMPLIANCE_GROUP }.clusterscanbenchmark`, kind: 'ClusterScanBenchmark', resource: 'clusterscanbenchmarks' },
];
// Steve addresses a type by its schema id (`/v1/compliance.cattle.io.clusterscan`), the UI list call is singular;
// the plural resource name is accepted too
const COMPLIANCE_URL_REGEX = new RegExp(
  `/v1/${ COMPLIANCE_GROUP.replace(/\./g, '\\.') }\\.(clusterscanreports?|clusterscanprofiles?|clusterscanbenchmarks?|clusterscans?)(/[^?#]*)?(\\?.*)?$`,
);

const MOCK_NODES = { master: ['qa-node-1'], worker: ['qa-node-2', 'qa-node-3'] };
const MOCK_REPORT_JSON = JSON.stringify({
  total:         3,
  pass:          1,
  fail:          2,
  warn:          0,
  skip:          0,
  notApplicable: 0,
  nodes:         MOCK_NODES,
  results:       [
    {
      id:     '1',
      checks: [
        {
          id: '1.1.1', description: 'Ensure the API server pod specification file permissions are set', state: 'fail', node_type: ['master', 'worker'], nodes: ['qa-node-1', 'qa-node-2'], remediation: 'Run chmod 600 on the file',
        },
        {
          id: '1.1.2', description: 'Ensure the API server pod specification file ownership is set', state: 'fail', node_type: ['master'], nodes: ['qa-node-1'], remediation: 'Run chown root:root on the file',
        },
        {
          id: '1.1.3', description: 'Ensure the kubelet service file permissions are set', state: 'pass', node_type: ['worker'], nodes: [],
        },
      ],
    },
  ],
});

function steveCollection(url: string, resourceType: string, data: unknown[]) {
  return {
    type:         'collection',
    links:        { self: url },
    createTypes:  {},
    actions:      {},
    resourceType,
    revision:     '1',
    data,
  };
}

function mockScan(origin: string) {
  const self = `${ origin }/v1/${ SCAN_TYPE }/${ SCAN_NAME }`;

  return {
    id:         SCAN_NAME,
    type:       SCAN_TYPE,
    apiVersion: `${ COMPLIANCE_GROUP }/v1`,
    kind:       'ClusterScan',
    links:      { self, view: self },
    metadata:   {
      name:              SCAN_NAME,
      creationTimestamp: '2026-01-01T10:00:00Z',
      state:             {
        name: 'active', transitioning: false, error: false
      },
      relationships: [
        {
          rel: 'owner', fromType: SCAN_TYPE, fromId: SCAN_NAME, toType: REPORT_TYPE, toId: REPORT_NAME
        },
      ],
    },
    spec:   { scanProfileName: PROFILE_NAME },
    status: {
      lastRunScanProfileName: PROFILE_NAME,
      lastRunTimestamp:       '2026-01-01T10:05:00Z',
      summary:                {
        total: 3, pass: 1, fail: 2, warn: 0, skip: 0, notApplicable: 0
      },
      display: { state: 'active', message: '' },
    },
  };
}

function mockReport(origin: string) {
  const self = `${ origin }/v1/${ REPORT_TYPE }/${ REPORT_NAME }`;

  return {
    id:       REPORT_NAME,
    type:     REPORT_TYPE,
    kind:     'ClusterScanReport',
    links:    { self, view: self },
    metadata: { name: REPORT_NAME, creationTimestamp: '2026-01-01T10:05:00Z' },
    spec:     { reportJSON: MOCK_REPORT_JSON },
  };
}

function buildSchema(origin: string, def: { id: string; kind: string; resource: string }) {
  return {
    id:                def.id,
    type:              'schema',
    links:             { collection: `${ origin }/v1/${ def.id }`, self: `${ origin }/v1/schemas/${ def.id }` },
    collectionMethods: ['GET'],
    resourceMethods:   ['GET'],
    pluralName:        def.resource,
    resourceFields:    {},
    attributes:        {
      group:      COMPLIANCE_GROUP,
      kind:       def.kind,
      namespaced: false,
      resource:   def.resource,
      verbs:      ['get', 'list', 'watch'],
      version:    'v1',
    },
  };
}

async function fulfillCompliance(route: Route): Promise<void> {
  const request = route.request();

  if (request.method() !== 'GET') {
    await route.continue();

    return;
  }

  const url = new URL(request.url());
  const [, resource, idPart] = url.pathname.match(COMPLIANCE_URL_REGEX) ?? [];
  const id = idPart ? decodeURIComponent(idPart.replace(/^\//, '')) : undefined;
  const singular = resource?.replace(/s$/, '');
  const type = `${ COMPLIANCE_GROUP }.${ singular }`;
  const items: Record<string, any[]> = {
    clusterscan:       [mockScan(url.origin)],
    clusterscanreport: [mockReport(url.origin)],
  };
  const all = items[singular] ?? [];

  if (id) {
    const found = all.find((item) => item.id === id);

    await route.fulfill(found ? { json: found } : { status: 404, json: { type: 'error', code: 'NotFound', status: 404 } });

    return;
  }

  await route.fulfill({ json: steveCollection(`${ url.origin }${ url.pathname }`, type, all) });
}

/** Answers the compliance resources and adds the compliance schemas to the schema list when the cluster lacks them */
async function mockComplianceSurface(page: Page): Promise<void> {
  await page.route(/\/v1\/schemas(\?.*)?$/, async(route) => {
    const response = await route.fetch();
    const body = await response.json();
    const origin = new URL(route.request().url()).origin;
    const known = new Set<string>((body.data ?? []).map((s: { id: string }) => s.id));

    body.data = body.data ?? [];
    for (const def of COMPLIANCE_SCHEMAS) {
      if (!known.has(def.id)) {
        body.data.push(buildSchema(origin, def));
      }
    }

    // The fetched body is already decoded: drop the headers that describe the original encoding
    const headers = { ...response.headers() };

    delete headers['content-length'];
    delete headers['content-encoding'];

    await route.fulfill({
      status: response.status(), headers, json: body
    });
  });

  await page.route(COMPLIANCE_URL_REGEX, fulfillCompliance);
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

/** Index of the <th> whose text starts with the label, counting the checkbox/actions headers without text */
async function headerIndex(table: Locator, label: string): Promise<number> {
  // eslint-disable-next-line playwright/no-raw-locators -- header cells are read by position and text; the role query does not resolve inside the sortable table
  const ths = table.locator('thead th');
  const count = await ths.count();

  for (let i = 0; i < count; i++) {
    const text = (await ths.nth(i).innerText()).trim();

    if (text.split('\n')[0].trim() === label) {
      return i;
    }
  }

  return -1;
}

/** Text of the cells of a column (by header index) for every main row of the table */
async function columnTexts(table: Locator, colIndex: number): Promise<string[]> {
  // eslint-disable-next-line playwright/no-raw-locators -- main rows only: sub-rows and group rows are not data rows
  const rows = table.locator('tbody tr.main-row');
  const count = await rows.count();
  const out: string[] = [];

  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line playwright/no-raw-locators -- cells are read by column position
    out.push((await rows.nth(i).locator('td').nth(colIndex).innerText()).trim());
  }

  return out;
}

/** The legacy column toggle (actions-column gear) that the PR sorts and filters. Only rendered with advanced filtering */
function legacyToggleButton(page: Page): Locator {
  // eslint-disable-next-line playwright/no-raw-locators -- the legacy column toggle has no test id
  return page.locator('.table-options-btn').first();
}

async function legacyToggleLabels(page: Page): Promise<string[]> {
  // eslint-disable-next-line playwright/no-raw-locators -- the legacy column toggle has no test id
  const items = page.locator('.table-options-container ul li');
  const texts = await items.allInnerTexts();

  // Core columns (preventColToggle) render no label and are not toggleable
  return texts.map((t) => t.trim()).filter((t) => t.length > 0);
}

/** Labels of every column the Vue SortableTable reports as hidden (`hide: true`) */
async function hiddenColumnLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
     
    let inst: any = (document.querySelector('.sortable-table') as any)?.__vueParentComponent;

    while (inst) {
      const cols = inst.proxy?.columns || inst.props?.headers;

      if (Array.isArray(cols)) {
         
        return cols.filter((c: any) => c.hide === true).map((c: any) => c.label || c.name);
      }

      inst = inst.parent;
    }

    return [];
  });
}

/** Opens View > Columns Configuration of the table-views layout. Safe to call with the menu already open */
async function openViewColumnsMenu(page: Page): Promise<void> {
  const columnsItem = page.getByTestId('table-views-view-columns');
  const columnRows = page.getByTestId(/^table-views-col-(?!handle-)/);

  if (!(await columnsItem.isVisible())) {
    await page.getByTestId('table-views-view-menu').click();
  }

  await expect(columnsItem).toBeVisible();
  await columnsItem.hover();

  try {
    await columnRows.first().waitFor({ state: 'visible', timeout: 1000 });
  } catch {
    await columnsItem.click();
  }

  await expect(columnRows.first()).toBeVisible();
}

async function openConfigMapsList(page: Page): Promise<Locator> {
  const configMaps = new ConfigMapsPagePo(page);

  await configMaps.goTo();
  await configMaps.waitForPage();
  await new WelcomeDialogPo(page).dismissIfVisible();

  const table = configMaps.list().resourceTable().sortableTable().self();

  await expect(table).toBeVisible();
  // eslint-disable-next-line playwright/no-raw-locators -- main rows only: sub-rows and group rows are not data rows
  await expect(table.locator('tbody tr.main-row').first()).toBeVisible();

  return table;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test.describe('Sortable Table New UX Design (#19147)', { tag: ['@generic', '@adminUser'] }, () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.beforeEach(async({ page, login }) => {
    await page.setViewportSize(VIEWPORT);
    await login();
  });

  test.describe('ConfigMaps list', () => {
    let originalTableViews: string | undefined;

    test.beforeAll(async({ rancherApi }) => {
      // Leftovers of an interrupted run, then the three ConfigMaps this spec sorts
      for (const name of CM_CREATION_ORDER) {
        await rancherApi.deleteRancherResource('v1', 'configmaps', `${ CM_NAMESPACE }/${ name }`, false);
      }

      for (const [i, name] of CM_CREATION_ORDER.entries()) {
        if (i > 0) {
          await sleep(TIMESTAMP_GAP_MS);
        }

        await rancherApi.createConfigMap(CM_NAMESPACE, name);
      }
    });

    test.afterAll(async({ rancherApi }) => {
      for (const name of CM_CREATION_ORDER) {
        await rancherApi.deleteRancherResource('v1', 'configmaps', `${ CM_NAMESPACE }/${ name }`, false);
      }
    });

    test.beforeEach(async({ rancherApi }) => {
      // Column visibility and order live in the user's saved table views: start from none, and restore afterwards
      const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

      originalTableViews = prefs.body.data[0]?.data?.['table-views'];
      await rancherApi.setUserPreference({ 'table-views': JSON.stringify({}) });
    });

    test.afterEach(async({ rancherApi }) => {
      await rancherApi.setUserPreference({ 'table-views': originalTableViews ?? JSON.stringify({}) });
    });

    test('Column toggle menu is alphabetical', async({ page }) => {
      await openConfigMapsList(page);

      const toggle = legacyToggleButton(page);
      const hasLegacyToggle = await toggle.isVisible();

      if (hasLegacyToggle) {
        await toggle.click();
      } else {
        // The gear toggle only exists on lists with advanced filtering: capture the menu the user does get
        await openViewColumnsMenu(page);
      }

      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-07-column-toggle-alphabetical.png') });

      test.skip(
        !hasLegacyToggle,
        'No list in this build renders the legacy column toggle (it needs advanced filtering); the View > Columns menu lists columns in table order, not alphabetically, so it is not the surface this change sorts',
      );

      const labels = await legacyToggleLabels(page);

      expect(labels.length).toBeGreaterThan(1);

      const alphabetical = [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      expect(labels).toEqual(alphabetical);
    });

    test('Hidden column is excluded from the column toggle menu', async({ page }) => {
      await openConfigMapsList(page);

      const toggle = legacyToggleButton(page);
      const hasLegacyToggle = await toggle.isVisible();

      if (!hasLegacyToggle) {
        await openViewColumnsMenu(page);
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-05-hidden-column-excluded-toggle.png') });
      }

      test.skip(
        !hasLegacyToggle,
        'No list in this build renders the legacy column toggle (it needs advanced filtering), and a hide: true column cannot be injected into a stock list by mocking',
      );

      const hidden = await hiddenColumnLabels(page);

      test.skip(hidden.length === 0, 'The list defines no column with hide: true');

      await toggle.click();

      const labels = await legacyToggleLabels(page);

      expect(labels.length).toBeGreaterThan(0);
      for (const label of hidden) {
        expect(labels).not.toContain(label);
      }

      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-05-hidden-column-excluded-toggle.png') });
    });

    test('Age sort orders the seeded ConfigMaps by creationTimestamp, not by name', async({ page }) => {
      const table = await openConfigMapsList(page);

      const nameIndex = await headerIndex(table, 'Name');
      const ageIndex = await headerIndex(table, 'Age');

      expect(nameIndex).toBeGreaterThan(-1);
      expect(ageIndex).toBeGreaterThan(-1);

      // Narrow the list to the three seeded rows
      await page.getByTestId('table-views-query').fill(CM_PREFIX);
      // eslint-disable-next-line playwright/no-raw-locators -- main rows only: sub-rows and group rows are not data rows
      await expect(table.locator('tbody tr.main-row')).toHaveCount(CM_NAME_ORDER.length);

      // The default sort is the Name column, ascending
      // eslint-disable-next-line playwright/no-raw-locators -- aria-sort is read off the header cell itself
      const nameHeader = table.locator('thead th').nth(nameIndex);

      await expect(nameHeader).toHaveAttribute('aria-sort', /asc/i);
      expect(await columnTexts(table, nameIndex)).toEqual(CM_NAME_ORDER);

      // Age sorts on metadata.creationTimestamp: the rows were created c, a, b
      // eslint-disable-next-line playwright/no-raw-locators -- aria-sort is read off the header cell itself
      const ageHeader = table.locator('thead th').nth(ageIndex);

      await ageHeader.click();
      await expect(ageHeader).toHaveAttribute('aria-sort', /asc|desc/i);

      // The header direction and the row order update on separate ticks: poll the rows until they leave name order.
      // Which direction the first click lands on is the table's choice, so accept either creation order
      const oldestFirst = CM_CREATION_ORDER;
      const newestFirst = [...CM_CREATION_ORDER].reverse();
      const readOrder = async() => (await columnTexts(table, nameIndex)).join(',');

      await expect.poll(readOrder).toMatch(new RegExp(`^(${ oldestFirst.join(',') }|${ newestFirst.join(',') })$`));

      const firstOrder = await readOrder();
      const firstOldest = firstOrder === oldestFirst.join(',');
      const firstAscending = /asc/i.test((await ageHeader.getAttribute('aria-sort')) ?? '');

      await ageHeader.click();
      await expect(ageHeader).toHaveAttribute('aria-sort', firstAscending ? /desc/i : /asc/i);
      await expect.poll(readOrder).toBe((firstOldest ? newestFirst : oldestFirst).join(','));
    });
  });

  test.describe('Compliance scan report sub-table (mocked)', () => {
    let reportTable: Locator;

    test.beforeEach(async({ page }) => {
      await mockComplianceSurface(page);

      const list = new ClusterScanPagePo(page);

      await list.goTo();
      await list.waitForPage();
      await new WelcomeDialogPo(page).dismissIfVisible();
      await expect(list.row(SCAN_NAME).self()).toBeVisible({ timeout: LONG });

      const detail = new PagePo(page, `/c/local/compliance/compliance.cattle.io.clusterscan/${ SCAN_NAME }`);

      await detail.goTo();
      await detail.waitForPage();
      await new WelcomeDialogPo(page).dismissIfVisible();

      const reportTab = page.getByRole('tab', { name: /^report$/i });

      if ((await reportTab.count()) > 0) {
        await reportTab.first().click();
      }

      // The report table is the outermost sortable table of the detail page
      reportTable = page.locator('.dashboard-root .sortable-table').first(); // eslint-disable-line playwright/no-raw-locators
      await expect(reportTable).toBeVisible({ timeout: LONG });

      // Expand the first check to render its nested node table
      // eslint-disable-next-line playwright/no-raw-locators -- expand chevrons carry no test id
      await reportTable.locator('tbody tr.main-row td.row-expand i').first().click();
      // eslint-disable-next-line playwright/no-raw-locators -- the nested table has no test id
      await expect(page.locator('.sub-row .sub-table').first()).toBeVisible();
    });

    test.afterEach(async({ page }) => {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });

    test('Sub-table has no borders and a semibold header', async({ page }) => {
      // eslint-disable-next-line playwright/no-raw-locators -- the nested table has no test id
      const nested = page.locator('.sub-row .sub-table table.sortable-table').first();
      // eslint-disable-next-line playwright/no-raw-locators -- the nested table has no test id
      const nestedHeader = page.locator('.sub-row .sub-table thead th').first();

      await expect(nested).toBeVisible();
      for (const side of ['top', 'right', 'bottom', 'left']) {
        await expect(nested).toHaveCSS(`border-${ side }-width`, '0px');
      }

      await expect(nestedHeader).toBeVisible();
      await expect(nestedHeader).toHaveCSS('font-weight', '600');

      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-subtable-no-borders-semibold-header.png') });
    });

    test('Selecting the parent row highlights it but stops at the sub-table row', async({ page }) => {
      const checkbox = reportTable.getByTestId('sortable-table-0-checkbox');

      test.skip(
        (await checkbox.count()) === 0,
        'The report table disables table actions, so its rows have no selection checkbox to tick',
      );

      // eslint-disable-next-line playwright/no-raw-locators -- row state is a class set by the selection logic
      const parentRow = reportTable.locator('tbody tr.main-row').first();
      // eslint-disable-next-line playwright/no-raw-locators -- row state is a class set by the selection logic
      const subTableRow = reportTable.locator('tbody tr.sub-row').filter({ has: page.locator('.sub-table') }).first();

      await checkbox.click();

      await expect(parentRow).toHaveClass(/row-selected/);
      await expect(subTableRow).not.toHaveClass(/row-selected/);

      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-04-selection-stops-at-subtable.png') });
    });
  });
});
