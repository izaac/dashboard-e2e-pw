/**
 * Mock body for a `provisioning.cattle.io.cluster` resource shaped like an
 * elemental-provisioned cluster. Returned via `page.route()` to satisfy the
 * upgrade-group target dropdown without creating a real CR — Rancher's
 * provisioning webhook rejects bare CRs, so a UI-layer mock is the only path
 * to atomic isolation for the upgrade-group test.
 *
 * Mirrors the upstream cypress pattern in
 * `cypress/e2e/blueprints/manager/v2prov-capi-cluster-mocks.ts`.
 */
export function buildElementalClusterMock(name: string, namespace = 'fleet-default') {
  return {
    id: `${namespace}/${name}`,
    type: 'provisioning.cattle.io.cluster',
    apiVersion: 'provisioning.cattle.io/v1',
    kind: 'Cluster',
    metadata: {
      name,
      namespace,
      uid: `mock-${name}`,
      creationTimestamp: '2026-01-01T00:00:00Z',
      state: { name: 'active', error: false, transitioning: false },
    },
    spec: {
      rkeConfig: {
        machinePools: [
          {
            name: 'pool1',
            quantity: 1,
            machineConfigRef: {
              kind: 'MachineInventorySelectorTemplate',
              name: `${name}-template`,
            },
          },
        ],
      },
    },
    status: { conditions: [] },
  };
}
