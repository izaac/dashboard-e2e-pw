import { test, expect } from '@/support/fixtures';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import type { Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR ||
  '/home/izaac/Documents/ui-qa-plans/plans/qa-9048-gatekeeper-upgrade-new-values-yaml-evidence';
const CHART_PARAMS = 'repo-type=cluster&repo=rancher-charts&chart=rancher-gatekeeper';
const SECCOMP_LABEL = 'Enable Runtime Default Seccomp Profile';

test.describe('Gatekeeper CRD Chart Values Upgrade (#9048)', { tag: ['@generic', '@adminUser'] }, () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.beforeEach(async ({ login, page }) => {
    await login();
    await new WelcomeDialogPo(page).dismissIfVisible();
  });

  /** Open the Gatekeeper install wizard and advance to step 2 (Customize Gatekeeper options). */
  async function openGatekeeperOptions(page: Page): Promise<InstallChartPage> {
    const installChartPage = new InstallChartPage(page);

    await installChartPage.goTo(CHART_PARAMS);
    await installChartPage.waitForChartPage('rancher-charts', 'rancher-gatekeeper');
    await installChartPage.nextPage();

    return installChartPage;
  }

  function seccompCheckbox(page: Page): CheckboxInputPo {
    return CheckboxInputPo.byLabel(page, new InstallChartPage(page).self(), SECCOMP_LABEL);
  }

  test('Scenario 1 and 3: fresh install shows target chart version defaults including the new seccomp option', async ({
    page,
  }) => {
    await openGatekeeperOptions(page);

    const checkbox = seccompCheckbox(page);

    await expect(checkbox.self()).toBeVisible();

    const checked = await checkbox.inputElement().isChecked();

    // Record the default so the evidence reviewer can compare it against the chart's values.yaml
    test.info().annotations.push({ type: 'seccomp-default-checked', description: String(checked) });
    await expect(checkbox.inputElement()).toBeChecked({ checked });

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-03-gatekeeper-fresh-install-defaults.png'),
      fullPage: true,
    });
  });

  test('Scenario 1: install options show the new CRD value from the target chart version', async ({ page }) => {
    await openGatekeeperOptions(page);

    await expect(seccompCheckbox(page).self()).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-01-gatekeeper-upgrade-new-values-shown.png'),
      fullPage: true,
    });
  });

  test('Scenario 2: user custom values are accepted and held in the form state', async ({ page }) => {
    await openGatekeeperOptions(page);

    const checkbox = seccompCheckbox(page);

    await expect(checkbox.self()).toBeVisible();

    const before = await checkbox.inputElement().isChecked();

    await checkbox.set();
    await expect(checkbox.inputElement()).toBeChecked({ checked: !before });

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-02-gatekeeper-upgrade-user-values-preserved.png'),
      fullPage: true,
    });
  });
});
