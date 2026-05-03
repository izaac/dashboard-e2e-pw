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
  await page.route(/\/v1\/fleet\.cattle\.io\.clusters(\?|$)/, async (route) => {
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

    if (typeof body.count === 'number') {
      body.count = body.data.length;
    }

    await route.fulfill({ response, json: body });
  });

  // Intercept provisioning clusters - add description to local and inject fake cluster.
  // Match both the bare URL and any querystring variant so the cluster-list page's
  // initial fetch is always intercepted.
  await page.route(/\/v1\/provisioning\.cattle\.io\.clusters(\?|$)/, async (route) => {
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
      apiVersion: 'provisioning.cattle.io/v1',
      kind: 'Cluster',
      links: {
        remove: `https://localhost:8443/v1/provisioning.cattle.io.clusters/fleet-default/${fakeProvClusterId}`,
        self: `https://localhost:8443/v1/provisioning.cattle.io.clusters/fleet-default/${fakeProvClusterId}`,
        update: `https://localhost:8443/v1/provisioning.cattle.io.clusters/fleet-default/${fakeProvClusterId}`,
        view: `https://localhost:8443/apis/provisioning.cattle.io/v1/namespaces/fleet-default/clusters/${fakeProvClusterId}`,
      },
      metadata: {
        annotations: { 'field.cattle.io/creatorId': 'user-fake' },
        creationTimestamp: '2024-03-07T15:45:25Z',
        // Steve table renderer reads column values from `metadata.fields`. Without
        // these the row is hidden in the cluster list even if all data is present.
        fields: [fakeProvClusterId, 'true', `${fakeProvClusterId}-kubeconfig`],
        finalizers: ['wrangler.cattle.io/provisioning-cluster-remove'],
        generation: 3,
        name: fakeProvClusterId,
        namespace: 'fleet-default',
        resourceVersion: '1',
        // The State column gates visibility — must be `active` to render as a healthy row.
        state: { error: false, message: 'Resource is Ready', name: 'active', transitioning: false },
        uid: '326aa188-e66f-4cf0-8f54-9fc47e4c5d92',
      },
      spec: {
        kubernetesVersion: 'v1.27.10+rke2r1',
        localClusterAuthEndpoint: {},
        rkeConfig: {
          // Required by the Registry edit test (closeArrayListItem(0) → reg2 retains).
          registries: {
            configs: {
              reg1: { authConfigSecretName: 'registryconfig-auth-reg1' },
              reg2: { authConfigSecretName: 'registryconfig-auth-reg2' },
            },
          },
        },
      },
      status: {
        agentDeployed: true,
        clientSecretName: `${fakeProvClusterId}-kubeconfig`,
        clusterName: fakeMgmtClusterId,
        conditions: [
          { type: 'Ready', status: 'True', error: false, transitioning: false },
          { type: 'Provisioned', status: 'True', error: false, transitioning: false },
          { type: 'Updated', status: 'True', error: false, transitioning: false },
        ],
        fleetWorkspaceName: 'fleet-default',
        observedGeneration: 3,
        ready: true,
      },
    });

    if (typeof body.count === 'number') {
      body.count = body.data.length;
    }

    await route.fulfill({ response, json: body });
  });

  // Intercept management clusters - add description to local and inject fake cluster
  await page.route(/\/v1\/management\.cattle\.io\.clusters(\?|$)/, async (route) => {
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
      apiVersion: 'management.cattle.io/v3',
      kind: 'Cluster',
      // The cluster-list table reads `links.shell` to decide whether the row's
      // shell action is available. Missing it threw a `Cannot read properties of
      // undefined (reading 'shell')` from the bulkActionsForSelection getter
      // and the row never rendered.
      links: {
        log: `https://localhost:8443/v1/management.cattle.io.clusters/${fakeMgmtClusterId}?link=log`,
        projects: `https://localhost:8443/v1/management.cattle.io.clusters/${fakeMgmtClusterId}?link=projects`,
        remove: 'blocked',
        schemas: `https://localhost:8443/v1/management.cattle.io.clusters/${fakeMgmtClusterId}?link=schemas`,
        self: `https://localhost:8443/v1/management.cattle.io.clusters/${fakeMgmtClusterId}`,
        shell: `wss://localhost:8443/v3/clusters/${fakeMgmtClusterId}?shell=true`,
        subscribe: `https://localhost:8443/v1/management.cattle.io.clusters/${fakeMgmtClusterId}?link=subscribe`,
        update: 'blocked',
        view: `https://localhost:8443/v1/management.cattle.io.clusters/${fakeMgmtClusterId}`,
      },
      actions: {
        apply: `https://localhost:8443/v1/management.cattle.io.clusters/${fakeMgmtClusterId}?action=apply`,
        generateKubeconfig: `https://localhost:8443/v3/clusters/${fakeMgmtClusterId}?action=generateKubeconfig`,
        importYaml: `https://localhost:8443/v3/clusters/${fakeMgmtClusterId}?action=importYaml`,
      },
      metadata: {
        annotations: {
          'provisioning.cattle.io/administrated': 'true',
          'objectset.rio.cattle.io/owner-name': fakeProvClusterId,
          'objectset.rio.cattle.io/owner-namespace': 'fleet-default',
        },
        creationTimestamp: '2024-03-07T15:45:25Z',
        fields: [fakeMgmtClusterId, '19h'],
        labels: { 'provider.cattle.io': 'rke2' },
        name: fakeMgmtClusterId,
        resourceVersion: '1',
        state: { error: false, message: 'Resource is Ready', name: 'active', transitioning: false },
        uid: '5887e0fe-d20a-42cc-812e-cbc2213201fe',
      },
      spec: {
        displayName: fakeProvClusterId,
        description: '',
        desiredAgentImage: '',
        fleetWorkspaceName: 'fleet-default',
        internal: false,
        localClusterAuthEndpoint: { enabled: false },
      },
      status: {
        conditions: [
          { type: 'Ready', status: 'True', error: false, transitioning: false },
          { type: 'Connected', status: 'True', error: false, transitioning: false },
        ],
        // `driver: 'imported'` is what cypress' mock uses — combined with `provider: 'rke2'` it
        // routes the cluster edit to rke2.vue (which renders the documentation banner). Without
        // this the generic edit component loads and the doc banner is absent.
        driver: 'imported',
        provider: 'rke2',
        nodeCount: 1,
      },
    });

    if (typeof body.count === 'number') {
      body.count = body.data.length;
    }

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

  // Registry auth secrets — required by the fake cluster's `spec.rkeConfig.registries.configs`.
  // The cluster-edit Registry tab joins the registry config to the secret to render the
  // "(HTTP Basic Auth: aaa)" badge in the auth-select; without these mocks the dropdown
  // shows the raw `fleet-default/registryconfig-auth-regN` id instead.
  const fakeRegistrySecrets = [
    {
      id: 'fleet-default/registryconfig-auth-reg1',
      type: 'secret',
      _type: 'kubernetes.io/basic-auth',
      apiVersion: 'v1',
      kind: 'Secret',
      data: { username: 'YWFh', password: 'YmJi' }, // base64 of 'aaa' / 'bbb'
      links: {
        remove: 'https://localhost:8443/v1/secrets/fleet-default/registryconfig-auth-reg1',
        self: 'https://localhost:8443/v1/secrets/fleet-default/registryconfig-auth-reg1',
        update: 'https://localhost:8443/v1/secrets/fleet-default/registryconfig-auth-reg1',
        view: 'https://localhost:8443/api/v1/namespaces/fleet-default/secrets/registryconfig-auth-reg1',
      },
      metadata: {
        creationTimestamp: '2024-04-24T17:18:59Z',
        fields: ['registryconfig-auth-reg1', 'kubernetes.io/basic-auth', 2, '9m31s'],
        generateName: 'registryconfig-auth-',
        name: 'registryconfig-auth-reg1',
        namespace: 'fleet-default',
        resourceVersion: '1',
        state: { error: false, message: 'Resource is always ready', name: 'active', transitioning: false },
        uid: '5634635f-9b3f-4872-9cc6-f9a3028bf306',
      },
    },
    {
      id: 'fleet-default/registryconfig-auth-reg2',
      type: 'secret',
      _type: 'kubernetes.io/basic-auth',
      apiVersion: 'v1',
      kind: 'Secret',
      data: { username: 'YWFh', password: 'YmJi' },
      links: {
        remove: 'https://localhost:8443/v1/secrets/fleet-default/registryconfig-auth-reg2',
        self: 'https://localhost:8443/v1/secrets/fleet-default/registryconfig-auth-reg2',
        update: 'https://localhost:8443/v1/secrets/fleet-default/registryconfig-auth-reg2',
        view: 'https://localhost:8443/api/v1/namespaces/fleet-default/secrets/registryconfig-auth-reg2',
      },
      metadata: {
        creationTimestamp: '2024-04-24T17:18:59Z',
        fields: ['registryconfig-auth-reg2', 'kubernetes.io/basic-auth', 2, '9m31s'],
        generateName: 'registryconfig-auth-',
        name: 'registryconfig-auth-reg2',
        namespace: 'fleet-default',
        resourceVersion: '1',
        state: { error: false, message: 'Resource is always ready', name: 'active', transitioning: false },
        uid: '5634635f-9b3f-4872-9cc6-f9a3028bf307',
      },
    },
  ];

  await page.route(/\/v1\/secrets(\?|\/fleet-default(\?|$))/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();

    body.data = [...(body.data ?? []), ...fakeRegistrySecrets];
    if (typeof body.count === 'number') {
      body.count = body.data.length;
    }

    await route.fulfill({ response, json: body });
  });
}

/** Alias for edit-fake-cluster spec compatibility */
export const installFakeClusterRoutes = generateFakeClusterDataAndIntercepts;
