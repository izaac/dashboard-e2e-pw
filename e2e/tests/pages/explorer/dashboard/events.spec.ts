import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { EventsPageListPo } from '@/e2e/po/pages/explorer/events.po';
import { eventsGetResponseSmallSet } from '@/e2e/blueprints/explorer/cluster/events';

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

      await events.list().resourceTable().sortableTable().checkVisible();
      await events.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

      const rowCount = await events.list().resourceTable().sortableTable().rowCount();

      expect(rowCount).toBeGreaterThan(0);
    });

    test('pagination is hidden with small dataset', async ({ page, login }) => {
      await login();

      await page.route(/\/v1\/events\?/, async (route) => {
        await route.fulfill({ json: eventsGetResponseSmallSet });
      });

      const events = new EventsPageListPo(page, 'local');

      await events.goTo();
      await events.waitForPage();

      await events.list().resourceTable().sortableTable().checkVisible();
      await events.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await events.list().resourceTable().sortableTable().checkRowCount(false, 3);
      await expect(events.list().resourceTable().sortableTable().pagination()).not.toBeAttached();
    });
  });
});
