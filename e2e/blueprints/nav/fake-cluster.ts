import type { Page } from '@playwright/test';
import {
  generateFakeNodeSchema,
  generateFakeCountSchema,
  generateFakeNamespaceSchema,
  generateFakeDaemonsetSchema,
  generateFakePodSchema,
} from './k8s-schemas';
import {
  generateFakeNodeDriversReply,
  generateFakeCloudCredentialsReply,
  generateFakeMachineConfigReply,
  generateFakeCloudCredIndividualReply,
  generateFakeSecretsReply,
} from './edit-cluster';
import { generateProvClusterObj, generateMgmtClusterObj, MACHINE_POOL_ID, CLOUD_CRED_ID } from './fake-cluster-objects';

/**
 * Sets up route intercepts for a fake cluster in the navigation menu.
 * Playwright equivalent of the Cypress generateFakeClusterDataAndIntercepts.
 *
 * The cluster objects come verbatim from the upstream cypress blueprints
 * (see fake-cluster-objects.ts) so the dashboard's editability getters
 * (machineProvider, canCustomEdit, canUpdate) see the exact data upstream
 * tests against.
 *
 * Must be called BEFORE navigating to the page that triggers these requests.
 */
export async function generateFakeClusterDataAndIntercepts(
  page: Page,
  {
    fakeProvClusterId = 'some-prov-cluster-id',
    fakeMgmtClusterId = 'some-mgmt-cluster-id',
    addEditClusterCapabilities = false,
    longClusterDescription = 'this-is-some-really-really-really-really-really-really-long-description',
  }: {
    fakeProvClusterId?: string;
    fakeMgmtClusterId?: string;
    addEditClusterCapabilities?: boolean;
    longClusterDescription?: string;
  },
): Promise<void> {
  const provClusterObj = generateProvClusterObj(fakeProvClusterId, fakeMgmtClusterId);
  const mgmtClusterObj = generateMgmtClusterObj(fakeProvClusterId, fakeMgmtClusterId);

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

    body.data.push(provClusterObj);

    if (typeof body.count === 'number') {
      body.count = body.data.length;
    }

    await route.fulfill({ response, json: body });
  });

  // Individual prov cluster fetch — the edit page loads the resource by id;
  // the list regex above cannot match the `/clusters/<ns>/<id>?` URL shape.
  await page.route(`**/v1/provisioning.cattle.io.clusters/fleet-default/${fakeProvClusterId}?*`, async (route) => {
    await route.fulfill({ status: 200, json: provClusterObj });
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

    body.data.push(mgmtClusterObj);

    if (typeof body.count === 'number') {
      body.count = body.data.length;
    }

    await route.fulfill({ response, json: body });
  });

  // Individual mgmt cluster fetch — the prov model resolves `this.mgmt` by id;
  // without this route the real rancher 404s and machineProvider/canCustomEdit
  // resolve to nothing, so the 'Edit Config' action never renders.
  await page.route(`**/v1/management.cattle.io.clusters/${fakeMgmtClusterId}?*`, async (route) => {
    await route.fulfill({ status: 200, json: mgmtClusterObj });
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
    if (addEditClusterCapabilities) {
      // Capability mode mirrors upstream: serve the full fake secrets list
      // (includes the registry auth secrets) instead of merging into the
      // real response.
      await route.fulfill({ status: 200, json: { data: generateFakeSecretsReply() } });

      return;
    }

    const response = await route.fetch();
    const body = await response.json();

    body.data = [...(Array.isArray(body.data) ? body.data : []), ...fakeRegistrySecrets];
    if (typeof body.count === 'number') {
      body.count = body.data.length;
    }

    await route.fulfill({ response, json: body });
  });

  if (!addEditClusterCapabilities) {
    return;
  }

  // --- Edit capabilities (upstream cypress parity) ---------------------------
  // Mocks the node driver, cloud credential, DO machine config, and DigitalOcean
  // meta-proxy lookups the cluster edit page makes for a DO node-driver cluster.

  await page.route('**/v1/management.cattle.io.nodedrivers?*', async (route) => {
    await route.fulfill({ status: 200, json: { data: [generateFakeNodeDriversReply()] } });
  });

  await page.route(/\/v3\/cloudcredentials(\?|$)/, async (route) => {
    await route.fulfill({ status: 200, json: { data: [generateFakeCloudCredentialsReply(CLOUD_CRED_ID)] } });
  });

  await page.route(`**/v3/cloudcredentials/cattle-global-data:cc-${CLOUD_CRED_ID}`, async (route) => {
    await route.fulfill({ status: 200, json: generateFakeCloudCredIndividualReply(CLOUD_CRED_ID) });
  });

  await page.route(
    `**/v1/rke-machine-config.cattle.io.digitaloceanconfigs/fleet-default/nc-${fakeProvClusterId}-pool1-${MACHINE_POOL_ID}?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        json: generateFakeMachineConfigReply(fakeProvClusterId, MACHINE_POOL_ID),
      });
    },
  );

  await page.route('**/meta/proxy/api.digitalocean.com/v2/regions?*', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        meta: { total: 1 },
        regions: [
          {
            name: 'London 1',
            slug: 'lon1',
            features: ['backups', 'ipv6', 'metadata', 'install_agent', 'storage', 'image_transfer'],
            available: true,
            sizes: ['s-1vcpu-1gb'],
          },
        ],
      },
    });
  });

  await page.route('**/meta/proxy/api.digitalocean.com/v2/sizes?*', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        meta: { total: 1 },
        sizes: [
          {
            slug: 's-1vcpu-1gb',
            memory: 1024,
            vcpus: 1,
            disk: 25,
            transfer: 1,
            price_monthly: 6,
            price_hourly: 0.00893,
            regions: ['ams3', 'blr1', 'fra1', 'lon1', 'nyc1', 'nyc3', 'sfo2', 'sfo3', 'sgp1', 'syd1', 'tor1'],
            available: true,
            description: 'Basic',
            networking_througput: 2000,
          },
        ],
      },
    });
  });

  await page.route('**/meta/proxy/api.digitalocean.com/v2/images?*', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        meta: { total: 1 },
        images: [
          {
            id: 129211873,
            name: '20.04 (LTS) x64',
            distribution: 'Ubuntu',
            slug: 'ubuntu-20-04-x64',
            public: true,
            regions: [
              'tor1',
              'syd1',
              'sgp1',
              'sfo3',
              'sfo2',
              'sfo1',
              'nyc3',
              'nyc2',
              'nyc1',
              'lon1',
              'fra1',
              'blr1',
              'ams3',
              'ams2',
            ],
            created_at: '2023-03-20T19:17:23Z',
            min_disk_size: 7,
            type: 'base',
            size_gigabytes: 0.72,
            description: 'Ubuntu 20.04 (LTS) x64',
            tags: [],
            status: 'available',
            error_message: '',
          },
        ],
      },
    });
  });
}

/** Alias for edit-fake-cluster spec compatibility */
export const installFakeClusterRoutes = generateFakeClusterDataAndIntercepts;
