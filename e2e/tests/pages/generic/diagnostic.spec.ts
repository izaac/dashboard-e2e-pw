import { test, expect } from '@/support/fixtures';
import DiagnosticsPagePo from '@/e2e/po/pages/diagnostics.po';
import * as fs from 'fs';

test.describe('Diagnostics Page', { tag: ['@generic', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('User should be able to download the diagnostics package JSON', async ({ page }) => {
    const diagnosticsPage = new DiagnosticsPagePo(page);

    await diagnosticsPage.goTo();

    // Wait for page to fully load before opening modal
    await expect(diagnosticsPage.diagnosticsPackageBtn().self()).toBeVisible();
    await expect(diagnosticsPage.diagnosticsPackageBtn().self()).toBeEnabled();

    // Open modal
    await diagnosticsPage.diagnosticsPackageBtn().click(true);

    // Wait for modal to appear and download button to be ready
    await expect(diagnosticsPage.downloadDiagnosticsModalActionBtn().self()).toBeVisible();
    await expect(diagnosticsPage.downloadDiagnosticsModalActionBtn().self()).toBeEnabled();

    // Set up download listener before triggering download
    const downloadPromise = page.waitForEvent('download');

    // Modal button to actually trigger the download
    await diagnosticsPage.downloadDiagnosticsModalActionBtn().click(true);

    const download = await downloadPromise;
    const downloadPath = await download.path();

    expect(downloadPath).toBeTruthy();

    const fileContent = fs.readFileSync(downloadPath!, 'utf-8');
    const jsonData = JSON.parse(fileContent);

    expect(Object.keys(jsonData).length).toBe(4);
  });
});
