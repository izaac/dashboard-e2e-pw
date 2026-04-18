import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';

test.describe('Global Settings Index', { tag: ['@globalSettings', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('can redirect', async ({ page }) => {
    const pagePo = new PagePo(page, '/c/local/settings');

    await pagePo.goTo();

    await expect(page).toHaveURL(/\/c\/local\/settings\/management\.cattle\.io\.setting/);
  });
});
