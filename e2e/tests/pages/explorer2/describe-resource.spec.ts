import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SlideInPo from '@/e2e/po/side-bars/slide-in.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import { SHORT_TIMEOUT_OPT } from '@/support/timeouts';

test.describe('Can describe resource', { tag: ['@explorer2', '@adminUser', '@standardUser'] }, () => {
  test('Can open describe resource', async ({ page, login }) => {
    await login();
    const podsPage = new PagePo(page, '/c/local/explorer/pod');

    await podsPage.goTo();
    await podsPage.waitForPage();

    const header = new HeaderPo(page);

    await header.kubectlExplain().click();

    const slideIn = new SlideInPo(page);

    await expect(slideIn.self()).toBeAttached();
    await expect(slideIn.self()).toBeVisible();
    // v2.15: close button is positioned outside the viewport in the slide-in panel —
    // scroll into view, then click. dispatchEvent bypasses Playwright actionability
    // entirely, which can mask future regressions where the button is genuinely
    // unclickable (e.g. covered by an overlay).
    await slideIn.closeButton().scrollIntoViewIfNeeded();
    await slideIn.closeButton().click();
    await expect(slideIn.self()).not.toHaveClass(/slide-in-open/, SHORT_TIMEOUT_OPT);
  });
});
