import { test } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';

test.describe('Page Actions', { tag: ['@navigation', '@adminUser', '@standardUser'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
  });
});
