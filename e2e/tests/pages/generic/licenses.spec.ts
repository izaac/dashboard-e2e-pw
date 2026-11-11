import { test, expect } from '@/support/fixtures';
import AboutPagePo from '@/e2e/po/pages/about.po';
import DiagnosticsPagePo from '@/e2e/po/pages/diagnostics.po';
import LicensesPagePo from '@/e2e/po/pages/licenses.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

test.describe('Open Source Licenses Page and Slide-In', { tag: ['@generic', '@adminUser'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await new WelcomeDialogPo(page).dismissIfVisible();
  });

  test('should display View Licenses button on About page and navigate to licenses page', async ({ page }) => {
    const aboutPage = new AboutPagePo(page);
    const licensesPage = new LicensesPagePo(page);

    await aboutPage.goTo();
    await aboutPage.waitForPage();

    await expect(aboutPage.viewLicensesBtn()).toBeVisible();
    await aboutPage.viewLicensesBtn().click();

    await licensesPage.waitForPage();
    await expect(licensesPage.sortableTable().self()).toBeVisible();
  });

  test('should display licenses table with search and pagination', async ({ page }) => {
    const licensesPage = new LicensesPagePo(page);
    const table = licensesPage.sortableTable();

    await licensesPage.goTo();
    await licensesPage.waitForPage();

    await expect(table.self()).toBeVisible();
    await expect(table.rowElements().first()).toBeVisible();
    await expect(licensesPage.packageLinks().first()).toBeVisible();
    await expect(table.filterComponent()).toBeVisible();
    await expect(table.pagination()).toBeVisible();
  });

  test('should filter licenses table when typing in search box', async ({ page }) => {
    const licensesPage = new LicensesPagePo(page);
    const table = licensesPage.sortableTable();

    await licensesPage.goTo();
    await licensesPage.waitForPage();
    await expect(table.rowElements().first()).toBeVisible();

    // Use the name of the first listed package as a deterministic search term
    const firstPackageName = ((await licensesPage.packageLinks().first().textContent()) ?? '').trim();

    expect(firstPackageName).not.toBe('');

    await table.filter(firstPackageName);

    await expect(licensesPage.packageLink(firstPackageName).first()).toBeVisible();
    await expect(table.rowElements().first()).toContainText(firstPackageName);

    // A term that matches nothing leaves the table empty
    await table.filter('zzz-no-such-package-zzz');
    await expect(licensesPage.noResultsText()).toBeVisible();
    await expect(licensesPage.noResultsText()).toContainText('no rows');
    await expect(licensesPage.packageLinks()).toHaveCount(0);

    // Resetting the filter restores the list
    await table.resetFilter();
    await expect(licensesPage.packageLinks().first()).toBeVisible();
  });

  test('should open slide-in with package license text and metadata when clicking a package link', async ({ page }) => {
    const licensesPage = new LicensesPagePo(page);

    await licensesPage.goTo();
    await licensesPage.waitForPage();
    await expect(licensesPage.packageLinks().first()).toBeVisible();

    const firstPackageName = ((await licensesPage.packageLinks().first().textContent()) ?? '').trim();

    await licensesPage.packageLinks().first().click();

    await expect(licensesPage.slideIn()).toHaveClass(/slide-in-open/);
    await expect(licensesPage.slideIn()).toContainText(firstPackageName);
    await expect(licensesPage.slideInContent()).toBeVisible();
    // Metadata badge (license id) or the empty-state message is always rendered
    await expect(licensesPage.slideInMetadata()).toBeVisible();
    await expect(licensesPage.slideInCloseButton()).toBeVisible();

    await licensesPage.slideInCloseButton().click();
    await expect(licensesPage.slideIn()).not.toHaveClass(/slide-in-open/);
  });

  test('should navigate back to About page via breadcrumb link', async ({ page }) => {
    const aboutPage = new AboutPagePo(page);
    const licensesPage = new LicensesPagePo(page);

    await licensesPage.goTo();
    await licensesPage.waitForPage();

    await expect(licensesPage.breadcrumbAboutLink()).toBeVisible();
    await licensesPage.breadcrumbAboutLink().click();

    await aboutPage.waitForPage();
    await expect(aboutPage.viewLicensesBtn()).toBeVisible();
  });

  test('should display About / Diagnostics breadcrumb title on diagnostics page', async ({ page }) => {
    const diagnosticsPage = new DiagnosticsPagePo(page);

    await diagnosticsPage.goTo();
    await diagnosticsPage.waitForPage();

    await expect(diagnosticsPage.title()).toBeVisible();
    await expect(diagnosticsPage.title()).toContainText('About');
    await expect(diagnosticsPage.title()).toContainText('/');
    await expect(diagnosticsPage.title()).toContainText('Diagnostics');
  });
});
