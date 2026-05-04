import { test, expect } from '@/support/fixtures';
import V2MonitoringPagePo from '@/e2e/po/other-products/v2-monitoring.po';
import PreferencesPagePo from '@/e2e/po/pages/preferences.po';
import PagePo from '@/e2e/po/pages/page.po';
import { BRIEF, LONG, PROVISIONING } from '@/support/timeouts';

const CLUSTER_ID = 'local';
const CHART_REPO = 'rancher-charts';
const CHART_NAME = 'rancher-monitoring';
const CHART_CRD_NAME = 'rancher-monitoring-crd';
const CHART_NAMESPACE = 'cattle-monitoring-system';

const ALERT_NAME = 'test-alert';
const ALERT_NAMESPACE = 'default';
const PROM_RULE_NAME = 'some-prom-rules';
const PROM_RULE_NAMESPACE = 'default';

// Polling windows are sized for a Rancher running at the chart's minimum required
// resources (4500m CPU, 4000Mi memory). On smaller hosts the operator pods take
// noticeably longer to settle, so install/uninstall use generous retry counts.
const INSTALL_RETRIES = 120;
const INSTALL_DELAY_MS = 5000;
// Page-load wait: 30 attempts × 10 s = 5 minutes total, sized to absorb CRD
// registration + extension UI loading on min-resource Rancher.
const PAGE_LOAD_TIMEOUT = 300_000;
const PAGE_LOAD_INTERVAL_MS = 10_000;

async function waitForMonitoringPage(page: import('@playwright/test').Page, urlSuffix: string): Promise<void> {
  // Big charts like rancher-monitoring can take 2+ minutes for CRDs to register and the
  // monitoring extension UI to load. expect.poll re-navigates each iteration; the
  // condition is the fail-whale clearing — there is no `crd-ready` event to subscribe to.
  const basePage = new PagePo(page, `/c/${CLUSTER_ID}/monitoring`);

  await expect
    .poll(
      async () => {
        await page.goto(`./c/${CLUSTER_ID}/monitoring/${urlSuffix}`, { waitUntil: 'domcontentloaded' });

        return basePage.isFailWhaleVisible();
      },
      {
        timeout: PAGE_LOAD_TIMEOUT,
        intervals: [PAGE_LOAD_INTERVAL_MS],
        message: `Monitoring page '${urlSuffix}' did not load within polling window`,
      },
    )
    .toBe(false);
}

test.describe('V2 Monitoring Chart', { tag: ['@charts', '@adminUser'] }, () => {
  // Serial: every test reuses a single rancher-monitoring install/uninstall cycle in cattle-monitoring-system;
  // parallel runs would collide on the chart's ClusterScoped CRDs and finalizers.
  test.describe.configure({ mode: 'serial' });
  // Heavy form rendering on the rancher-monitoring product page (form-builder
  // mounts inputs after async catalog/CRD lookups settle). Default 10s action
  // timeout is too tight on the min-resource Rancher this spec targets, so
  // bump every action in the describe to LONG.
  test.use({ actionTimeout: LONG });

  test.beforeEach(async ({ login, rancherApi, chartGuard }) => {
    await rancherApi.waitForHealthy();
    await chartGuard(CHART_REPO, CHART_NAME);
    await login();
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      await rancherApi.ensureChartUninstalled(CHART_NAMESPACE, CHART_NAME, CHART_CRD_NAME, 60, BRIEF);
      // monitoring CRDs (prometheusrules, alertmanagerconfigs, …) hold finalizers
      // that block GC after uninstall — same pattern as elemental.
      await rancherApi
        .forceCleanStuckCRDs('monitoring.coreos.com')
        .catch((err) =>
          console.warn(`[v2-monitoring afterAll] forceCleanStuckCRDs failed: ${(err as Error)?.message ?? err}`),
        );
    } finally {
      await rancherApi.updateNamespaceFilter(CLUSTER_ID, 'none', `{"${CLUSTER_ID}":["all://user"]}`);
      await rancherApi.waitForHealthy();
    }
  });

  test.describe('AlertmanagerConfig', () => {
    test.beforeEach(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await rancherApi.ensureChartInstalled(
        CHART_REPO,
        CHART_NAMESPACE,
        CHART_NAME,
        CHART_CRD_NAME,
        INSTALL_RETRIES,
        INSTALL_DELAY_MS,
      );

      await rancherApi.deleteRancherResource(
        'v1',
        'monitoring.coreos.com.alertmanagerconfigs',
        `${ALERT_NAMESPACE}/${ALERT_NAME}`,
        false,
      );
      await rancherApi.createRancherResource(
        'v1',
        'monitoring.coreos.com.alertmanagerconfigs',
        {
          type: 'monitoring.coreos.com.alertmanagerconfig',
          metadata: { name: ALERT_NAME, namespace: ALERT_NAMESPACE },
          spec: { route: { receiver: 'placeholder' }, receivers: [{ name: 'placeholder' }] },
        },
        false,
      );
    });

    test.afterEach(async ({ rancherApi }) => {
      await rancherApi.deleteRancherResource(
        'v1',
        'monitoring.coreos.com.alertmanagerconfigs',
        `${ALERT_NAMESPACE}/${ALERT_NAME}`,
        false,
      );
    });

    test('alertmanagerconfig should have property "proxyURL" correctly filled out', async ({ page }) => {
      test.setTimeout(PROVISIONING);

      // The Rancher steve aggregator rejects the form's payload as 422 (the seed
      // CR lacks the schema bits the validator wants), so mock the PUT to 201
      // and capture the request body instead. This mirrors upstream cypress
      // (`cy.intercept('PUT', …)` with a 201 reply) and keeps the assertion focused
      // on the form payload — the only thing the test cares about.
      let capturedBody: any = null;

      await page.route(
        new RegExp(`/v1/monitoring\\.coreos\\.com\\.alertmanagerconfigs/${ALERT_NAMESPACE}/${ALERT_NAME}\\b`),
        async (route, request) => {
          if (request.method() !== 'PUT') {
            await route.continue();

            return;
          }

          try {
            capturedBody = request.postDataJSON();
          } catch {
            capturedBody = JSON.parse(request.postData() ?? '{}');
          }

          await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
        },
      );

      await waitForMonitoringPage(page, 'monitoring.coreos.com.alertmanagerconfig');

      const v2 = new V2MonitoringPagePo(page);

      await v2.waitForPage();
      await v2.editV2MonitoringItem(ALERT_NAME);

      await v2.alertManagerConfigAddReceiver().click();
      await v2.pagerDutyTab().click();
      await v2.addPagerDutyReceiver().click();
      await v2.receiverName().set('some-name');
      await v2.proxyUrl().set('some-url');
      await v2.saveCreateForm().click();

      await expect.poll(() => capturedBody, { timeout: LONG }).not.toBeNull();

      const newReceiver = capturedBody.spec.receivers.find((r: { name: string }) => r.name === 'some-name');

      expect(newReceiver?.pagerdutyConfigs?.[0]?.httpConfig?.proxyURL).toBe('some-url');
    });
  });

  test.describe('PrometheusRule create', () => {
    test.beforeEach(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await rancherApi.ensureChartInstalled(
        CHART_REPO,
        CHART_NAMESPACE,
        CHART_NAME,
        CHART_CRD_NAME,
        INSTALL_RETRIES,
        INSTALL_DELAY_MS,
      );
      await rancherApi.deleteRancherResource(
        'v1',
        'monitoring.coreos.com.prometheusrules',
        `${PROM_RULE_NAMESPACE}/${PROM_RULE_NAME}`,
        false,
      );
    });

    test.afterEach(async ({ rancherApi }) => {
      await rancherApi.deleteRancherResource(
        'v1',
        'monitoring.coreos.com.prometheusrules',
        `${PROM_RULE_NAMESPACE}/${PROM_RULE_NAME}`,
        false,
      );
    });

    test('multiple Alerting Rules in PrometheusRule should have different values', async ({ page }) => {
      test.setTimeout(PROVISIONING);

      await waitForMonitoringPage(page, 'monitoring.coreos.com.prometheusrule/create');

      const v2 = new V2MonitoringPagePo(page);

      await v2.waitForPage();

      const rulesPromise = page.waitForRequest(
        (req) => req.url().includes('monitoring.coreos.com.prometheusrules') && req.method() === 'POST',
        { timeout: LONG },
      );

      await v2.nameNsDescription().name().set('some-prom-rules');

      await v2.prometheusRuleGroupName(0).set('group-name-0');
      await v2.prometheusRuleGroupInterval(0).set('60');
      await v2.prometheusRulesAddRecord(0).click();
      await v2.prometheusRulesRecordName(0).set('record-0');
      await v2.prometheusRulesRecordPromQl(0).set('promql-0');

      await v2.newPrometheusRuleAddBtn().click();
      await v2.groupTab(1).click();

      await v2.prometheusRuleGroupName(1).set('group-name-1');
      await v2.prometheusRuleGroupInterval(1).set('61');
      await v2.prometheusRulesAddRecord(1).click();
      await v2.prometheusRulesRecordName(1).set('record-1');
      await v2.prometheusRulesRecordPromQl(1).set('promql-1');

      await v2.saveCreateForm().click();

      const request = await rulesPromise;
      const body = request.postDataJSON();

      expect(body.spec.groups[0]).toEqual({
        name: 'group-name-0',
        interval: '60s',
        rules: [
          {
            record: 'record-0',
            expr: 'promql-0',
            labels: {
              severity: 'none',
              namespace: 'default',
              cluster_id: CLUSTER_ID,
              cluster_name: CLUSTER_ID,
            },
          },
        ],
      });
      expect(body.spec.groups[1]).toEqual({
        name: 'group-name-1',
        interval: '61s',
        rules: [
          {
            record: 'record-1',
            expr: 'promql-1',
            labels: {
              severity: 'none',
              namespace: 'default',
              cluster_id: CLUSTER_ID,
              cluster_name: CLUSTER_ID,
            },
          },
        ],
      });
    });
  });

  // Regression: rancher/dashboard#9923 — severity dropdown options were being
  // i18n-translated when the user changed language to zh-hans, but the *value*
  // sent to the API must stay in English.
  test.describe('Alerting Rules severity in Chinese language', () => {
    test.beforeEach(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await rancherApi.ensureChartInstalled(
        CHART_REPO,
        CHART_NAMESPACE,
        CHART_NAME,
        CHART_CRD_NAME,
        INSTALL_RETRIES,
        INSTALL_DELAY_MS,
      );
      await rancherApi.deleteRancherResource(
        'v1',
        'monitoring.coreos.com.prometheusrules',
        `${PROM_RULE_NAMESPACE}/${PROM_RULE_NAME}`,
        false,
      );
      await rancherApi.setUserPreference({ language: 'zh-hans' });
    });

    test.afterEach(async ({ rancherApi }) => {
      await rancherApi.setUserPreference({ language: 'en-us' });
      await rancherApi.deleteRancherResource(
        'v1',
        'monitoring.coreos.com.prometheusrules',
        `${PROM_RULE_NAMESPACE}/${PROM_RULE_NAME}`,
        false,
      );
    });

    test('Alerting Rules "Severity" select should NOT be translating the values to Chinese', async ({ page }) => {
      test.setTimeout(PROVISIONING);

      // Confirm the language change took effect via the prefs page first — guards
      // against assertion noise if the preference write was raced by setup.
      const prefPage = new PreferencesPagePo(page);

      await prefPage.goTo();
      await prefPage.waitForPage();

      await waitForMonitoringPage(page, 'monitoring.coreos.com.prometheusrule/create');

      const v2 = new V2MonitoringPagePo(page);

      await v2.waitForPage();

      const rulesPromise = page.waitForRequest(
        (req) => req.url().includes('monitoring.coreos.com.prometheusrules') && req.method() === 'POST',
        { timeout: LONG },
      );

      await v2.nameNsDescription().name().set('some-prom-rules');

      await v2.prometheusRuleGroupName(0).set('group-name-0');
      await v2.prometheusRuleGroupInterval(0).set('60');

      await v2.prometheusRulesAddAlert(0).click();
      await v2.prometheusRulesAlertName(0).set('record-0');
      await v2.prometheusRulesAlertPromQl(0).set('promql-0');

      await v2.alertingRuleSeveritySelect(0).dropdown().click();
      await v2.alertingRuleSeveritySelect(0).optionByIndex(1).click();

      await v2.saveCreateForm().click();

      const request = await rulesPromise;
      const body = request.postDataJSON();

      expect(body.spec.groups[0].rules[0].labels.severity).toBe('critical');
    });
  });
});
