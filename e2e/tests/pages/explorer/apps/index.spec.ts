import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';

test.describe('Apps Index', { tag: ['@explorer', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('can redirect', async ({ page }) => {
    const pagePo = new PagePo(page, '/c/local/apps');

    await pagePo.goTo();

    await expect(page).toHaveURL(/\/c\/local\/apps\/charts/);
  });
});
