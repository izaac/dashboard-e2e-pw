import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';

test.describe('Theme of loading indicator', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
  test('should have dark color', async ({ page, envMeta }) => {
    await page.context().addCookies([
      {
        name: 'R_THEME',
        value: 'dark',
        url: envMeta.baseUrl,
      },
    ]);

    await page.goto(envMeta.baseUrl);

    const basePage = new PagePo(page, '/');
    const styleContent = await basePage.headStyleContent();

    expect(styleContent).toContain('--loading-bg-color: #1b1c21');
  });

  test('should have light color', async ({ page, envMeta }) => {
    await page.context().addCookies([
      {
        name: 'R_THEME',
        value: 'light',
        url: envMeta.baseUrl,
      },
    ]);

    await page.goto(envMeta.baseUrl);

    const basePage = new PagePo(page, '/');
    const styleContent = await basePage.headStyleContent();

    expect(styleContent).toContain('--loading-bg-color: #FFF');
  });
});
