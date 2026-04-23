import type { Page } from '@playwright/test';
import {
  generateFakeNodeSchema,
  generateFakeCountSchema,
  generateFakeNamespaceSchema,
  generateFakeDaemonsetSchema,
  generateFakePodSchema,
} from './k8s-schemas';

/**
 * Sets up route intercepts for a fake cluster in the navigation menu.
 * Playwright equivalent of the Cypress generateFakeClusterDataAndIntercepts.
 *
 * Must be called BEFORE navigating to the page that triggers these requests.
 */
export async function generateFakeClusterDataAndIntercepts(
  page: Page,
  {
    fakeProvClusterId = 'some-prov-cluster-id',
    fakeMgmtClusterId = 'some-mgmt-cluster-id',
    longClusterDescription = 'this-is-some-really-really-really-really-really-really-long-description',
  }: {
    fakeProvClusterId?: string;
    fakeMgmtClusterId?: string;
    longClusterDescription?: string;
  },
): Promise<void> {
  // Intercept fleet clusters - add description to local and inject fake cluster
  await page.route('**/v1/fleet.cattle.io.clusters?*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const localIndex = body.data?.findIndex((item: any) => item.id?.includes('/local'));

    if (localIndex >= 0) {
      body.data[localIndex].metadata = body.data[localIndex].metadata || {};
      body.data[localIndex].metadata.annotations = body.data[localIndex].metadata.annotations || {};
      body.data[localIndex].metadata.annotations['field.cattle.io/description'] = longClusterDescription;
    }

    body.data.push({
      id: `fleet-default/${fakeProvClusterId}`,
      type: 'fleet.cattle.io.cluster',
      metadata: {
        name: fakeProvClusterId,
        namespace: 'fleet-default',
      },
      status: { display: { readyClusters: 1, state: 'Ready' } },
    });

    await route.fulfill({ response, json: body });
  });

  // Intercept provisioning clusters - add description to local and inject fake cluster
  await page.route('**/v1/provisioning.cattle.io.clusters?*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const localIndex = body.data?.findIndex((item: any) => item.id?.includes('/local'));

    if (localIndex >= 0) {
      body.data[localIndex].metadata = body.data[localIndex].metadata || {};
      body.data[localIndex].metadata.annotations = body.data[localIndex].metadata.annotations || {};
      body.data[localIndex].metadata.annotations['field.cattle.io/description'] = longClusterDescription;
    }

    body.data.push({
      id: `fleet-default/${fakeProvClusterId}`,
      type: 'provisioning.cattle.io.cluster',
      metadata: {
        name: fakeProvClusterId,
        namespace: 'fleet-default',
        annotations: {},
      },
      spec: { rkeConfig: {} },
      status: {
        agentDeployed: true,
        clusterName: fakeMgmtClusterId,
        clientSecretName: `${fakeProvClusterId}-kubeconfig`,
        conditions: [{ type: 'Ready', status: 'True' }],
        ready: true,
      },
    });

    await route.fulfill({ response, json: body });
  });

  // Intercept management clusters - add description to local and inject fake cluster
  await page.route('**/v1/management.cattle.io.clusters?*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const localIndex = body.data?.findIndex((item: any) => item.id?.includes('local'));

    if (localIndex >= 0) {
      body.data[localIndex].spec = body.data[localIndex].spec || {};
      body.data[localIndex].spec.description = longClusterDescription;
    }

    body.data.push({
      id: fakeMgmtClusterId,
      type: 'management.cattle.io.cluster',
      metadata: {
        name: fakeMgmtClusterId,
        state: { name: 'active', error: false, transitioning: false },
      },
      spec: {
        displayName: fakeProvClusterId,
        description: '',
        desiredAgentImage: '',
        internal: false,
      },
      status: {
        conditions: [{ type: 'Ready', status: 'True' }],
        driver: 'rke2',
        provider: 'rke2',
        nodeCount: 1,
      },
    });

    await route.fulfill({ response, json: body });
  });

  // Intercept counts for fake cluster — minimal data so side-nav renders entries
  await page.route(`**/k8s/clusters/${fakeMgmtClusterId}/v1/counts?*`, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        data: [
          {
            id: 'count',
            type: 'count',
            counts: {
              namespace: { summary: { count: 10 } },
              node: { summary: { count: 1 } },
              pod: { summary: { count: 5 } },
              'apps.daemonset': { summary: { count: 2 } },
              'apps.deployment': { summary: { count: 3 } },
              'management.cattle.io.setting': { summary: { count: 10 } },
            },
          },
        ],
      },
    });
  });

  // Intercept namespaces for fake cluster — minimal data
  await page.route(`**/k8s/clusters/${fakeMgmtClusterId}/v1/namespaces?*`, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        data: [
          {
            id: 'default',
            type: 'namespace',
            metadata: {
              name: 'default',
              state: { name: 'active', error: false, transitioning: false },
              resourceVersion: '1',
            },
            status: { phase: 'Active' },
          },
        ],
      },
    });
  });

  // Intercept schemas for fake cluster — real schema data so cluster explorer loads
  await page.route(`**/k8s/clusters/${fakeMgmtClusterId}/v1/schemas?*`, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        data: [
          generateFakeNodeSchema(fakeMgmtClusterId),
          generateFakeCountSchema(fakeMgmtClusterId),
          generateFakeNamespaceSchema(fakeMgmtClusterId),
          generateFakeDaemonsetSchema(fakeMgmtClusterId),
          generateFakePodSchema(fakeMgmtClusterId),
        ],
      },
    });
  });

  // Intercept pods for fake cluster
  await page.route(`**/k8s/clusters/${fakeMgmtClusterId}/v1/pods?*`, async (route) => {
    await route.fulfill({
      status: 200,
      json: { data: [] },
    });
  });

  // Intercept nodes for fake cluster
  await page.route(`**/k8s/clusters/${fakeMgmtClusterId}/v1/nodes?*`, async (route) => {
    await route.fulfill({
      status: 200,
      json: { data: [] },
    });
  });

  // Intercept daemonsets for fake cluster
  await page.route(`**/k8s/clusters/${fakeMgmtClusterId}/v1/apps.daemonsets?*`, async (route) => {
    await route.fulfill({
      status: 200,
      json: { data: [] },
    });
  });
}
