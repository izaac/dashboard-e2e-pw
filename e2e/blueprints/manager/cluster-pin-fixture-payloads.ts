const QA_ISSUE_LABELS = { 'qa-issue': '19241' };

export function qa19241CustomBadgeMgmtClusterPayload(): object {
  return {
    type: 'management.cattle.io.cluster',
    metadata: {
      name: 'qa-19241-custom-badge',
      labels: { ...QA_ISSUE_LABELS },
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

export function qa19241AutoBadgeMgmtClusterPayload(): object {
  return {
    type: 'management.cattle.io.cluster',
    metadata: {
      name: 'qa-19241-auto-badge',
      labels: { ...QA_ISSUE_LABELS },
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

export function qa19241StandardMgmtClusterPayload(): object {
  return {
    type: 'management.cattle.io.cluster',
    metadata: {
      name: 'qa-19241-standard',
      labels: { ...QA_ISSUE_LABELS },
    },
    spec: {
      internal: false,
      displayName: 'Standard QA Cluster',
    },
  };
}

export function qa19241BulkMgmtClusterPayload(index: number): object {
  return {
    type: 'management.cattle.io.cluster',
    metadata: {
      name: `qa-19241-bulk0${index}`,
      labels: { ...QA_ISSUE_LABELS },
    },
    spec: {
      internal: false,
      displayName: `Batch Cluster ${index}`,
    },
  };
}

export function qa19241ProvClusterPayload(namespace: string): object {
  return {
    type: 'provisioning.cattle.io.cluster',
    metadata: {
      name: 'qa-19241-prov',
      namespace,
      labels: { ...QA_ISSUE_LABELS },
    },
    spec: {},
  };
}
