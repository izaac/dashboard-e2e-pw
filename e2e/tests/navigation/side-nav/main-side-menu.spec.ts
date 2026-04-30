import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import PagePo from '@/e2e/po/pages/page.po';
import { generateFakeClusterDataAndIntercepts } from '@/e2e/blueprints/nav/fake-cluster';
import { LONG } from '@/support/timeouts';

const longClusterDescription = 'this-is-some-really-really-really-really-really-really-long-description';
const fakeProvClusterId = 'some-fake-cluster-id';
const fakeMgmtClusterId = 'some-fake-mgmt-id';

test.describe('Side Menu: main', () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test.describe('Needs intercepts BEFORE route navigation', () => {
    test.beforeEach(async ({ page }) => {
      await generateFakeClusterDataAndIntercepts(page, {
        fakeProvClusterId,
        fakeMgmtClusterId,
        longClusterDescription,
      });

      const homePage = new HomePagePo(page);

      await homePage.goTo();
    });

    test(
      'Pressing keyboard combo should display appropriate icon on cluster menu icon box',
      {
        tag: ['@navigation', '@adminUser'],
      },
      async ({ page }) => {
        const sideNav = new ProductNavPo(page);
        const pagePo = new PagePo(page, '');

        // Nav to project/namespaces in the fake cluster
        await pagePo.navToClusterMenuEntry(fakeProvClusterId);
        await sideNav.navToSideMenuEntryByLabel('Projects/Namespaces');

        // Wait for Projects/Namespaces page to load before checking burger menu
        await expect(page).toHaveURL(/\/projectsnamespaces/, { timeout: LONG });

        // Check burger menu cluster visibility (side menu is always in DOM)
        const burgerMenu = new BurgerMenuPo(page);

        await expect(burgerMenu.burgerMenuGetNavClusterByLabel('local')).toBeAttached();
        await expect(burgerMenu.burgerMenuGetNavClusterByLabel(fakeProvClusterId)).toBeAttached();

        // Press alt key combo
        await burgerMenu.focusBody();
        await page.keyboard.down('Alt');

        // Assert that icons are displayed for the key combo
        await expect(burgerMenu.clusterKeyComboIcon('local')).toBeVisible();
        await expect(burgerMenu.clusterKeyComboIcon(fakeProvClusterId)).toBeVisible();

        // Keep Alt held — routeCombo stays true so cluster switch preserves current page
        // Nav to local while Alt is still pressed
        await pagePo.navToClusterMenuEntry('local');

        await page.keyboard.up('Alt');

        // Assert that we are on the expected page
        await expect(page).toHaveURL(/\/local/);
        await expect(page).toHaveURL(/\/projectsnamespaces/);
      },
    );

    test(
      'Local cluster should show a name and description on the side menu and display a tooltip when hovering',
      {
        tag: ['@navigation', '@adminUser'],
      },
      async ({ page }) => {
        const burgerMenu = new BurgerMenuPo(page);

        await burgerMenu.toggle();

        // Check that the description includes the long description
        const description = await burgerMenu.getClusterDescription('local');

        expect(description).toContain(longClusterDescription);

        // Hover to show tooltip
        await burgerMenu.showClusterDescriptionTooltip('local');

        const tooltipContent = burgerMenu.getClusterDescriptionTooltipContent();

        await expect(tooltipContent).toBeVisible();
        await expect(tooltipContent).toContainText('local');
        await expect(tooltipContent).toContainText(longClusterDescription);
      },
    );
  });

  test.describe('No intercepts needed before route navigation', () => {
    test.beforeEach(async ({ page }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();

      const burgerMenu = new BurgerMenuPo(page);

      await burgerMenu.toggle();
    });

    test(
      'Opens and closes on menu icon click',
      {
        tag: ['@navigation', '@adminUser', '@standardUser'],
      },
      async ({ page }) => {
        const burgerMenu = new BurgerMenuPo(page);

        await expect(burgerMenu.sideMenu()).toHaveClass(/menu-open/);
        await burgerMenu.toggle();
        await expect(burgerMenu.sideMenu()).not.toHaveClass(/menu-open/);
      },
    );

    test(
      'Can display list of available clusters',
      {
        tag: ['@navigation', '@adminUser'],
      },
      async ({ page }) => {
        const burgerMenu = new BurgerMenuPo(page);

        await expect(burgerMenu.clusterNotPinnedList().first()).toBeAttached();
      },
    );

    test(
      'Pinned and unpinned cluster',
      {
        tag: ['@navigation', '@adminUser', '@standardUser'],
      },
      async ({ page }) => {
        const burgerMenu = new BurgerMenuPo(page);

        await burgerMenu.pinFirstCluster();
        await expect(burgerMenu.clusterPinnedList().first()).toBeAttached();

        await burgerMenu.unpinFirstCluster();
        await expect(burgerMenu.clusterPinnedList()).not.toBeAttached();
      },
    );

    test(
      'Can display at least one menu category label',
      {
        tag: ['@navigation', '@adminUser', '@standardUser'],
      },
      async ({ page }) => {
        const burgerMenu = new BurgerMenuPo(page);

        await expect(burgerMenu.categories()).toHaveCount(1);
      },
    );

    test(
      'Should show tooltip on mouse-hover when the menu is collapsed',
      {
        tag: ['@navigation', '@adminUser', '@standardUser'],
      },
      async ({ page }) => {
        const burgerMenu = new BurgerMenuPo(page);

        // Collapse the menu
        await burgerMenu.toggle();
        await expect(burgerMenu.sideMenu()).not.toHaveClass(/menu-open/);

        // Hover over the first cluster icon and check that the tooltip is shown
        await burgerMenu.firstClusterIcon().hover();
        await expect(burgerMenu.tooltip()).toBeVisible();

        // Open the menu
        await burgerMenu.toggle();
        await expect(burgerMenu.sideMenu()).toHaveClass(/menu-open/);

        await burgerMenu.firstClusterIcon().hover();
        await expect(burgerMenu.tooltipContainer()).not.toBeAttached();
      },
    );

    test(
      'Check first item in global section is Cluster Management',
      {
        tag: ['@navigation', '@adminUser', '@standardUser'],
      },
      async ({ page }) => {
        const homePage = new HomePagePo(page);

        await homePage.goTo();

        const burgerMenu = new BurgerMenuPo(page);
        const firstOptionLink = burgerMenu.firstOptionLinkInCategorySection('Global Apps');

        await expect(firstOptionLink).toContainText('Cluster Management');
      },
    );
  });
});
