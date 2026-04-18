import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SlideInPo from '@/e2e/po/side-bars/slide-in.po';
import { HeaderPo } from '@/e2e/po/components/header.po';

test.describe('Can describe resource', { tag: ['@explorer2', '@adminUser', '@standardUser'] }, () => {
  test('Can open describe resource', async ({ page, login }) => {
    await login();
    const podsPage = new PagePo(page, '/c/local/explorer/pod');

    await podsPage.goTo();
    await podsPage.waitForPage();

    const header = new HeaderPo(page);

    await header.kubectlExplain().click();

    const slideIn = new SlideInPo(page);

    await slideIn.checkExists();
    await slideIn.checkVisible();
    await slideIn.closeButton().click({ force: true });
    await expect(slideIn.self()).not.toHaveClass(/slide-in-open/, { timeout: 15000 });
  });
});
