/**
 * Shared utilities for workload pagination/sort/filter tests.
 * Each workload spec imports these helpers to avoid duplicating the same pattern 6 times.
 */
import { expect } from '@/support/fixtures';
import type { Page } from '@playwright/test';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import { smallCollectionResponse } from '@/e2e/blueprints/explorer/workloads/small-collection';

/**
 * Bulk-create resources in a namespace via the Rancher API.
 * Returns the list of created resource names (sorted ASC).
 */
export async function createBulkResources(
  rancherApi: RancherApi,
  prefix: string,
  resourceType: string,
  namespace: string,
  count: number,
  payloadFn: (ns: string, name: string) => object,
  concurrency = 2,
): Promise<string[]> {
  const ts = Date.now();
  const names = Array.from({ length: count }, (_, i) => `e2e-${ts}-${i}`);

  for (let i = 0; i < names.length; i += concurrency) {
    const chunk = names.slice(i, i + concurrency);

    await Promise.all(
      chunk.map((name) => rancherApi.createRancherResource(prefix, resourceType, payloadFn(namespace, name))),
    );

    // Let the API server breathe between chunks
    if (i + concurrency < names.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Wait for all resources to be registered before returning
  await rancherApi.waitForRancherResources(prefix, resourceType, count - 1, true);

  return names.sort();
}

export interface SavedPrefs {
  'per-page'?: string;
  'ns-by-cluster'?: string;
  'group-by'?: string;
}

/** Save current table prefs, then set rows-per-page to 10 + namespace filter */
export async function setTablePreferences(rancherApi: RancherApi, nsNames: string[]): Promise<SavedPrefs> {
  const result = await rancherApi.getRancherResource('v1', 'userpreferences');
  const current = result.body.data[0]?.data || {};

  const saved: SavedPrefs = {
    'per-page': current['per-page'],
    'ns-by-cluster': current['ns-by-cluster'],
    'group-by': current['group-by'],
  };

  const nsFilter = JSON.stringify({ local: nsNames.map((ns) => `ns://${ns}`) });

  await rancherApi.setUserPreference({
    'per-page': '10',
    'ns-by-cluster': nsFilter,
    'group-by': 'none',
  });

  return saved;
}

/** Restore original user preferences */
export async function restoreTablePreferences(rancherApi: RancherApi, saved: SavedPrefs): Promise<void> {
  await rancherApi.setUserPreference({
    'per-page': saved['per-page'] ?? '100',
    'ns-by-cluster': saved['ns-by-cluster'] ?? '{"local":["all://user"]}',
    'group-by': saved['group-by'] ?? '',
  });
}

/**
 * Full pagination navigation test.
 * Verifies: pagination visible, button states, text, navigate right/left/end/beginning.
 * totalCount = 23 (22 bulk + 1 unique)
 */
export async function assertPaginationNavigation(table: SortableTablePo, totalCount: number): Promise<void> {
  await expect(table.pagination()).toBeVisible();

  // Page 1: beginning+left disabled, right+end enabled
  await expect(table.paginationBeginButton()).toBeDisabled();
  await expect(table.paginationPrevButton()).toBeDisabled();
  await expect(table.paginationNextButton()).toBeEnabled();
  await expect(table.paginationEndButton()).toBeEnabled();

  await expect(table.paginationText()).toContainText(`1 - 10 of ${totalCount}`);

  // Navigate right → page 2
  await table.paginationNextButton().click();
  await expect(table.paginationText()).toContainText(`11 - 20 of ${totalCount}`);
  await expect(table.paginationBeginButton()).toBeEnabled();
  await expect(table.paginationPrevButton()).toBeEnabled();

  // Navigate left → page 1
  await table.paginationPrevButton().click();
  await expect(table.paginationText()).toContainText(`1 - 10 of ${totalCount}`);
  await expect(table.paginationBeginButton()).toBeDisabled();
  await expect(table.paginationPrevButton()).toBeDisabled();

  // Navigate to end
  await table.paginationEndButton().click();
  let lastPageCount = totalCount % 10;

  if (lastPageCount === 0) {
    lastPageCount = 10;
  }
  const lastPageStart = totalCount - lastPageCount + 1;

  await expect(table.paginationText()).toContainText(`${lastPageStart} - ${totalCount} of ${totalCount}`);

  // Navigate to beginning
  await table.paginationBeginButton().click();
  await expect(table.paginationText()).toContainText(`1 - 10 of ${totalCount}`);
  await expect(table.paginationBeginButton()).toBeDisabled();
  await expect(table.paginationPrevButton()).toBeDisabled();
}

/**
 * Sorting test: filter by prefix, verify first item in ASC, toggle to DESC, check it moved.
 */
export async function assertPaginationSorting(
  table: SortableTablePo,
  firstName: string,
  filterPrefix: string,
): Promise<void> {
  await expect(table.self()).toBeVisible();
  await table.checkLoadingIndicatorNotVisible();
  await table.filter(filterPrefix);

  // First item (alphabetically) should be visible in ASC default
  await expect(table.rowElementWithName(firstName)).toBeVisible();

  // Sort Name column (index 2) to DESC
  await table.sort(2).click({ force: true });

  // First item should NOT be on page 1 in DESC
  await expect(table.rowElementWithName(firstName)).not.toBeVisible();

  // Navigate to last page — first item should be there
  await table.paginationEndButton().click();
  await expect(table.rowElementWithName(firstName)).toBeVisible();
}

/**
 * Filter test: filter by specific name → 1 result, filter by ns2 → 1 unique result.
 */
export async function assertPaginationFilter(
  table: SortableTablePo,
  specificName: string,
  uniqueName: string,
  ns2Name: string,
): Promise<void> {
  await table.checkLoadingIndicatorNotVisible();
  await table.checkRowCount(false, 10);

  // Filter by specific name from ns1
  await table.filter(specificName);
  await table.checkRowCount(false, 1);
  await expect(table.rowElementWithName(specificName)).toBeVisible();

  // Filter by ns2 namespace → shows unique resource only
  await table.filter(ns2Name);
  await table.checkRowCount(false, 1);
  await expect(table.rowElementWithName(uniqueName)).toBeVisible();
}

/**
 * Pagination hidden test: verify no pagination with small row count.
 */
export async function assertPaginationHidden(table: SortableTablePo): Promise<void> {
  await expect(table.self()).toBeVisible();
  await table.checkLoadingIndicatorNotVisible();
  await table.checkRowCount(false, 3);
  await expect(table.pagination()).not.toBeVisible();
}

/**
 * Mock the API to return a small collection so pagination is hidden.
 * Uses the blueprint factory — keeps mock data out of spec files.
 */
export async function mockSmallCollection(page: Page, apiPath: string, resourceType: string): Promise<void> {
  await page.route(`**/${apiPath}?**`, (route) => {
    route.fulfill({ json: smallCollectionResponse(resourceType) });
  });
}
