import { test, expect } from '@/support/fixtures';
import type { Page, Route } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import ClusterManagerDetailRke2AmazonEc2PagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-rke2-amazon.po';
import ClusterManagerEditGenericPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/edit/cluster-edit-generic.po';
import { installFakeClusterRoutes } from '@/e2e/blueprints/nav/fake-cluster';
import { generateProvClusterObj, MACHINE_POOL_ID } from '@/e2e/blueprints/nav/fake-cluster-objects';
import { generateFakeMachineConfigReply } from '@/e2e/blueprints/nav/edit-cluster';

const EVIDENCE_DIR = process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-15656-cluster-autoscaler-follow-on-work-evidence';

const NAMESPACE = 'fleet-default';
const PROV_CLUSTER_ID = 'mock-autoscaler-cluster';
const MGMT_CLUSTER_ID = 'c-m-mockasc';

const AUTOSCALING_POOL = 'pool-worker';
const PAUSED_POOL = 'pool-paused';

const FEATURE_ID = 'cluster-autoscaling';
const PAUSED_MIN_ANNOTATION = 'ui.rancher/autoscaler-paused-min-size';
const PAUSED_MAX_ANNOTATION = 'ui.rancher/autoscaler-paused-max-size';

/** Name of the Rancher-generated machine config that backs a pool (also the MachineDeployment infrastructureRef) */
const machineConfigName = (poolName: string) => `nc-${ PROV_CLUSTER_ID }-${ poolName }-${ MACHINE_POOL_ID }`;

/** Name of the CAPI MachineDeployment that Rancher creates for a pool */
const machineDeploymentName = (poolName: string) => `${ PROV_CLUSTER_ID }-${ poolName }`;

/**
 * provisioning.cattle.io.cluster with two worker pools:
 * - pool-worker: autoscaling (live min/max bounds)
 * - pool-paused: autoscaler paused (bounds stashed in machineDeploymentAnnotations, quantity set manually)
 */
function mockAutoscalerProvCluster() {
  const cluster = generateProvClusterObj(PROV_CLUSTER_ID, MGMT_CLUSTER_ID);
  const { dynamicSchemaSpec } = cluster.spec.rkeConfig.machinePools[0];

  const basePool = {
    dynamicSchemaSpec,
    drainBeforeDelete:    true,
    unhealthyNodeTimeout: '0s',
    workerRole:           true,
  };

  cluster.spec.rkeConfig.machinePools = [
    {
      ...basePool,
      machineConfigRef:   { kind: 'DigitaloceanConfig', name: machineConfigName(AUTOSCALING_POOL) },
      name:               AUTOSCALING_POOL,
      quantity:           2,
      autoscalingMinSize: 1,
      autoscalingMaxSize: 4,
    },
    {
      ...basePool,
      machineConfigRef:             { kind: 'DigitaloceanConfig', name: machineConfigName(PAUSED_POOL) },
      name:                         PAUSED_POOL,
      quantity:                     3,
      machineDeploymentAnnotations: {
        [PAUSED_MIN_ANNOTATION]: '2',
        [PAUSED_MAX_ANNOTATION]: '5',
      },
    },
  ] as any;

  return cluster;
}

/** The pools' CAPI MachineDeployments: the detail page groups machines by these and scales through them */
function mockMachineDeployment(poolName: string, replicas: number) {
  const name = machineDeploymentName(poolName);
  const selfLink = `https://localhost:8005/v1/cluster.x-k8s.io.machinedeployments/${ NAMESPACE }/${ name }`;

  return {
    id:         `${ NAMESPACE }/${ name }`,
    type:       'cluster.x-k8s.io.machinedeployment',
    links:      {
      remove: selfLink,
      self:   selfLink,
      update: selfLink,
      view:   `https://localhost:8005/apis/cluster.x-k8s.io/v1beta1/namespaces/${ NAMESPACE }/machinedeployments/${ name }`,
    },
    apiVersion: 'cluster.x-k8s.io/v1beta1',
    kind:       'MachineDeployment',
    metadata:   {
      creationTimestamp: '2026-10-01T10:00:00Z',
      fields:            [name, PROV_CLUSTER_ID, 'Running', `${ replicas }`],
      generation:        1,
      labels:            {
        'cluster.x-k8s.io/cluster-name':           PROV_CLUSTER_ID,
        'rke.cattle.io/rke-machine-pool-name':     poolName,
      },
      name,
      namespace:       NAMESPACE,
      state:           {
        error: false, message: 'Resource is Ready', name: 'active', transitioning: false
      },
      uid: `00000000-0000-4000-8000-${ poolName === AUTOSCALING_POOL ? '000000000001' : '000000000002' }`,
    },
    spec: {
      clusterName: PROV_CLUSTER_ID,
      replicas,
      selector:    { matchLabels: { 'cluster.x-k8s.io/deployment-name': name } },
      template:    {
        metadata: {
          labels: {
            'cluster.x-k8s.io/cluster-name':       PROV_CLUSTER_ID,
            'cluster.x-k8s.io/deployment-name':    name,
            'rke.cattle.io/rke-machine-pool-name': poolName,
            'rke.cattle.io/worker-role':           'true',
          }
        },
        spec: {
          bootstrap:         { dataSecretName: '' },
          clusterName:       PROV_CLUSTER_ID,
          infrastructureRef: {
            apiVersion: 'rke-machine.cattle.io/v1',
            kind:       'DigitaloceanMachineTemplate',
            name:       machineConfigName(poolName),
            namespace:  NAMESPACE,
          },
          version: 'v1.27.10+rke2r1',
        },
      },
    },
    status: {
      availableReplicas: replicas,
      conditions:        [{
        lastUpdateTime: '2026-10-01T10:05:00Z', status: 'True', type: 'Available'
      }],
      phase:             'Running',
      readyReplicas:     replicas,
      replicas,
      upToDateReplicas:  replicas,
    },
  };
}

function mockMachine(poolName: string, index: number) {
  const deploymentName = machineDeploymentName(poolName);
  const name = `${ deploymentName }-abcde-m${ index }`;
  const selfLink = `https://localhost:8005/v1/cluster.x-k8s.io.machines/${ NAMESPACE }/${ name }`;

  return {
    id:         `${ NAMESPACE }/${ name }`,
    type:       'cluster.x-k8s.io.machine',
    links:      {
      remove: selfLink,
      self:   selfLink,
      update: selfLink,
      view:   `https://localhost:8005/apis/cluster.x-k8s.io/v1beta1/namespaces/${ NAMESPACE }/machines/${ name }`,
    },
    apiVersion: 'cluster.x-k8s.io/v1beta1',
    kind:       'Machine',
    metadata:   {
      creationTimestamp: '2026-10-01T10:01:00Z',
      fields:            [name, PROV_CLUSTER_ID, 'Running'],
      generation:        1,
      labels:            {
        'cattle.io/os':                        'linux',
        'cluster.x-k8s.io/cluster-name':       PROV_CLUSTER_ID,
        'cluster.x-k8s.io/deployment-name':    deploymentName,
        'rke.cattle.io/rke-machine-pool-name': poolName,
        'rke.cattle.io/worker-role':           'true',
      },
      name,
      namespace:       NAMESPACE,
      state:           {
        error: false, message: 'Resource is Ready', name: 'running', transitioning: false
      },
      uid: `00000000-0000-4000-8000-${ poolName === AUTOSCALING_POOL ? '1' : '2' }0000000000${ index }`,
    },
    spec: {
      clusterName:       PROV_CLUSTER_ID,
      infrastructureRef: {
        apiGroup:  'rke-machine.cattle.io',
        kind:      'DigitaloceanMachine',
        name:      machineConfigName(poolName),
        namespace: NAMESPACE,
      },
    },
    status: {
      addresses:  [{ address: `10.0.${ index }.${ poolName === AUTOSCALING_POOL ? 10 : 20 }`, type: 'InternalIP' }],
      conditions: [{
        lastUpdateTime: '2026-10-01T10:05:00Z', status: 'True', type: 'Ready'
      }],
      phase: 'Running',
    },
  };
}

/** DigitaloceanConfig the edit page loads for a pool, derived from the shared pool1 fixture */
function mockMachineConfig(poolName: string) {
  const json = JSON.stringify(generateFakeMachineConfigReply(PROV_CLUSTER_ID, MACHINE_POOL_ID))
    .split(machineConfigName('pool1'))
    .join(machineConfigName(poolName));

  return JSON.parse(json);
}

/** Add `items` to a Steve collection response, falling back to an empty collection if the server has no such type */
async function injectIntoCollection(route: Route, items: any[]) {
  let body: any = { type: 'collection', data: [] };

  try {
    const response = await route.fetch();

    if (response.ok()) {
      body = await response.json();
    }
  } catch {
    // no such type on this server: serve only the injected items
  }

  // Keep the server's collection resourceVersion (body is the original response) so the watch/subscribe stays consistent
  const { resourceVersion } = body;

  body.data = [...(Array.isArray(body.data) ? body.data : []), ...items];

  if (resourceVersion !== undefined) {
    body.resourceVersion = resourceVersion;
  }

  if (typeof body.count === 'number') {
    body.count = body.data.length;
  }

  await route.fulfill({ status: 200, json: body });
}

async function installAutoscalerMocks(page: Page) {
  const provCluster = mockAutoscalerProvCluster();

  // Prov/mgmt cluster list+detail, node driver, cloud credential and DO lookups for the edit page
  await installFakeClusterRoutes(page, {
    fakeProvClusterId:           PROV_CLUSTER_ID,
    fakeMgmtClusterId:           MGMT_CLUSTER_ID,
    addEditClusterCapabilities:  true,
  });

  // Routes registered later win: replace the shared single-pool prov cluster with the two autoscaler pools
  await page.route(/\/v1\/provisioning\.cattle\.io\.clusters(\?|$)/, async(route) => {
    await injectIntoCollection(route, [provCluster]);
  });

  await page.route(new RegExp(`/v1/provisioning\\.cattle\\.io\\.clusters/${ NAMESPACE }/${ PROV_CLUSTER_ID }(\\?|$)`), async(route) => {
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }

    await route.fulfill({ status: 200, json: provCluster });
  });

  // The cluster autoscaler UI is behind the `cluster-autoscaling` feature flag
  await page.route(/\/v1\/management\.cattle\.io\.features(\?|$)/, async(route) => {
    const response = await route.fetch();
    const body = await response.json();
    const feature = body.data?.find((f: any) => f.id === FEATURE_ID);

    if (feature) {
      feature.spec = { ...feature.spec, value: true };
      feature.status = { ...feature.status, lockedValue: true };
    } else {
      body.data.push({
        id:       FEATURE_ID,
        type:     'management.cattle.io.feature',
        metadata: { name: FEATURE_ID },
        spec:     { value: true },
        status:   {
          default: false, dynamic: true, lockedValue: true, description: 'Cluster autoscaler'
        },
      });
    }

    await route.fulfill({ response, json: body });
  });

  await page.route(/\/v1\/cluster\.x-k8s\.io\.machinedeployments(\?|$)/, async(route) => {
    await injectIntoCollection(route, [
      mockMachineDeployment(AUTOSCALING_POOL, 2),
      mockMachineDeployment(PAUSED_POOL, 3),
    ]);
  });

  await page.route(/\/v1\/cluster\.x-k8s\.io\.machines(\?|$)/, async(route) => {
    await injectIntoCollection(route, [
      mockMachine(AUTOSCALING_POOL, 0),
      mockMachine(AUTOSCALING_POOL, 1),
      mockMachine(PAUSED_POOL, 0),
      mockMachine(PAUSED_POOL, 1),
      mockMachine(PAUSED_POOL, 2),
    ]);
  });

  // Machine configs the edit page resolves through each pool's machineConfigRef
  await page.route(new RegExp(`/v1/rke-machine-config\\.cattle\\.io\\.digitaloceanconfigs/${ NAMESPACE }/nc-${ PROV_CLUSTER_ID }-pool-(worker|paused)-${ MACHINE_POOL_ID }(\\?|$)`), async(route) => {
    const poolName = route.request().url().includes(machineConfigName(AUTOSCALING_POOL)) ? AUTOSCALING_POOL : PAUSED_POOL;

    await route.fulfill({ status: 200, json: mockMachineConfig(poolName) });
  });
}

async function dismissWelcomeModal(page: Page): Promise<void> {
  // eslint-disable-next-line playwright/no-raw-locators -- modal container has no role/testid
  const closeBtn = page.locator('#modals').getByRole('button', { name: /Close/i });

  try {
    await closeBtn.waitFor({ state: 'visible', timeout: 4000 });
    await closeBtn.click();
    // eslint-disable-next-line playwright/no-raw-locators -- overlay has no role/testid
    await page.locator('.rc-modal-overlay').waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    // Modal did not appear within timeout
  }
}

test.describe('Cluster Autoscaler - per machine pool pause (#15656)', { tag: ['@manager', '@adminUser'] }, () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.beforeEach(async({ page, login }) => {
    await installAutoscalerMocks(page);
    await login();
  });

  test.afterEach(async({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('Scenario 1 and 2: cluster detail shows the pause/resume toggle and the scale rocker state per pool', async({ page }) => {
    const detail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', PROV_CLUSTER_ID);

    await detail.goTo();
    await detail.waitForPage();
    await dismissWelcomeModal(page);

    // eslint-disable-next-line playwright/no-raw-locators -- group rows have no role/testid; text is "Pool: <cluster>-<pool>"
    const groupRow = (poolName: string) => page.locator('tr.group-row').filter({ hasText: poolName });
    const toggle = (poolName: string) => groupRow(poolName).getByTestId('autoscaler-toggle-button');
    const scaleUp = (poolName: string) => groupRow(poolName).getByTestId('scale-up-button');
    const scaleDown = (poolName: string) => groupRow(poolName).getByTestId('scale-down-button');

    await page.getByTestId('btn-machine-pools').click();
    await expect(groupRow(AUTOSCALING_POOL)).toBeVisible({ timeout: 15000 });
    await expect(groupRow(PAUSED_POOL)).toBeVisible();

    // Autoscaling pool: pause icon, rocker locked because the autoscaler owns the machine count
    // eslint-disable-next-line playwright/no-raw-locators -- the toggle state is only exposed through the icon class on its <i>
    await expect(toggle(AUTOSCALING_POOL).locator('.icon-pause')).toBeVisible();
    // eslint-disable-next-line playwright/no-raw-locators -- the toggle state is only exposed through the icon class on its <i>
    await expect(toggle(AUTOSCALING_POOL).locator('.icon-play')).toHaveCount(0);
    await expect(toggle(AUTOSCALING_POOL)).toHaveAttribute('aria-label', 'Pause Autoscaler');
    await expect(scaleDown(AUTOSCALING_POOL)).toBeDisabled();
    await expect(scaleUp(AUTOSCALING_POOL)).toBeDisabled();

    await groupRow(AUTOSCALING_POOL).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-pool-autoscaler-pause-toggle.png'), fullPage: false });

    // Paused pool: play icon, rocker usable again for manual scaling
    // eslint-disable-next-line playwright/no-raw-locators -- the toggle state is only exposed through the icon class on its <i>
    await expect(toggle(PAUSED_POOL).locator('.icon-play')).toBeVisible();
    // eslint-disable-next-line playwright/no-raw-locators -- the toggle state is only exposed through the icon class on its <i>
    await expect(toggle(PAUSED_POOL).locator('.icon-pause')).toHaveCount(0);
    await expect(toggle(PAUSED_POOL)).toHaveAttribute('aria-label', 'Resume Autoscaler');
    await expect(scaleDown(PAUSED_POOL)).toBeEnabled();
    await expect(scaleUp(PAUSED_POOL)).toBeEnabled();

    await groupRow(PAUSED_POOL).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-02-paused-pool-scale-rocker-enabled.png'), fullPage: false });
  });

  test('Scenario 4: cluster edit shows the paused banner and read-only stashed bounds on the paused pool', async({ page }) => {
    const edit = new ClusterManagerEditGenericPagePo(page, 'local', PROV_CLUSTER_ID);

    await edit.goTo('mode=edit');
    await edit.waitForPage('mode=edit');
    await dismissWelcomeModal(page);

    // Machine Pools section lists each pool as a side tab
    const pausedPoolTab = page.getByRole('tab', { name: PAUSED_POOL });

    await expect(pausedPoolTab).toBeVisible({ timeout: 15000 });
    await pausedPoolTab.click();

    // Expand the Advanced section to reveal autoscaler settings
    // eslint-disable-next-line playwright/no-raw-locators -- scope to the visible tab panel (inactive panels are display: none)
    const activePanel = page.locator('.tab-panel:not([style*="display: none"])');
    const showAdvanced = activePanel.getByText('Show Advanced');

    await showAdvanced.scrollIntoViewIfNeeded();
    await showAdvanced.click();

    const banner = activePanel.getByTestId('autoscaler-paused-banner');
    const pausedMin = activePanel.getByTestId('autoscaler-paused-min');
    const pausedMax = activePanel.getByTestId('autoscaler-paused-max');

    await expect(banner).toBeVisible();
    await expect(pausedMin).toHaveValue('2');
    await expect(pausedMin).toBeDisabled();
    await expect(pausedMax).toHaveValue('5');
    await expect(pausedMax).toBeDisabled();

    await pausedMax.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-04-edit-cluster-paused-pool-banner.png'), fullPage: false });

    // The autoscaling pool must not show the paused banner
    await page.getByRole('tab', { name: AUTOSCALING_POOL }).click();
    await expect(banner).toHaveCount(0);
  });
});
