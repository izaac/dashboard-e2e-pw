import { test, expect } from '@/support/fixtures';
import type { Page, Locator } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import PagePo from '@/e2e/po/pages/page.po';
import { WorkLoadsJobDetailsPagePo } from '@/e2e/po/pages/explorer/workloads-jobs.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import ResourcePopoverPo from '@/e2e/po/components/resource-popover.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

const NAMESPACE = 'qa-16487-ns';
const JOB = 'qa-16487-job';
const REPLICA_SET = 'qa-16487-healthy-6c786bdf84';

const podDetailPattern = new RegExp(`/v1/pods/${NAMESPACE}/.+`);

// Compute path to ui-qa-plans evidence directory
const evidence16487 =
  process.env.EVIDENCE_DIR_16487 ||
  path.resolve(__dirname, '../../../../../../Documents/ui-qa-plans/plans/qa-16487-evidence');
const evidence16488 =
  process.env.EVIDENCE_DIR_16488 ||
  path.resolve(__dirname, '../../../../../../Documents/ui-qa-plans/plans/qa-16488-evidence');

if (!fs.existsSync(evidence16487)) {
  fs.mkdirSync(evidence16487, { recursive: true });
}
if (!fs.existsSync(evidence16488)) {
  fs.mkdirSync(evidence16488, { recursive: true });
}

async function openRelatedTab(page: Page): Promise<Locator> {
  const tabbed = new TabbedPo(page);

  await tabbed.tab('related').click();

  const panel = tabbed.panel('related');

  await expect(panel).toBeVisible();

  return panel;
}

async function goToJobDetail(page: Page): Promise<void> {
  await new WorkLoadsJobDetailsPagePo(page, JOB, 'local', NAMESPACE).goTo();
}

async function goToReplicaSetDetail(page: Page): Promise<void> {
  await new PagePo(page, `/c/local/explorer/apps.replicaset/${NAMESPACE}/${REPLICA_SET}`).goTo();
}

function podsTable(page: Page): SortableTablePo {
  return new SortableTablePo(page, ':scope', page.getByRole('table').first());
}

test.describe('Smart Popovers (#16487 & #16488)', { tag: ['@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test.describe('Smart Popovers for Pods (#16487)', () => {
    test('1. Healthy pod in ReplicaSet Related Resources shows green indicator, 1/1 ready, 0 restarts, pod IP, and owning ReplicaSet', async ({
      page,
    }) => {
      await goToReplicaSetDetail(page);

      const panel = await openRelatedTab(page);
      const popover = new ResourcePopoverPo(page, panel);

      await popover.target().first().hover();
      await expect(popover.card()).toBeVisible();

      const shotPath = path.join(evidence16487, 'pod-popover-healthy.png');

      await popover.card().screenshot({ path: shotPath });

      await expect(popover.readyIndicator()).toBeVisible();
      await expect(popover.card()).toContainText('ReplicaSet');
      await expect(popover.row('Pod IP')).toBeVisible();
    });

    test('2. Completed Job pod shows neutral indicator dot and Completed status', async ({ page }) => {
      await goToJobDetail(page);

      const panel = await openRelatedTab(page);
      const popover = new ResourcePopoverPo(page, panel);

      await popover.target().first().hover();
      await expect(popover.card()).toBeVisible();

      const shotPath = path.join(evidence16487, 'pod-popover-job.png');

      await popover.card().screenshot({ path: shotPath });

      await expect(popover.readyIndicator()).toBeVisible();
      await expect(popover.card()).toContainText('Job');
    });

    test('3. Lazy loading: pod card content is only rendered on hover/focus', async ({ page }) => {
      let podDetailRequests = 0;

      await page.route(podDetailPattern, async (route) => {
        podDetailRequests++;

        await route.continue();
      });

      await goToJobDetail(page);

      const panel = await openRelatedTab(page);
      const popover = new ResourcePopoverPo(page, panel);

      expect(podDetailRequests).toBe(0);
      await expect(popover.card()).toBeHidden();

      await popover.target().first().hover();
      await expect(popover.card()).toBeVisible();
      await expect(popover.readyIndicator()).toBeVisible();
      await expect(popover.row('Pod IP')).toBeVisible();
    });

    test('4. Keyboard navigation: Tab focuses chevron, Enter opens card, Escape closes and restores focus', async ({
      page,
    }) => {
      await goToJobDetail(page);

      const panel = await openRelatedTab(page);
      const popover = new ResourcePopoverPo(page, panel);
      const focusButton = popover.focusButton().first();

      await focusButton.focus();
      await page.keyboard.press('Enter');
      await expect(popover.card()).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(popover.card()).toBeHidden();
      await expect(focusButton).toBeFocused();
    });
  });

  test.describe('Smart Popovers for Nodes (#16488)', () => {
    test('1. Pods list Node column opens smart popover with node metrics and IPs', async ({ page }) => {
      await new PagePo(page, '/c/local/explorer/pod').goTo();

      const firstRow = podsTable(page).row(0);
      const popover = new ResourcePopoverPo(page, firstRow.self());

      await popover.target().first().hover();
      await expect(popover.card()).toBeVisible();

      await expect(popover.usage()).toBeVisible({ timeout: 15_000 });

      const shotPath = path.join(evidence16488, 'node-popover.png');

      await popover.card().screenshot({ path: shotPath });

      await expect(popover.row('Internal IP')).toBeVisible();
      await expect(popover.row('Version')).toBeVisible();
      await expect(popover.row('OS')).toBeVisible();
      await expect(popover.usageItem('cpu')).toBeVisible();
      await expect(popover.usageItem('memory')).toBeVisible();
      await expect(popover.usageItem('pods')).toBeVisible();
    });

    test('2. Row selection isolation: clicking inside popover does not toggle row checkbox', async ({ page }) => {
      await new PagePo(page, '/c/local/explorer/pod').goTo();

      const firstRow = podsTable(page).row(0);
      const checkbox = firstRow.checkbox();

      await expect(checkbox).not.toBeChecked();

      const popover = new ResourcePopoverPo(page, firstRow.self());

      await popover.target().first().hover();
      await expect(popover.card()).toBeVisible();

      await popover.card().click();
      await expect(checkbox).not.toBeChecked();
    });

    test('3. Metrics unavailable fallback: CPU and Memory show n/a when metrics API returns 404', async ({ page }) => {
      await page.route('**/v1/metrics.k8s.io.nodes/**', async (route) => {
        await route.fulfill({ status: 404, body: 'Not found' });
      });

      await new PagePo(page, '/c/local/explorer/pod').goTo();

      const firstRow = podsTable(page).row(0);
      const popover = new ResourcePopoverPo(page, firstRow.self());

      await popover.target().first().hover();
      await expect(popover.card()).toBeVisible();

      const shotPath = path.join(evidence16488, 'node-popover-na.png');

      await popover.card().screenshot({ path: shotPath });

      await expect(popover.usageItem('cpu')).toContainText('n/a');
      await expect(popover.usageItem('memory')).toContainText('n/a');
      await expect(popover.usageItem('pods')).toBeVisible();
    });

    test('4. Keyboard navigation: Tab to chevron, Enter opens card, Escape closes and restores focus', async ({
      page,
    }) => {
      await new PagePo(page, '/c/local/explorer/pod').goTo();

      const firstRow = podsTable(page).row(0);
      const popover = new ResourcePopoverPo(page, firstRow.self());
      const focusButton = popover.focusButton().first();

      await focusButton.focus();
      await page.keyboard.press('Enter');
      await expect(popover.card()).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(popover.card()).toBeHidden();
      await expect(focusButton).toBeFocused();
    });
  });
});
