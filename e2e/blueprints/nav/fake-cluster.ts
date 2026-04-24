/**
 * Fake DigitalOcean cluster blueprint for Playwright route interception.
 *
 * Ported from upstream Cypress blueprint (cypress/e2e/blueprints/nav/fake-cluster.ts).
 * Injects a fake provisioning cluster into real API responses so the Dashboard
 * renders it in the cluster list and allows navigating to its edit page.
 */
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

import { SAFE_RESOURCE_REVISION } from '../blueprint.utils';

const MACHINE_POOL_ID = '995mj';
const CLOUD_CRED_ID = 'srb7v';

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

function generateProvClusterObj(provClusterId: string, mgmtClusterId: string) {
  return {
    id: `fleet-default/${provClusterId}`,
    type: 'provisioning.cattle.io.cluster',
    links: {
      remove: `https://localhost:8005/v1/provisioning.cattle.io.clusters/fleet-default/${provClusterId}`,
      self: `https://localhost:8005/v1/provisioning.cattle.io.clusters/fleet-default/${provClusterId}`,
      update: `https://localhost:8005/v1/provisioning.cattle.io.clusters/fleet-default/${provClusterId}`,
      view: `https://localhost:8005/apis/provisioning.cattle.io/v1/namespaces/fleet-default/clusters/${provClusterId}`,
    },
    apiVersion: 'provisioning.cattle.io/v1',
    kind: 'Cluster',
    metadata: {
      annotations: { 'field.cattle.io/creatorId': 'user-lfv6k' },
      creationTimestamp: '2024-03-07T15:45:25Z',
      fields: [provClusterId, 'true', `${provClusterId}-kubeconfig`],
      finalizers: [
        'wrangler.cattle.io/provisioning-cluster-remove',
        'wrangler.cattle.io/rke-cluster-remove',
        'wrangler.cattle.io/cloud-config-secret-remover',
      ],
      generation: 3,
      name: provClusterId,
      namespace: 'fleet-default',
      relationships: [
        {
          toId: mgmtClusterId,
          toType: 'management.cattle.io.cluster',
          rel: 'applies',
          state: 'active',
          message: 'Resource is Ready',
        },
        {
          toId: `fleet-default/${provClusterId}`,
          toType: 'fleet.cattle.io.cluster',
          rel: 'applies',
          state: 'active',
          message: 'Resource is Ready',
        },
        {
          toId: `fleet-default/nc-${provClusterId}-pool1-${MACHINE_POOL_ID}`,
          toType: 'rke-machine-config.cattle.io.digitaloceanconfig',
          rel: 'owner',
          state: 'active',
          message: 'Resource is current',
        },
      ],
      resourceVersion: SAFE_RESOURCE_REVISION,
      state: { error: false, message: 'Resource is Ready', name: 'active', transitioning: false },
      uid: '326aa188-e66f-4cf0-8f54-9fc47e4c5d92',
    },
    spec: {
      cloudCredentialSecretName: `cattle-global-data:cc-${CLOUD_CRED_ID}`,
      kubernetesVersion: 'v1.27.10+rke2r1',
      localClusterAuthEndpoint: {},
      rkeConfig: {
        chartValues: { 'rke2-calico': {} },
        etcd: { snapshotRetention: 5, snapshotScheduleCron: '0 */5 * * *' },
        machineGlobalConfig: {
          cni: 'calico',
          'disable-kube-proxy': false,
          'etcd-expose-metrics': false,
          'ingress-controller': 'ingress-nginx',
        },
        machinePoolDefaults: {},
        machinePools: [
          {
            controlPlaneRole: true,
            drainBeforeDelete: true,
            dynamicSchemaSpec:
              '{"resourceFields":{"accessToken":{"type":"password","default":{"stringValue":"","intValue":0,"boolValue":false,"stringSliceValue":null},"create":true,"update":true,"description":"Digital Ocean access token"},"region":{"type":"string","default":{"stringValue":"nyc3","intValue":0,"boolValue":false,"stringSliceValue":null},"create":true,"update":true,"description":"Digital Ocean region"},"size":{"type":"string","default":{"stringValue":"s-1vcpu-1gb","intValue":0,"boolValue":false,"stringSliceValue":null},"create":true,"update":true,"description":"Digital Ocean size"},"image":{"type":"string","default":{"stringValue":"ubuntu-20-04-x64","intValue":0,"boolValue":false,"stringSliceValue":null},"create":true,"update":true,"description":"Digital Ocean Image"}}}',
            etcdRole: true,
            machineConfigRef: { kind: 'DigitaloceanConfig', name: `nc-${provClusterId}-pool1-${MACHINE_POOL_ID}` },
            name: 'pool1',
            quantity: 1,
            unhealthyNodeTimeout: '0s',
            workerRole: true,
          },
        ],
        machineSelectorConfig: [{ config: { 'protect-kernel-defaults': false } }],
        registries: {
          configs: {
            reg1: { authConfigSecretName: 'registryconfig-auth-reg1' },
            reg2: { authConfigSecretName: 'registryconfig-auth-reg2' },
          },
        },
        upgradeStrategy: {
          controlPlaneConcurrency: '1',
          controlPlaneDrainOptions: {
            enabled: false,
            gracePeriod: -1,
            timeout: 120,
            deleteEmptyDirData: true,
            ignoreDaemonSets: true,
          },
          workerConcurrency: '1',
          workerDrainOptions: {
            enabled: false,
            gracePeriod: -1,
            timeout: 120,
            deleteEmptyDirData: true,
            ignoreDaemonSets: true,
          },
        },
      },
    },
    status: {
      agentDeployed: true,
      clientSecretName: `${provClusterId}-kubeconfig`,
      clusterName: mgmtClusterId,
      conditions: [
        { error: false, status: 'True', transitioning: false, type: 'Ready' },
        { error: false, status: 'True', transitioning: false, type: 'Provisioned' },
        { error: false, status: 'True', transitioning: false, type: 'Connected' },
      ],
      fleetWorkspaceName: 'fleet-default',
      observedGeneration: 3,
      ready: true,
    },
  };
}

function generateMgmtClusterObj(provClusterId: string, mgmtClusterId: string) {
  return {
    id: mgmtClusterId,
    type: 'management.cattle.io.cluster',
    links: {
      remove: 'blocked',
      self: `https://localhost:8005/v1/management.cattle.io.clusters/${mgmtClusterId}`,
      update: 'blocked',
      view: `https://localhost:8005/v1/management.cattle.io.clusters/${mgmtClusterId}`,
    },
    actions: {
      generateKubeconfig: `https://localhost:8005/v3/clusters/${mgmtClusterId}?action=generateKubeconfig`,
    },
    apiVersion: 'management.cattle.io/v3',
    kind: 'Cluster',
    metadata: {
      annotations: {
        'authz.management.cattle.io/creator-role-bindings':
          '{"created":["cluster-owner"],"required":["cluster-owner"]}',
        'field.cattle.io/creatorId': 'user-lfv6k',
        'objectset.rio.cattle.io/owner-name': provClusterId,
        'objectset.rio.cattle.io/owner-namespace': 'fleet-default',
        'provisioning.cattle.io/administrated': 'true',
      },
      creationTimestamp: '2024-03-07T15:45:25Z',
      fields: [mgmtClusterId, '19h'],
      generation: 42,
      labels: { 'provider.cattle.io': 'rke2' },
      name: mgmtClusterId,
      relationships: [
        {
          fromId: `fleet-default/${provClusterId}`,
          fromType: 'provisioning.cattle.io.cluster',
          rel: 'applies',
          state: 'active',
          message: 'Resource is Ready',
        },
      ],
      resourceVersion: SAFE_RESOURCE_REVISION,
      state: { error: false, message: 'Resource is Ready', name: 'active', transitioning: false },
      uid: '5887e0fe-d20a-42cc-812e-cbc2213201fe',
    },
    spec: {
      description: '',
      displayName: provClusterId,
      fleetWorkspaceName: 'fleet-default',
      internal: false,
      localClusterAuthEndpoint: { enabled: false },
    },
    status: {
      agentImage: 'rancher/rancher-agent:v2.8.2',
      allocatable: { cpu: '2', memory: '4026036Ki', pods: '110' },
      capacity: { cpu: '2', memory: '4026036Ki', pods: '110' },
      conditions: [
        { error: false, status: 'True', transitioning: false, type: 'Ready' },
        { error: false, status: 'True', transitioning: false, type: 'Connected' },
      ],
      driver: 'imported',
      linuxWorkerCount: 1,
      nodeCount: 1,
      provider: 'rke2',
      version: { gitVersion: 'v1.27.10+rke2r1' },
    },
  };
}

// Minimal counts, namespaces, daemonsets — just enough for the cluster explorer to load
function generateFakeCountsReply() {
  return [{ id: 'count', type: 'count', counts: {}, namespaces: {} }];
}

function generateFakeNamespacesReply(mgmtClusterId: string) {
  return [
    {
      id: 'default',
      type: 'namespace',
      links: { self: `https://localhost:8005/k8s/clusters/${mgmtClusterId}/v1/namespaces/default` },
      metadata: { name: 'default', state: { name: 'active', error: false, transitioning: false } },
    },
  ];
}

function generateFakeDaemonsetsReply() {
  return [];
}

// ---------------------------------------------------------------------------
// Route installer — sets up page.route() intercepts BEFORE login
// ---------------------------------------------------------------------------

interface FakeClusterOptions {
  fakeProvClusterId?: string;
  fakeMgmtClusterId?: string;
}

/**
 * Installs all `page.route()` intercepts needed to fake a DigitalOcean
 * provisioning cluster in the Dashboard UI, including edit-cluster capabilities
 * (node drivers, cloud creds, machine config, DO API proxies, secrets).
 *
 * Call BEFORE `login()` so routes are active when the page loads.
 */
export async function installFakeClusterRoutes(page: Page, opts: FakeClusterOptions = {}) {
  const provId = opts.fakeProvClusterId ?? 'some-fake-cluster-id';
  const mgmtId = opts.fakeMgmtClusterId ?? 'some-fake-mgmt-id';

  const provClusterObj = generateProvClusterObj(provId, mgmtId);
  const mgmtClusterObj = generateMgmtClusterObj(provId, mgmtId);

  // --- Inject fake cluster into real list responses (modify + forward) ---

  const fetchOpts = { timeout: 30_000 };

  await page.route('**/v1/fleet.cattle.io.clusters?*', async (route) => {
    const resp = await route.fetch(fetchOpts);
    const body = await resp.json();

    body.data.push(provClusterObj);
    await route.fulfill({ response: resp, json: body });
  });

  await page.route('**/v1/provisioning.cattle.io.clusters?*', async (route) => {
    const resp = await route.fetch(fetchOpts);
    const body = await resp.json();

    body.data.push(provClusterObj);
    await route.fulfill({ response: resp, json: body });
  });

  await page.route('**/v1/management.cattle.io.clusters?*', async (route) => {
    const resp = await route.fetch(fetchOpts);
    const body = await resp.json();

    body.data.push(mgmtClusterObj);
    await route.fulfill({ response: resp, json: body });
  });

  // --- Fake cluster k8s API endpoints (return synthetic data) ---

  await page.route(`**/k8s/clusters/${mgmtId}/v1/counts?*`, (route) => {
    return route.fulfill({ json: { data: generateFakeCountsReply() } });
  });

  await page.route(`**/k8s/clusters/${mgmtId}/v1/namespaces?*`, (route) => {
    return route.fulfill({ json: { data: generateFakeNamespacesReply(mgmtId) } });
  });

  await page.route(`**/k8s/clusters/${mgmtId}/v1/schemas?*`, (route) => {
    return route.fulfill({
      json: {
        data: [
          generateFakeNodeSchema(mgmtId),
          generateFakeCountSchema(mgmtId),
          generateFakeNamespaceSchema(mgmtId),
          generateFakeDaemonsetSchema(mgmtId),
          generateFakePodSchema(mgmtId),
        ],
      },
    });
  });

  await page.route(`**/k8s/clusters/${mgmtId}/v1/pods?*`, (route) => {
    return route.fulfill({ json: { data: [] } });
  });

  await page.route(`**/k8s/clusters/${mgmtId}/v1/nodes?*`, (route) => {
    return route.fulfill({ json: { data: [] } });
  });

  await page.route(`**/k8s/clusters/${mgmtId}/v1/apps.daemonsets?*`, (route) => {
    return route.fulfill({ json: { data: generateFakeDaemonsetsReply() } });
  });

  // --- Edit-cluster capability endpoints ---

  await page.route('**/v1/management.cattle.io.nodedrivers?*', (route) => {
    return route.fulfill({ json: { data: [generateFakeNodeDriversReply()] } });
  });

  await page.route('**/v3/cloudcredentials', (route) => {
    return route.fulfill({ json: generateFakeCloudCredentialsReply(CLOUD_CRED_ID) });
  });

  await page.route(
    `**/v1/rke-machine-config.cattle.io.digitaloceanconfigs/fleet-default/nc-${provId}-pool1-${MACHINE_POOL_ID}?*`,
    (route) => {
      return route.fulfill({ json: generateFakeMachineConfigReply(provId, MACHINE_POOL_ID) });
    },
  );

  await page.route(`**/v3/cloudcredentials/cattle-global-data:cc-${CLOUD_CRED_ID}`, (route) => {
    return route.fulfill({ json: generateFakeCloudCredIndividualReply(CLOUD_CRED_ID) });
  });

  // DO API proxy responses
  await page.route('**/meta/proxy/api.digitalocean.com/v2/regions?*', (route) => {
    return route.fulfill({
      json: {
        meta: { total: 1 },
        regions: [
          {
            name: 'London 1',
            slug: 'lon1',
            features: ['backups', 'ipv6', 'metadata'],
            available: true,
            sizes: ['s-1vcpu-1gb'],
          },
        ],
      },
    });
  });

  await page.route('**/meta/proxy/api.digitalocean.com/v2/sizes?*', (route) => {
    return route.fulfill({
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
            regions: ['lon1'],
            available: true,
            description: 'Basic',
          },
        ],
      },
    });
  });

  await page.route('**/meta/proxy/api.digitalocean.com/v2/images?*', (route) => {
    return route.fulfill({
      json: {
        meta: { total: 1 },
        images: [
          {
            id: 129211873,
            name: '20.04 (LTS) x64',
            distribution: 'Ubuntu',
            slug: 'ubuntu-20-04-x64',
            public: true,
            regions: ['lon1'],
            type: 'base',
            status: 'available',
          },
        ],
      },
    });
  });

  // Secrets (for registry auth)
  await page.route('**/v1/secrets?*', (route) => {
    return route.fulfill({ json: { data: generateFakeSecretsReply() } });
  });

  await page.route('**/v1/secrets/fleet-default?*', (route) => {
    return route.fulfill({ json: { data: generateFakeSecretsReply() } });
  });
}
