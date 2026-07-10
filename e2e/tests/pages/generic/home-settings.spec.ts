import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';

test.describe('Home Page Settings', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
  test('Confirm correct number of settings requests made', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);
    let settingsRequestCount = 0;

    page.on('request', (req) => {
      if (req.url().includes('/v1/management.cattle.io.settings?exclude=metadata.managedFields')) {
        settingsRequestCount++;
      }
    });

    // Set up response listener BEFORE navigation (storageState makes page load fast)
    const settingsResponse = page.waitForResponse((resp) => resp.url().includes('/v1/management.cattle.io.settings'));

    await homePage.goTo();
    await homePage.waitForPage();
    await settingsResponse;

    // Should only have one settings request
    expect(settingsRequestCount).toBe(1);
  });
});
