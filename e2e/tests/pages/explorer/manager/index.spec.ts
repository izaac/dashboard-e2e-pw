import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';

test.describe('Manager Index', { tag: ['@explorer', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('can redirect', async ({ page }) => {
    const pagePo = new PagePo(page, '/c/local/manager');

    await pagePo.goTo();

    await expect(page).toHaveURL(/\/c\/local\/manager\/provisioning\.cattle\.io\.cluster/);
  });
});
