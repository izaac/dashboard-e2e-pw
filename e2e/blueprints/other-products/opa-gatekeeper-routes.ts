import type { Page } from '@playwright/test';

const SAFE_RESOURCE_REVISION = 999999999;

// Base URL for schema links — will be replaced dynamically with actual base URL
const SCHEMA_BASE = '/k8s/clusters/local/v1';

/**
 * Helper to create schema links. Uses relative paths so the page resolves them
 * against its origin.
 */
function schemaLinks(id: string, pluralName: string) {
  return {
    collection: `${SCHEMA_BASE}/${pluralName}`,
    self: `${SCHEMA_BASE}/schemas/${id}`,
  };
}

// Full schema data needed for OPA Gatekeeper mock — mirrors upstream Cypress blueprint
const k8sSchemas = [
  {
    id: 'constraints.gatekeeper.sh.k8sallowedrepos',
    type: 'schema',
    links: schemaLinks('constraints.gatekeeper.sh.k8sallowedrepos', 'constraints.gatekeeper.sh.k8sallowedrepos'),
    pluralName: 'constraints.gatekeeper.sh.k8sallowedrepos',
    attributes: {
      group: 'constraints.gatekeeper.sh',
      kind: 'K8sAllowedRepos',
      namespaced: false,
      resource: 'k8sallowedrepos',
      version: 'v1beta1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'constraints.gatekeeper.sh.k8srequiredlabels',
    type: 'schema',
    links: schemaLinks('constraints.gatekeeper.sh.k8srequiredlabels', 'constraints.gatekeeper.sh.k8srequiredlabels'),
    pluralName: 'constraints.gatekeeper.sh.k8srequiredlabels',
    attributes: {
      group: 'constraints.gatekeeper.sh',
      kind: 'K8sRequiredLabels',
      namespaced: false,
      resource: 'k8srequiredlabels',
      version: 'v1beta1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'templates.gatekeeper.sh.constrainttemplate',
    type: 'schema',
    links: schemaLinks('templates.gatekeeper.sh.constrainttemplate', 'templates.gatekeeper.sh.constrainttemplates'),
    pluralName: 'templates.gatekeeper.sh.constrainttemplates',
    attributes: {
      group: 'templates.gatekeeper.sh',
      kind: 'ConstraintTemplate',
      namespaced: false,
      resource: 'constrainttemplates',
      version: 'v1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'config.gatekeeper.sh.config',
    type: 'schema',
    links: schemaLinks('config.gatekeeper.sh.config', 'config.gatekeeper.sh.configs'),
    pluralName: 'config.gatekeeper.sh.configs',
    attributes: {
      group: 'config.gatekeeper.sh',
      kind: 'Config',
      namespaced: true,
      resource: 'configs',
      version: 'v1alpha1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'mutations.gatekeeper.sh.assign',
    type: 'schema',
    links: schemaLinks('mutations.gatekeeper.sh.assign', 'mutations.gatekeeper.sh.assign'),
    pluralName: 'mutations.gatekeeper.sh.assign',
    attributes: {
      group: 'mutations.gatekeeper.sh',
      kind: 'Assign',
      namespaced: false,
      resource: 'assign',
      version: 'v1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'mutations.gatekeeper.sh.assignmetadata',
    type: 'schema',
    links: schemaLinks('mutations.gatekeeper.sh.assignmetadata', 'mutations.gatekeeper.sh.assignmetadata'),
    pluralName: 'mutations.gatekeeper.sh.assignmetadata',
    attributes: {
      group: 'mutations.gatekeeper.sh',
      kind: 'AssignMetadata',
      namespaced: false,
      resource: 'assignmetadata',
      version: 'v1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'mutations.gatekeeper.sh.modifyset',
    type: 'schema',
    links: schemaLinks('mutations.gatekeeper.sh.modifyset', 'mutations.gatekeeper.sh.modifyset'),
    pluralName: 'mutations.gatekeeper.sh.modifyset',
    attributes: {
      group: 'mutations.gatekeeper.sh',
      kind: 'ModifySet',
      namespaced: false,
      resource: 'modifyset',
      version: 'v1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'externaldata.gatekeeper.sh.provider',
    type: 'schema',
    links: schemaLinks('externaldata.gatekeeper.sh.provider', 'externaldata.gatekeeper.sh.providers'),
    pluralName: 'externaldata.gatekeeper.sh.providers',
    attributes: {
      group: 'externaldata.gatekeeper.sh',
      kind: 'Provider',
      namespaced: false,
      resource: 'providers',
      version: 'v1beta1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'expansion.gatekeeper.sh.expansiontemplate',
    type: 'schema',
    links: schemaLinks('expansion.gatekeeper.sh.expansiontemplate', 'expansion.gatekeeper.sh.expansiontemplate'),
    pluralName: 'expansion.gatekeeper.sh.expansiontemplate',
    attributes: {
      group: 'expansion.gatekeeper.sh',
      kind: 'ExpansionTemplate',
      namespaced: false,
      resource: 'expansiontemplate',
      version: 'v1beta1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'mutations.gatekeeper.sh.assignimage',
    type: 'schema',
    links: schemaLinks('mutations.gatekeeper.sh.assignimage', 'mutations.gatekeeper.sh.assignimage'),
    pluralName: 'mutations.gatekeeper.sh.assignimage',
    attributes: {
      group: 'mutations.gatekeeper.sh',
      kind: 'AssignImage',
      namespaced: false,
      preferredVersion: 'v1',
      resource: 'assignimage',
      version: 'v1alpha1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'status.gatekeeper.sh.constraintpodstatus',
    type: 'schema',
    links: schemaLinks('status.gatekeeper.sh.constraintpodstatus', 'status.gatekeeper.sh.constraintpodstatuses'),
    pluralName: 'status.gatekeeper.sh.constraintpodstatuses',
    attributes: {
      group: 'status.gatekeeper.sh',
      kind: 'ConstraintPodStatus',
      namespaced: true,
      resource: 'constraintpodstatuses',
      version: 'v1beta1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'status.gatekeeper.sh.constrainttemplatepodstatus',
    type: 'schema',
    links: schemaLinks('status.gatekeeper.sh.constrainttemplatepodstatus', 'status.gatekeeper.sh.constrainttemplatepodstatuses'),
    pluralName: 'status.gatekeeper.sh.constrainttemplatepodstatuses',
    attributes: {
      group: 'status.gatekeeper.sh',
      kind: 'ConstraintTemplatePodStatus',
      namespaced: true,
      resource: 'constrainttemplatepodstatuses',
      version: 'v1beta1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'status.gatekeeper.sh.expansiontemplatepodstatus',
    type: 'schema',
    links: schemaLinks('status.gatekeeper.sh.expansiontemplatepodstatus', 'status.gatekeeper.sh.expansiontemplatepodstatuses'),
    pluralName: 'status.gatekeeper.sh.expansiontemplatepodstatuses',
    attributes: {
      group: 'status.gatekeeper.sh',
      kind: 'ExpansionTemplatePodStatus',
      namespaced: true,
      resource: 'expansiontemplatepodstatuses',
      version: 'v1beta1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
  {
    id: 'status.gatekeeper.sh.mutatorpodstatus',
    type: 'schema',
    links: schemaLinks('status.gatekeeper.sh.mutatorpodstatus', 'status.gatekeeper.sh.mutatorpodstatuses'),
    pluralName: 'status.gatekeeper.sh.mutatorpodstatuses',
    attributes: {
      group: 'status.gatekeeper.sh',
      kind: 'MutatorPodStatus',
      namespaced: true,
      resource: 'mutatorpodstatuses',
      version: 'v1beta1',
      verbs: ['delete', 'deletecollection', 'get', 'list', 'patch', 'create', 'update', 'watch'],
    },
    resourceMethods: ['GET', 'DELETE', 'PUT', 'PATCH'],
    collectionMethods: ['GET', 'POST'],
  },
];

const constraintTemplatesGet = {
  type: 'collection',
  resourceType: 'templates.gatekeeper.sh.constrainttemplate',
  revision: SAFE_RESOURCE_REVISION,
  count: 2,
  data: [
    {
      id: 'k8sallowedrepos',
      type: 'templates.gatekeeper.sh.constrainttemplate',
      apiVersion: 'templates.gatekeeper.sh/v1',
      kind: 'ConstraintTemplate',
      metadata: {
        name: 'k8sallowedrepos',
        resourceVersion: String(SAFE_RESOURCE_REVISION),
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
      },
      spec: { crd: { spec: { names: { kind: 'K8sAllowedRepos' } } } },
    },
    {
      id: 'k8srequiredlabels',
      type: 'templates.gatekeeper.sh.constrainttemplate',
      apiVersion: 'templates.gatekeeper.sh/v1',
      kind: 'ConstraintTemplate',
      metadata: {
        name: 'k8srequiredlabels',
        resourceVersion: String(SAFE_RESOURCE_REVISION),
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
      },
      spec: { crd: { spec: { names: { kind: 'K8sRequiredLabels' } } } },
    },
  ],
};

const emptyCollection = (resourceType: string) => ({
  type: 'collection',
  resourceType,
  revision: SAFE_RESOURCE_REVISION,
  data: [],
});

/**
 * Set up Playwright route mocks to simulate OPA Gatekeeper being installed on the local cluster.
 * Mirrors upstream Cypress `generateOpaGatekeeperForLocalCluster()`.
 */
export async function setupOpaGatekeeperRoutes(page: Page): Promise<void> {
  // Intercept schemas to inject gatekeeper schemas (match with or without query params)
  await page.route(/\/k8s\/clusters\/local\/v1\/schemas(\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();

    body.data = [...body.data, ...k8sSchemas];
    await route.fulfill({ json: body });
  });

  // Mock all gatekeeper resource collection endpoints.
  // Use regex to match both with and without query params.
  const mockedCollections: [RegExp, object][] = [
    [/\/k8s\/clusters\/local\/v1\/constraints\.gatekeeper\.sh\.k8sallowedrepos(\?|$)/, emptyCollection('constraints.gatekeeper.sh.k8sallowedrepos')],
    [/\/k8s\/clusters\/local\/v1\/constraints\.gatekeeper\.sh\.k8srequiredlabels(\?|$)/, emptyCollection('constraints.gatekeeper.sh.k8srequiredlabels')],
    [/\/k8s\/clusters\/local\/v1\/templates\.gatekeeper\.sh\.constrainttemplates(\?|$)/, constraintTemplatesGet],
    [/\/k8s\/clusters\/local\/v1\/config\.gatekeeper\.sh\.configs(\?|$)/, emptyCollection('config.gatekeeper.sh.config')],
    [/\/k8s\/clusters\/local\/v1\/mutations\.gatekeeper\.sh\.assign(\?|$)/, emptyCollection('mutations.gatekeeper.sh.assign')],
    [/\/k8s\/clusters\/local\/v1\/mutations\.gatekeeper\.sh\.assignmetadata(\?|$)/, emptyCollection('mutations.gatekeeper.sh.assignmetadata')],
    [/\/k8s\/clusters\/local\/v1\/mutations\.gatekeeper\.sh\.assignimage(\?|$)/, emptyCollection('mutations.gatekeeper.sh.assignimage')],
    [/\/k8s\/clusters\/local\/v1\/mutations\.gatekeeper\.sh\.modifyset(\?|$)/, emptyCollection('mutations.gatekeeper.sh.modifyset')],
    [/\/k8s\/clusters\/local\/v1\/externaldata\.gatekeeper\.sh\.providers(\?|$)/, emptyCollection('externaldata.gatekeeper.sh.provider')],
    [/\/k8s\/clusters\/local\/v1\/expansion\.gatekeeper\.sh\.expansiontemplate(\?|$)/, emptyCollection('expansion.gatekeeper.sh.expansiontemplate')],
    [/\/k8s\/clusters\/local\/v1\/status\.gatekeeper\.sh\.constraintpodstatuses(\?|$)/, emptyCollection('status.gatekeeper.sh.constraintpodstatus')],
    [/\/k8s\/clusters\/local\/v1\/status\.gatekeeper\.sh\.constrainttemplatepodstatuses(\?|$)/, emptyCollection('status.gatekeeper.sh.constrainttemplatepodstatus')],
    [/\/k8s\/clusters\/local\/v1\/status\.gatekeeper\.sh\.expansiontemplatepodstatuses(\?|$)/, emptyCollection('status.gatekeeper.sh.expansiontemplatepodstatus')],
    [/\/k8s\/clusters\/local\/v1\/status\.gatekeeper\.sh\.mutatorpodstatuses(\?|$)/, emptyCollection('status.gatekeeper.sh.mutatorpodstatus')],
  ];

  for (const [pattern, body] of mockedCollections) {
    await page.route(pattern, async (route) => {
      await route.fulfill({ json: body });
    });
  }
}
