import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { LONG } from '@/support/timeouts';

const CENTER_TOLERANCE_PX = 1.5;

test.describe('Side navigation: group label alignment', { tag: ['@navigation', '@adminUser'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const burgerMenu = new BurgerMenuPo(page);

    await burgerMenu.goToCluster('local');

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.waitForPage();

    const productNav = new ProductNavPo(page);

    await expect(productNav.groups().first()).toBeAttached({ timeout: LONG });
  });

  test('vertically centers the group header label within its header row', async ({ page }) => {
    const productNav = new ProductNavPo(page);
    const labels = productNav.tabHeaderLabels();

    const count = await labels.count();

    expect(count).toBeGreaterThan(0);

    const offsets = await labels.evaluateAll((els) =>
      els
        .map((h6) => {
          const header = h6.closest('.header');

          if (!header) {
            return null;
          }

          const headerRect = header.getBoundingClientRect();
          const labelRect = h6.getBoundingClientRect();

          if (headerRect.height === 0 || labelRect.height === 0) {
            return null;
          }

          const headerMid = headerRect.top + headerRect.height / 2;
          const labelMid = labelRect.top + labelRect.height / 2;

          return Math.abs(headerMid - labelMid);
        })
        .filter((v): v is number => v !== null),
    );

    expect(offsets.length).toBeGreaterThan(0);
    expect(Math.max(...offsets), 'h6 label vertical midpoint should match header midpoint').toBeLessThan(
      CENTER_TOLERANCE_PX,
    );
  });
});
