export function clusterPinBadgeCustomMgmtClusterPayload(): object {
  return {
    type: 'management.cattle.io.cluster',
    metadata: {
      name: 'cluster-pin-fixtures-badge-custom',
      annotations: {
        'ui.rancher/badge-color': '#b62020',
        'ui.rancher/badge-text': 'Critical Production',
        'ui.rancher/badge-icon-text': 'PRD',
      },
    },
    spec: {
      internal: false,
      displayName: 'Production Cluster Alpha',
    },
  };
}

export function clusterPinBadgeAutoMgmtClusterPayload(): object {
  return {
    type: 'management.cattle.io.cluster',
    metadata: {
      name: 'cluster-pin-fixtures-badge-auto',
      annotations: {
        'ui.rancher/badge-color': '#673ab7',
        'ui.rancher/badge-text': 'Analytics Pipeline',
      },
    },
    spec: {
      internal: false,
      displayName: 'Analytics Workload Engine',
    },
  };
}

export function clusterPinStandardMgmtClusterPayload(): object {
  return {
    type: 'management.cattle.io.cluster',
    metadata: {
      name: 'cluster-pin-fixtures-standard',
    },
    spec: {
      internal: false,
      displayName: 'Standard QA Cluster',
    },
  };
}

export function clusterPinBulkMgmtClusterPayload(index: number): object {
  return {
    type: 'management.cattle.io.cluster',
    metadata: {
      name: `cluster-pin-fixtures-bulk0${index}`,
    },
    spec: {
      internal: false,
      displayName: `Batch Cluster ${index}`,
    },
  };
}

export function clusterPinProvClusterPayload(namespace: string): object {
  return {
    type: 'provisioning.cattle.io.cluster',
    metadata: {
      name: 'cluster-pin-fixtures-prov',
      namespace,
    },
    spec: {},
  };
}
