import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import ExtensionsPagePo from '@/e2e/po/pages/extensions.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { LONG, STANDARD } from '@/support/timeouts';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR ||
  '/home/izaac/Documents/ui-qa-plans/plans/qa-19590-extension-error-message-html-escape-evidence';

// i18n key whose en-us text contains an apostrophe: "...so we won't load the external version"
const ERROR_KEY = 'plugins.error.developerPkg';
const ERROR_TEXT = "This Extension has been loaded internally, so we won't load the external version";
const TOOLTIP_TEXT = "we won't load the external version";
const ESCAPED_APOSTROPHE = '&#39;';

const PLUGIN_NAME = 'qa-test-plugin';

/**
 * Inject a synthetic loaded extension plus the load error the extension manager sets for an extension
 * shadowed by a built-in one. Catalog repos are not populated in a standalone cluster, so the plugin is
 * added straight into the uiplugins store; it then renders as a card on the Installed tab.
 */
async function injectPlugin(page: Page, name: string, error: string): Promise<void> {
  await page.evaluate(
    ({ name, error }) => {
      const store = (window as any).$globalApp?.$store;

      if (!store) {
        return;
      }

      store.commit('uiplugins/addPlugin', {
        name,
        id: name,
        builtin: false,
        metadata: {
          name,
          version: '1.0.0',
          description: 'QA validation extension',
        },
      });
      store.commit('uiplugins/setError', { name, error });
    },
    { name, error },
  );
}

/** Remove the synthetic extension and clear its error */
async function removePlugin(page: Page, name: string): Promise<void> {
  await page.evaluate(
    ({ name }) => {
      const store = (window as any).$globalApp?.$store;

      if (!store) {
        return;
      }

      store.commit('uiplugins/removePlugin', name);
      store.commit('uiplugins/setError', { name, error: false });
    },
    { name },
  );
}

test.describe('Extensions Error Message Escaping (#19590)', { tag: ['@generic', '@adminUser'] }, () => {
  let extensions: ExtensionsPagePo;

  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.beforeEach(async ({ login, page }) => {
    // Wide viewport so the slide-out detail drawer and its banner text are not wrapped or truncated in evidence
    await page.setViewportSize({ width: 1440, height: 900 });
    await login();

    extensions = new ExtensionsPagePo(page);
    await extensions.goTo();
    await new WelcomeDialogPo(page).dismissIfVisible();
    await extensions.waitForTitle();
    await expect(extensions.loading()).toHaveCount(0, { timeout: LONG });

    // The panel snapshots the plugin when opened, so the error must be injected before clicking the card
    await injectPlugin(page, PLUGIN_NAME, ERROR_KEY);
    await extensions.extensionTabInstalledClick();

    await expect(pluginCard()).toBeVisible({ timeout: LONG });
  });

  test.afterEach(async ({ page }) => {
    await removePlugin(page, PLUGIN_NAME);
  });

  const pluginCard = () => extensions.extensionCards().filter({ hasText: PLUGIN_NAME }).first();

  test('extension detail panel banner shows clean punctuation without raw HTML entities', async ({ page }) => {
    // The panel snapshots the plugin when opened, so the error must be injected before clicking the card (beforeEach)
    await pluginCard().click();

    const details = extensions.extensionDetails();

    await expect(details).toBeVisible({ timeout: STANDARD });

    const banner = extensions.extensionDetailsErrorBanner();

    await expect(banner).toBeVisible({ timeout: STANDARD });
    await expect(banner).toContainText(ERROR_TEXT);
    await expect(banner).not.toContainText(ESCAPED_APOSTROPHE);
    await expect(banner).not.toContainText('won&#39;t');

    // Wait for the slide-in drawer transition to finish so the banner is fully on-screen
    await expect(details).toBeVisible();
    await page.waitForFunction(() => {
      const el = document.querySelector('#slide-in-content-element') as HTMLElement | null;

      if (!el) {
        return false;
      }

      const rect = el.getBoundingClientRect();

      return (
        rect.right <= window.innerWidth && rect.left < window.innerWidth && !el.classList.contains('slide-enter-active')
      );
    });

    await banner.scrollIntoViewIfNeeded();
    await details.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-01-extension-detail-banner-clean-punctuation.png'),
    });
  });

  test('extension card status tooltip shows clean punctuation without raw HTML entities', async ({ page }) => {
    const statusIcon = pluginCard()
      .getByTestId(/^item-card-header-status-/)
      .first();

    await expect(statusIcon).toBeVisible({ timeout: STANDARD });
    await statusIcon.hover();

    const tooltip = extensions.extensionCardHeaderStatusTooltip();

    await expect(tooltip).toBeVisible({ timeout: STANDARD });
    await expect(tooltip).toContainText(TOOLTIP_TEXT);
    await expect(tooltip).not.toContainText(ESCAPED_APOSTROPHE);
    await expect(tooltip).not.toContainText('won&#39;t');

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-02-extension-card-tooltip-clean-punctuation.png'),
    });
  });
});
