import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';

test.describe('Explorer Index', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('can redirect', async ({ page, login }) => {
    await login();
    const indexPage = new PagePo(page, '/c/local/');

    await indexPage.goTo();
    await expect(page).toHaveURL(/\/c\/local\/explorer/);
  });
});
