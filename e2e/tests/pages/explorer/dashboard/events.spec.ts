import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { EventsPageListPo } from '@/e2e/po/pages/explorer/events.po';
import { eventsGetResponseSmallSet, eventsLargeResponse } from '@/e2e/blueprints/explorer/cluster/events';
import { setTablePreferences, restoreTablePreferences } from '@/e2e/tests/pages/explorer2/workloads/pagination.utils';

const MOCK_COUNT = 25;
const UNIQUE_NAME = 'aaaa-unique-test-event';

test.describe('Events', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('Dashboard Events Tab', () => {
    test('full events link navigates to events list', async ({ page, login }) => {
      await login();
      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();

      await clusterDashboard.fullEventsLink().scrollIntoViewIfNeeded();
      await clusterDashboard.fullEventsLink().click();

      const events = new EventsPageListPo(page, 'local');

      await events.waitForPage();
    });

    test('events list is visible on dashboard', async ({ page, login }) => {
      await login();
      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();

      await expect(clusterDashboard.eventsList().sortableTable().self()).toBeVisible();
      await clusterDashboard.eventsList().sortableTable().checkLoadingIndicatorNotVisible();

      const rowCount = await clusterDashboard.eventsList().sortableTable().rowCount();

      expect(rowCount).toBeGreaterThan(0);
    });
  });

  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('events list page loads and shows events', async ({ page, login }) => {
      await login();
      const events = new EventsPageListPo(page, 'local');

      await events.goTo();
      await events.waitForPage();

      await expect(events.list().resourceTable().sortableTable().self()).toBeVisible();
      await events.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

      const rowCount = await events.list().resourceTable().sortableTable().rowCount();

      expect(rowCount).toBeGreaterThan(0);
    });

    test('pagination is hidden with small dataset', async ({ page, login }) => {
      const mockData = eventsGetResponseSmallSet;

      await page.route(/\/v1\/events/, (route) => {
        const url = route.request().url();

        if (url.includes('watch=true') || url.includes('resourceVersion')) {
          return route.abort();
        }

        return route.fulfill({ json: mockData });
      });

      await login();
      const events = new EventsPageListPo(page, 'local');

      await events.goTo();
      await events.waitForPage();

      await expect(events.list().resourceTable().sortableTable().self()).toBeVisible();
      await events.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await expect(events.list().resourceTable().sortableTable().rowElements()).toHaveCount(3);
      await expect(events.list().resourceTable().sortableTable().pagination()).not.toBeAttached();
    });

    test('pagination is visible and navigable with large dataset', async ({ page, login, rancherApi }) => {
      const savedPrefs = await setTablePreferences(rancherApi, []);
      const mockData = eventsLargeResponse(MOCK_COUNT, UNIQUE_NAME);

      try {
        await page.route(/\/v1\/events/, (route) => {
          const url = route.request().url();

          if (url.includes('watch=true') || url.includes('resourceVersion')) {
            return route.abort();
          }

          return route.fulfill({ json: mockData });
        });

        await login();
        const events = new EventsPageListPo(page, 'local');

        await events.goTo();
        await events.waitForPage();

        const table = events.list().resourceTable().sortableTable();

        await expect(table.self()).toBeVisible();
        await table.checkLoadingIndicatorNotVisible();

        // Pagination visible with correct text
        await expect(table.pagination()).toBeVisible();
        await expect(table.paginationText()).toContainText(`1 - 10 of ${MOCK_COUNT}`);

        // Page 1 nav button states
        await expect(table.paginationBeginButton()).toBeDisabled();
        await expect(table.paginationPrevButton()).toBeDisabled();
        await expect(table.paginationNextButton()).toBeEnabled();
        await expect(table.paginationEndButton()).toBeEnabled();

        // Navigate right → page 2
        await table.paginationNextButton().click();
        await expect(table.paginationText()).toContainText(`11 - 20 of ${MOCK_COUNT}`);
        await expect(table.paginationBeginButton()).toBeEnabled();

        // Navigate left → page 1
        await table.paginationPrevButton().click();
        await expect(table.paginationText()).toContainText(`1 - 10 of ${MOCK_COUNT}`);

        // Navigate to last page
        await table.paginationEndButton().click();
        await expect(table.paginationText()).toContainText(`21 - ${MOCK_COUNT} of ${MOCK_COUNT}`);

        // Navigate to first page
        await table.paginationBeginButton().click();
        await expect(table.paginationText()).toContainText(`1 - 10 of ${MOCK_COUNT}`);
      } finally {
        await restoreTablePreferences(rancherApi, savedPrefs);
      }
    });

    test('filter narrows results and reset restores list', async ({ page, login, rancherApi }) => {
      // Query real events to get a filter term
      const resp = await rancherApi.getRancherResource('v1', 'events');
      const realEvents = resp.body.data || [];

      test.skip(realEvents.length < 2, 'Cluster has too few events for filter test');

      // Use a short, common substring from first event's reason (e.g. "Killing", "Pulled")
      const filterTerm = realEvents[0].reason || realEvents[0].metadata.name.split('.')[0];

      // Ensure no grouping and all namespaces visible
      const savedPrefs = await setTablePreferences(rancherApi, []);

      try {
        await login();
        const events = new EventsPageListPo(page, 'local');

        await events.goTo();
        await events.waitForPage();

        const table = events.list().resourceTable().sortableTable();

        await expect(table.self()).toBeVisible();
        await table.checkLoadingIndicatorNotVisible();

        const totalBefore = await table.rowCount();

        expect(totalBefore).toBeGreaterThan(0);

        // Filter by known event term
        await table.filter(filterTerm);

        const afterFilter = await table.rowCount();

        expect(afterFilter).toBeGreaterThan(0);

        // Filtered row should contain the search term
        await expect(table.rowElements().first()).toContainText(filterTerm);

        // Reset filter restores original count
        await table.resetFilter();

        const afterReset = await table.rowCount();

        expect(afterReset).toBeGreaterThanOrEqual(totalBefore);
      } finally {
        await restoreTablePreferences(rancherApi, savedPrefs);
      }
    });

    test('sorting changes column direction indicator', async ({ page, login, rancherApi }) => {
      const resp = await rancherApi.getRancherResource('v1', 'events');
      const realEvents = resp.body.data || [];

      test.skip(realEvents.length < 2, 'Cluster has too few events for sort test');

      const savedPrefs = await setTablePreferences(rancherApi, []);

      try {
        await login();
        const events = new EventsPageListPo(page, 'local');

        await events.goTo();
        await events.waitForPage();

        const table = events.list().resourceTable().sortableTable();

        await expect(table.self()).toBeVisible();
        await table.checkLoadingIndicatorNotVisible();

        // Sort by Name (col 11) — matches upstream sort(11).click()
        await table.sort(11).click();
        await expect(table.sortIcon(11, 'down')).toBeVisible();

        // Toggle to DESC
        await table.sort(11).click();
        await expect(table.sortIcon(11, 'up')).toBeVisible();
      } finally {
        await restoreTablePreferences(rancherApi, savedPrefs);
      }
    });
  });
});
