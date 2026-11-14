import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import type ClusterResourceStatusPo from '@/e2e/po/components/cluster-resource-status.po';
import { WorkloadsDeploymentsListPagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import { WorkloadsJobsListPagePo } from '@/e2e/po/pages/explorer/workloads-jobs.po';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { LONG_TIMEOUT_OPT, EXTRA_LONG } from '@/support/timeouts';

/**
 * rancher/dashboard#7992 (fix PR #19386): the Cluster Dashboard shows a Nodes card, a Deployments card and an
 * "Other, Unhealthy Workloads" card instead of the Total Resources card, so workloads with errors are visible
 * and link to the matching filtered lists.
 *
 * Every count is relative to what the cluster has before the test changes anything (read from the API), so the
 * specs hold on a cluster with any number of Deployments. The restricted-user part only covers the correct
 * behavior (Nodes card present, no Deployments card); the message of the third card for that user is not asserted.
 */
test.describe('Cluster Dashboard resource status cards', { tag: ['@explorer2', '@adminUser'] }, () => {
  const CLUSTER_ID = 'local';
  const IMAGE = 'busybox:1.36';
  const BAD_IMAGE = 'registry.invalid/e2e-7992/does-not-exist:0';
  const HEALTHY_DEPLOYMENT = 'healthy';
  const BAD_DEPLOYMENT = 'bad';
  const FAILING_JOB = 'fail';
  const STUCK_POD = 'stuck';
  const ALL_NAMESPACES = 'All Namespaces';
  const DEFAULT_NS_FILTER = '{"local":[]}';
  const NAMESPACE_GONE_RETRIES = 90;
  const NAMESPACE_GONE_DELAY = 2_000;

  let suffix = '';
  let brokenNs = '';
  let healthyNs = '';
  /** The user preference holding the namespace filter, restored in afterAll */
  let originalNsFilter: string | undefined;

  type Baseline = { nodes: number; deployments: number; activeDeployments: number; errorDeployments: number };

  /** Cleanup step that warns with context and lets the remaining steps run when it fails. */
  async function cleanupStep<T>(what: string, step: () => Promise<T>): Promise<T | undefined> {
    try {
      return await step();
    } catch (err) {
      console.warn(`[cluster-dashboard-status-cards cleanup] ${what}: ${(err as Error)?.message ?? err}`);

      return undefined;
    }
  }

  function deploymentBody(namespace: string, name: string, image: string, extraSpec: Record<string, unknown> = {}) {
    return {
      type: 'apps.deployment',
      metadata: { name, namespace },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            terminationGracePeriodSeconds: 0,
            containers: [{ name: 'container-0', image, command: ['sleep', '86400'] }],
          },
        },
        ...extraSpec,
      },
    };
  }

  /** A Deployment that never becomes available and reports Error after its 10 s progress deadline */
  async function createBrokenWorkloads(rancherApi: RancherApi) {
    await rancherApi.createRancherResource(
      'v1',
      'apps.deployments',
      deploymentBody(brokenNs, BAD_DEPLOYMENT, BAD_IMAGE, { progressDeadlineSeconds: 10 }),
    );
    await rancherApi.createRancherResource('v1', 'batch.jobs', {
      type: 'batch.job',
      metadata: { name: FAILING_JOB, namespace: brokenNs },
      spec: {
        backoffLimit: 0,
        template: {
          spec: {
            restartPolicy: 'Never',
            terminationGracePeriodSeconds: 0,
            containers: [{ name: 'container-0', image: IMAGE, command: ['sh', '-c', 'exit 1'] }],
          },
        },
      },
    });
    await rancherApi.createRancherResource('v1', 'pods', {
      type: 'pod',
      metadata: { name: STUCK_POD, namespace: brokenNs },
      spec: {
        terminationGracePeriodSeconds: 0,
        nodeSelector: { 'e2e-7992': 'no-such-node' },
        containers: [{ name: 'container-0', image: IMAGE, command: ['sleep', '86400'] }],
      },
    });
  }

  /** Delete the broken workloads (safe to repeat; a missing resource is not an error) and wait until they are gone */
  async function removeBrokenWorkloads(rancherApi: RancherApi) {
    const targets = [
      { type: 'apps.deployments', name: BAD_DEPLOYMENT, deleteSuffix: '' },
      // Jobs are deleted with the default "orphan" policy by the API, so ask for the pods to go with them
      { type: 'batch.jobs', name: FAILING_JOB, deleteSuffix: '?propagationPolicy=Background' },
      { type: 'pods', name: STUCK_POD, deleteSuffix: '' },
    ];

    for (const target of targets) {
      await cleanupStep(`delete ${target.type} ${target.name}`, () =>
        rancherApi.deleteRancherResource('v1', target.type, `${brokenNs}/${target.name}${target.deleteSuffix}`, false),
      );
    }

    for (const target of targets) {
      const gone = await cleanupStep(`wait for ${target.type} ${target.name} to be gone`, () =>
        rancherApi.waitForResourceGone('v1', target.type, `${brokenNs}/${target.name}`),
      );

      if (gone === false) {
        console.warn(`[cluster-dashboard-status-cards cleanup] ${target.type} ${target.name} still present`);
      }
    }
  }

  /** What the cluster has right now, read from the API */
  async function readBaseline(rancherApi: RancherApi): Promise<Baseline> {
    const nodes = await rancherApi.getRancherResource('v1', 'nodes');
    const deployments = await rancherApi.getRancherResource('v1', 'apps.deployments');
    const items = (deployments.body.data || []) as Array<{ metadata: { state: { name: string; error: boolean } } }>;

    return {
      nodes: (nodes.body.data || []).length,
      deployments: items.length,
      activeDeployments: items.filter((d) => d.metadata.state.name === 'active').length,
      errorDeployments: items.filter((d) => d.metadata.state.error).length,
    };
  }

  /** Same user the browser uses, so the filter is applied to the Cluster Dashboard the tests open */
  async function setNamespaceFilter(rancherApi: RancherApi, value: string | undefined) {
    await rancherApi.setUserPreference({ 'ns-by-cluster': value });
  }

  test.beforeAll(async ({ rancherApi }) => {
    suffix = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`;
    brokenNs = `e2e-7992-${suffix}`;
    healthyNs = `e2e-7992-${suffix}-ok`;

    const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

    originalNsFilter = prefs.body.data?.[0]?.data?.['ns-by-cluster'];
    await setNamespaceFilter(rancherApi, DEFAULT_NS_FILTER);

    await rancherApi.createNamespace(brokenNs);
    await rancherApi.createNamespace(healthyNs);
    await rancherApi.createRancherResource(
      'v1',
      'apps.deployments',
      deploymentBody(healthyNs, HEALTHY_DEPLOYMENT, IMAGE),
    );

    await expect
      .poll(
        async () =>
          (await rancherApi.getRancherResource('v1', 'apps.deployments', `${healthyNs}/${HEALTHY_DEPLOYMENT}`)).body
            .metadata?.state?.name,
        { message: 'healthy Deployment is active', timeout: EXTRA_LONG, intervals: [2_000] },
      )
      .toBe('active');
  });

  test.afterAll(async ({ rancherApi }) => {
    await cleanupStep('restore namespace filter', () => setNamespaceFilter(rancherApi, originalNsFilter));

    // Namespace termination takes a while; drop the Deployment first so it stops counting in the next run's baseline
    if (healthyNs) {
      await cleanupStep(`delete Deployment ${HEALTHY_DEPLOYMENT}`, () =>
        rancherApi.deleteRancherResource('v1', 'apps.deployments', `${healthyNs}/${HEALTHY_DEPLOYMENT}`, false),
      );
      await cleanupStep(`wait for Deployment ${HEALTHY_DEPLOYMENT} to be gone`, () =>
        rancherApi.waitForResourceGone('v1', 'apps.deployments', `${healthyNs}/${HEALTHY_DEPLOYMENT}`),
      );
    }

    for (const namespace of [brokenNs, healthyNs].filter(Boolean)) {
      await cleanupStep(`delete namespace ${namespace}`, () =>
        rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false),
      );
    }

    // Wait for the namespaces to be removed: a namespace disappearing while the next run loads the dashboard
    // changes the namespace filter and counts under it
    for (const namespace of [brokenNs, healthyNs].filter(Boolean)) {
      const gone = await cleanupStep(`wait for namespace ${namespace} to be gone`, () =>
        rancherApi.waitForResourceGone('v1', 'namespaces', namespace, NAMESPACE_GONE_RETRIES, NAMESPACE_GONE_DELAY),
      );

      if (gone === false) {
        console.warn(`[cluster-dashboard-status-cards cleanup] namespace ${namespace} still present`);
      }
    }
  });

  /**
   * Select one option of the namespace filter and wait for the preference PUT that persists it to settle.
   * Without that, the last PUT of a test can land after the test ends and leak its namespace into the next one.
   */
  async function selectNamespace(dashboard: ClusterDashboardPagePo, label: string) {
    const response = await dashboard.clusterActionsHeader().selectNamespaceFilterOption(label);

    expect(response.status()).toBe(200);
  }

  async function openClusterDashboard(
    dashboard: ClusterDashboardPagePo,
    welcome: WelcomeDialogPo,
  ): Promise<ClusterResourceStatusPo> {
    await dashboard.goTo();
    await dashboard.waitForPage();
    await welcome.dismissIfVisible();

    // Start from All Namespaces whatever a previous test persisted
    await selectNamespace(dashboard, ALL_NAMESPACES);
    await expect(dashboard.clusterActionsHeader().projectNamespaceFilter().noFilterIndicator()).toContainText(
      ALL_NAMESPACES,
    );

    const status = dashboard.resourceStatus();

    await expect(status.self()).toBeVisible(LONG_TIMEOUT_OPT);

    return status;
  }

  async function expectHealthyCards(status: ClusterResourceStatusPo, baseline: Baseline) {
    await expect(status.nodesCard().self()).toHaveAttribute('aria-label', `Nodes: ${baseline.nodes} total`);
    await expect(status.nodesCard().stateBadge('Active')).toHaveText(String(baseline.nodes));
    await expect(status.deploymentsCard().self()).toHaveAttribute(
      'aria-label',
      `Deployments: ${baseline.deployments} total`,
      LONG_TIMEOUT_OPT,
    );
    await expect(status.deploymentsCard().stateBadge('Active')).toHaveText(String(baseline.activeDeployments));
    await expect(status.unhealthyWorkloadsCard().emptyMessage()).toHaveText('No other unhealthy workloads');
    await expect(status.unhealthyWorkloadsCard().rows()).toHaveCount(0);
  }

  /** Deployments, Jobs and Pods with errors as created by createBrokenWorkloads, on top of the baseline */
  async function expectBrokenCards(status: ClusterResourceStatusPo, baseline: Baseline) {
    const deployments = status.deploymentsCard();
    const unhealthy = status.unhealthyWorkloadsCard();

    await expect(deployments.self()).toHaveAttribute(
      'aria-label',
      `Deployments: ${baseline.deployments + 1} total`,
      LONG_TIMEOUT_OPT,
    );
    await expect(deployments.stateBadge('Error')).toHaveText(String(baseline.errorDeployments + 1), LONG_TIMEOUT_OPT);
    await expect(deployments.stateBadge('Active')).toHaveText(String(baseline.activeDeployments));
    await expect(unhealthy.countLink('Jobs', 1, 'Error')).toBeVisible(LONG_TIMEOUT_OPT);
    await expect(unhealthy.countLink('Pods', 1, 'Error')).toBeVisible(LONG_TIMEOUT_OPT);
    await expect(unhealthy.rows()).toHaveCount(2);
    await expect(unhealthy.emptyMessage()).toHaveCount(0);
  }

  test.describe('administrator', () => {
    test.beforeEach(async ({ login }) => {
      await login();
    });

    test('S1: healthy cluster shows Nodes and Deployments cards, no unhealthy workloads and no Total Resources card', async ({
      page,
      rancherApi,
    }) => {
      const baseline = await readBaseline(rancherApi);
      const dashboard = new ClusterDashboardPagePo(page, CLUSTER_ID);
      const status = await openClusterDashboard(dashboard, new WelcomeDialogPo(page));

      await expect(status.nodesCard().self()).toBeVisible();
      await expect(status.deploymentsCard().self()).toBeVisible();
      await expect(status.unhealthyWorkloadsCard().self()).toBeVisible();
      await expect(status.unhealthyWorkloadsCard().self()).toHaveAttribute('aria-label', 'Other, Unhealthy Workloads');
      await expectHealthyCards(status, baseline);
      await expect(dashboard.totalResourcesCard()).toHaveCount(0);
    });

    test('S2a: broken workloads show up in the cards without a reload', async ({ page, rancherApi }) => {
      test.setTimeout(EXTRA_LONG);

      const baseline = await readBaseline(rancherApi);
      const status = await openClusterDashboard(
        new ClusterDashboardPagePo(page, CLUSTER_ID),
        new WelcomeDialogPo(page),
      );

      await expectHealthyCards(status, baseline);

      try {
        await createBrokenWorkloads(rancherApi);

        // No navigation here: the cards react to the live updates
        await expectBrokenCards(status, baseline);
        await expect(status.deploymentsCard().stateLink('Error')).toBeVisible();
      } finally {
        await removeBrokenWorkloads(rancherApi);
      }
    });

    test('S2b: card counts and the card itself link to the matching lists', async ({ page, rancherApi }) => {
      test.setTimeout(EXTRA_LONG);

      const baseline = await readBaseline(rancherApi);
      const dashboard = new ClusterDashboardPagePo(page, CLUSTER_ID);
      const welcome = new WelcomeDialogPo(page);
      const deploymentsList = new WorkloadsDeploymentsListPagePo(page, CLUSTER_ID);
      const jobsList = new WorkloadsJobsListPagePo(page, CLUSTER_ID);

      try {
        await createBrokenWorkloads(rancherApi);

        let status = await openClusterDashboard(dashboard, welcome);

        await expectBrokenCards(status, baseline);

        // The Error count opens the Deployments list filtered to Error
        await status.deploymentsCard().stateLink('Error').click();
        await deploymentsList.waitForPage('stateFilter=error');
        await expect(deploymentsList.listElementWithName(BAD_DEPLOYMENT)).toBeVisible(LONG_TIMEOUT_OPT);
        await expect(deploymentsList.listElementWithName(HEALTHY_DEPLOYMENT)).toHaveCount(0);

        // A click on the card body opens the full list
        status = await openClusterDashboard(dashboard, welcome);
        await expectBrokenCards(status, baseline);
        await status.deploymentsCard().clickTitle();
        await deploymentsList.waitForPageWithExactUrl();
        await expect(deploymentsList.listElementWithName(BAD_DEPLOYMENT)).toBeVisible(LONG_TIMEOUT_OPT);
        await expect(deploymentsList.listElementWithName(HEALTHY_DEPLOYMENT)).toBeVisible();

        // Tab to the card and Enter opens the full list as well
        status = await openClusterDashboard(dashboard, welcome);
        await expectBrokenCards(status, baseline);
        await status.nodesCard().focusStateLink('Active');
        await status.pressTab();
        await expect(status.deploymentsCard().self()).toBeFocused();
        await status.pressEnter();
        await deploymentsList.waitForPageWithExactUrl();
        await expect(deploymentsList.listElementWithName(BAD_DEPLOYMENT)).toBeVisible(LONG_TIMEOUT_OPT);

        // The Jobs count of the third card opens the Jobs list filtered to Error
        status = await openClusterDashboard(dashboard, welcome);
        await expectBrokenCards(status, baseline);
        await status.unhealthyWorkloadsCard().clickCount('Jobs', 1, 'Error');
        await jobsList.waitForPage('stateFilter=error');
        await expect(jobsList.baseResourceList().rowWithName(FAILING_JOB).self()).toBeVisible(LONG_TIMEOUT_OPT);
      } finally {
        await removeBrokenWorkloads(rancherApi);
      }
    });

    test('S3: the cards follow the namespace filter', async ({ page, rancherApi }) => {
      test.setTimeout(EXTRA_LONG);

      const baseline = await readBaseline(rancherApi);
      const dashboard = new ClusterDashboardPagePo(page, CLUSTER_ID);
      const nsFilter = dashboard.clusterActionsHeader().projectNamespaceFilter();

      try {
        await createBrokenWorkloads(rancherApi);

        const status = await openClusterDashboard(dashboard, new WelcomeDialogPo(page));

        await expectBrokenCards(status, baseline);

        // Only the healthy namespace: one active Deployment, nothing unhealthy, Nodes unchanged
        await selectNamespace(dashboard, healthyNs);
        await expect(status.deploymentsCard().self()).toHaveAttribute(
          'aria-label',
          'Deployments: 1 total',
          LONG_TIMEOUT_OPT,
        );
        await expect(status.deploymentsCard().stateBadge('Active')).toHaveText('1');
        await expect(status.deploymentsCard().stateRow('Error')).toHaveCount(0);
        await expect(status.unhealthyWorkloadsCard().emptyMessage()).toHaveText('No other unhealthy workloads');
        await expect(status.nodesCard().self()).toHaveAttribute('aria-label', `Nodes: ${baseline.nodes} total`);
        await expect(status.nodesCard().stateBadge('Active')).toHaveText(String(baseline.nodes));

        // Only the broken namespace: the unhealthy Deployment, Job and Pod
        await selectNamespace(dashboard, ALL_NAMESPACES);
        await selectNamespace(dashboard, brokenNs);
        await expect(status.deploymentsCard().self()).toHaveAttribute(
          'aria-label',
          'Deployments: 1 total',
          LONG_TIMEOUT_OPT,
        );
        await expect(status.deploymentsCard().stateBadge('Error')).toHaveText('1');
        await expect(status.deploymentsCard().stateRow('Active')).toHaveCount(0);
        await expect(status.unhealthyWorkloadsCard().countLink('Jobs', 1, 'Error')).toBeVisible(LONG_TIMEOUT_OPT);
        await expect(status.unhealthyWorkloadsCard().countLink('Pods', 1, 'Error')).toBeVisible();
        await expect(status.nodesCard().self()).toHaveAttribute('aria-label', `Nodes: ${baseline.nodes} total`);

        // Back to all namespaces: the baseline plus the broken Deployment
        await selectNamespace(dashboard, ALL_NAMESPACES);
        await expect(nsFilter.noFilterIndicator()).toContainText(ALL_NAMESPACES);
        await expectBrokenCards(status, baseline);
      } finally {
        await removeBrokenWorkloads(rancherApi);
      }
    });

    test('S4: the cards return to healthy without a reload once the broken workloads are deleted', async ({
      page,
      rancherApi,
    }) => {
      test.setTimeout(EXTRA_LONG);

      const baseline = await readBaseline(rancherApi);
      const status = await openClusterDashboard(
        new ClusterDashboardPagePo(page, CLUSTER_ID),
        new WelcomeDialogPo(page),
      );

      try {
        await createBrokenWorkloads(rancherApi);
        await expectBrokenCards(status, baseline);

        await removeBrokenWorkloads(rancherApi);

        await expectHealthyCards(status, baseline);
        await expect(status.unhealthyWorkloadsCard().rows()).toHaveCount(0);
      } finally {
        await removeBrokenWorkloads(rancherApi);
      }
    });
  });

  test.describe('restricted user', () => {
    // Start unauthenticated: the test logs in itself as the restricted user, in a fresh context
    test.use({ storageState: { cookies: [], origins: [] } });

    const username = () => `e2e-7992-user-${suffix}`;
    const password = () => `E2e-Pass-${suffix}-Zz9!`;
    let userId = '';

    /** New users get default global roles asynchronously, so reconcile until only user-base is bound and stays so */
    async function setGlobalRoles(rancherApi: RancherApi, wanted: string[]) {
      const REQUIRED_STABLE_POLLS = 3;
      const sortedWanted = [...wanted].sort();
      let stablePolls = 0;

      const listBindings = async () => {
        const resp = await rancherApi.getRancherResource('v3', `globalrolebindings?userId=${userId}&limit=1000`);

        return (resp.body?.data || []) as Array<{ id: string; globalRoleId: string }>;
      };

      await expect
        .poll(
          async () => {
            const bindings = await listBindings();

            for (const binding of bindings.filter((b) => !wanted.includes(b.globalRoleId))) {
              await rancherApi.deleteRancherResource('v3', 'globalrolebindings', binding.id, false);
            }

            const have = bindings.map((b) => b.globalRoleId);

            for (const role of wanted.filter((r) => !have.includes(r))) {
              await rancherApi.createRancherResource('v3', 'globalrolebindings', {
                type: 'globalRoleBinding',
                globalRoleId: role,
                userId,
              });
            }

            const current = (await listBindings()).map((b) => b.globalRoleId).sort();

            stablePolls = JSON.stringify(current) === JSON.stringify(sortedWanted) ? stablePolls + 1 : 0;

            return stablePolls >= REQUIRED_STABLE_POLLS ? current : [`unstable after ${stablePolls} equal polls`];
          },
          { timeout: 60_000, intervals: [1_000] },
        )
        .toEqual(sortedWanted);
    }

    test.beforeAll(async ({ rancherApi }) => {
      const resp = await rancherApi.createRancherResource('v3', 'users', {
        type: 'user',
        username: username(),
        name: `E2E 7992 ${suffix}`,
        password: password(),
        mustChangePassword: false,
        enabled: true,
      });

      userId = resp.body.id;

      await setGlobalRoles(rancherApi, ['user-base']);
      await rancherApi.createRancherResource('v3', 'clusterroletemplatebindings', {
        clusterId: CLUSTER_ID,
        userId,
        roleTemplateId: 'cluster-member',
      });
    });

    test.afterAll(async ({ rancherApi }) => {
      // Idempotent and safe after a partial beforeAll: finds the user by name when the id was not recorded.
      // Lookups pass status 0 so a non-200 is not an assertion failure.
      if (!userId) {
        const found = await cleanupStep('find user by name', () =>
          rancherApi.getRancherResource('v3', `users?username=${username()}`, undefined, 0),
        );

        userId = found?.body?.data?.[0]?.id || '';
      }

      if (!userId) {
        return;
      }

      const bindings = await cleanupStep('list cluster bindings', () =>
        rancherApi.getRancherResource('v3', `clusterroletemplatebindings?userId=${userId}&limit=1000`, undefined, 0),
      );

      for (const binding of bindings?.body?.data || []) {
        await cleanupStep(`delete cluster binding ${binding.id}`, () =>
          rancherApi.deleteRancherResource('v3', 'clusterroletemplatebindings', binding.id, false),
        );
      }

      await cleanupStep(`delete user ${username()}`, () =>
        rancherApi.deleteRancherResource('v3', 'users', userId, false),
      );
    });

    // Revoke the session token of the restricted user, even when the test failed
    test.afterEach(async ({ page }) => {
      const loginPage = new LoginPagePo(page);

      await cleanupStep('logout', async () => {
        await loginPage.logout();
        await expect(loginPage.submitButton().self()).toBeVisible(LONG_TIMEOUT_OPT);
      });
    });

    test('S5: a cluster member without workload access sees the Nodes card and no Deployments card', async ({
      page,
      login,
    }) => {
      await login({ username: username(), password: password() });

      const status = await openClusterDashboard(
        new ClusterDashboardPagePo(page, CLUSTER_ID),
        new WelcomeDialogPo(page),
      );

      await expect(status.nodesCard().self()).toBeVisible(LONG_TIMEOUT_OPT);
      await expect(status.nodesCard().stateBadge('Active')).toBeVisible();
      await expect(status.unhealthyWorkloadsCard().self()).toBeVisible();
      await expect(status.deploymentsCard().self()).toHaveCount(0);
    });
  });
});
