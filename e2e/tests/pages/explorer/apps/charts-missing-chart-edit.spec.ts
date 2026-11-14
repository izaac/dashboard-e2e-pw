import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import { LONG, PROVISIONING } from '@/support/timeouts';

/**
 * Editing an installed app whose chart is missing shows the Chart dropdown (rancher/dashboard#19611, fix #19612).
 *
 * The fixture app is a real `podinfo` release (user value `replicaCount: 2`) installed from a throwaway ClusterRepo.
 * The repo is then deleted, so the app is left with no chart to resolve. The built-in `traefik` app is the
 * regression control. Nothing is ever upgraded: each test only opens the edit wizard and cancels.
 * Setup and teardown go through the API and teardown is idempotent.
 */
const REPO_URL = 'https://stefanprodan.github.io/podinfo';
const CHART = 'podinfo';
// Small partner chart picked when the catalog has it; any selectable chart is used otherwise
const PREFERRED_CHART_LABEL = 'Cerbos';
const INSTALLED_VALUE = 'replicaCount: 2';

const MANAGED_APP = { namespace: 'cattle-fleet-local-system', name: 'fleet-agent-local' };
// Installed with the cluster from a chart that is available in the default repositories
const AVAILABLE_APP = { namespace: 'kube-system', name: 'traefik' };
const AVAILABLE_APP_CHART = { repo: 'rancher-partner-charts', chart: 'traefik' };

type AppRef = { namespace: string; name: string };

/**
 * Edit wizard URL params as the Installed Apps "Edit/Upgrade" action builds them. The action only appends the
 * repo/chart params when it resolves the app's chart, so `resolvedChart` adds them for the healthy control app.
 */
async function editParams(
  rancherApi: RancherApi,
  app: AppRef,
  resolvedChart?: { repo: string; chart: string },
): Promise<string> {
  const resp = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.apps', `${app.namespace}/${app.name}`);
  const version: string | undefined = resp.body?.spec?.chart?.metadata?.version;

  expect(version, `${app.namespace}/${app.name} must report a chart version`).toBeTruthy();

  const params = `namespace=${app.namespace}&name=${app.name}&version=${encodeURIComponent(version as string)}`;

  return resolvedChart ? `${params}&repo-type=cluster&repo=${resolvedChart.repo}&chart=${resolvedChart.chart}` : params;
}

test.describe(
  'Apps / Installed Apps / Edit app with a missing chart',
  { tag: ['@explorer', '@adminUser', '@charts'] },
  () => {
    // Serial: the tests share one fixture app, created once in beforeAll and removed in afterAll
    test.describe.configure({ mode: 'serial' });

    let fixture: AppRef;
    let repoName: string;

    const deleteRepo = async (rancherApi: RancherApi, repo: string) => {
      await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repo, false);
      await rancherApi.waitForResourceGone('v1', 'catalog.cattle.io.clusterrepos', repo);
    };

    const teardown = async (rancherApi: RancherApi) => {
      if (!fixture) {
        return;
      }

      await rancherApi.ensureChartUninstalled(fixture.namespace, fixture.name);
      await rancherApi.deleteRancherResource('v1', 'namespaces', fixture.namespace, false);
      await rancherApi.waitForResourceGone('v1', 'namespaces', fixture.namespace);
      await deleteRepo(rancherApi, repoName);
    };

    /** Create a podinfo ClusterRepo and install it as a deployed app with the user value `replicaCount: 2` */
    const installPodinfo = async (rancherApi: RancherApi, repo: string, app: AppRef) => {
      await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
        apiVersion: 'catalog.cattle.io/v1',
        kind: 'ClusterRepo',
        metadata: { name: repo },
        spec: { url: REPO_URL },
      });

      const downloaded = await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', repo, 60);

      expect(downloaded, `ClusterRepo ${repo} must reach Downloaded`).toBe(true);

      const version = await rancherApi.getLatestChartVersion(repo, CHART);

      // Mirror the UI install payload so the app records its source repo
      await rancherApi.createRancherResource('v1', `catalog.cattle.io.clusterrepos/${repo}?action=install`, {
        charts: [
          {
            chartName: CHART,
            version,
            releaseName: app.name,
            annotations: {
              'catalog.cattle.io/ui-source-repo-type': 'cluster',
              'catalog.cattle.io/ui-source-repo': repo,
            },
            values: { replicaCount: 2 },
          },
        ],
        noHooks: false,
        timeout: '600s',
        wait: true,
        namespace: app.namespace,
        projectId: '',
      });

      await rancherApi.expectResourceState(
        'v1',
        'catalog.cattle.io.apps',
        `${app.namespace}/${app.name}`,
        (resp) => resp.body?.metadata?.state?.name === 'deployed',
        60,
        5000,
      );
    };

    test.beforeAll(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);

      const suffix = Math.random().toString(36).slice(2, 8);

      repoName = `e2e-missingchart-${suffix}`;
      fixture = { namespace: repoName, name: repoName };

      try {
        await rancherApi.createNamespace(fixture.namespace);
        await installPodinfo(rancherApi, repoName, fixture);

        // The app stays installed, its chart repo goes away: this is the "chart missing" state
        await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName);
        await rancherApi.expectResourceGone('v1', 'catalog.cattle.io.clusterrepos', repoName);
      } catch (e) {
        await teardown(rancherApi);
        throw e;
      }
    });

    test.afterAll(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await teardown(rancherApi);
    });

    test.beforeEach(async ({ login }) => {
      await login();
    });

    test('S1: shows the Chart dropdown, no Version dropdown and a disabled Next', async ({ page, rancherApi }) => {
      const installChartPage = new InstallChartPage(page);

      await installChartPage.goTo(await editParams(rancherApi, fixture));

      await expect(installChartPage.editHeading(fixture.name)).toBeVisible({ timeout: LONG });
      await expect(installChartPage.missingChartSelector()).toBeVisible({ timeout: LONG });
      await expect(installChartPage.editVersionSelector()).toBeHidden();
      await expect(installChartPage.nextButton()).toBeDisabled();
    });

    test('S2: choosing a chart reveals Version, enables Next and keeps the installed values', async ({
      page,
      rancherApi,
    }) => {
      const installChartPage = new InstallChartPage(page);

      await installChartPage.goTo(await editParams(rancherApi, fixture));
      await expect(installChartPage.missingChartSelector()).toBeVisible({ timeout: LONG });

      // Any chart will do (a small one is preferred): the point is that picking one resolves the missing chart
      await installChartPage.selectAnyOption(installChartPage.missingChartSelector(), PREFERRED_CHART_LABEL);

      await expect(installChartPage.editVersionSelector()).toBeVisible({ timeout: LONG });
      await expect(installChartPage.missingChartSelector()).toBeHidden();
      await expect(installChartPage.nextButton()).toBeEnabled({ timeout: LONG });

      await installChartPage.nextPage();

      // The values step loads asynchronously; poll until the installed value shows up
      await expect(installChartPage.overridesPane()).toContainText('Your values', { timeout: LONG });
      await expect(async () => {
        await expect(installChartPage.overridesPane()).toContainText(INSTALLED_VALUE);
      }).toPass({ timeout: LONG });

      // Leave without upgrading anything
      await installChartPage.cancelButton().click();
      await expect(installChartPage.editHeading(fixture.name)).toBeHidden({ timeout: LONG });
    });

    test('S3: a Rancher managed app shows the warning and neither Chart nor Version dropdown', async ({
      page,
      rancherApi,
    }) => {
      const installChartPage = new InstallChartPage(page);

      await installChartPage.goTo(await editParams(rancherApi, MANAGED_APP));

      await expect(installChartPage.editHeading(MANAGED_APP.name)).toBeVisible({ timeout: LONG });
      await expect(installChartPage.managedAppWarning()).toContainText(
        `Warning, Rancher manages deployment and upgrade of the ${MANAGED_APP.name} app. Upgrading this app is not supported.`,
        { timeout: LONG },
      );
      await expect(installChartPage.missingChartSelector()).toBeHidden();
      await expect(installChartPage.editVersionSelector()).toBeHidden();
      await expect(installChartPage.nextButton()).toBeDisabled();
    });

    test('S4: an app whose chart is available keeps the Version dropdown and no Chart dropdown', async ({
      page,
      rancherApi,
    }) => {
      const installChartPage = new InstallChartPage(page);

      await installChartPage.goTo(await editParams(rancherApi, AVAILABLE_APP, AVAILABLE_APP_CHART));

      await expect(installChartPage.editHeading(AVAILABLE_APP.name)).toBeVisible({ timeout: LONG });
      await expect(installChartPage.editVersionSelector()).toBeVisible({ timeout: LONG });
      await expect(installChartPage.missingChartSelector()).toBeHidden();
      await expect(installChartPage.nextButton()).toBeEnabled();
    });
  },
);
