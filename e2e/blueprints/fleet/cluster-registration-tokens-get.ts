const resourceType = 'fleet.cattle.io.clusterregistrationtoken';

/** Empty collection — verifies table renders "no rows" state */
export function clusterRegistrationTokensEmptyResponse() {
  return { type: 'collection', resourceType, count: 0, data: [] };
}

/** 1 token in fleet-default — verifies table renders populated state */
export function clusterRegistrationTokensSmallResponse() {
  return {
    type: 'collection',
    resourceType,
    count: 1,
    data: [
      {
        id: 'fleet-default/test',
        type: resourceType,
        metadata: {
          name: 'test',
          namespace: 'fleet-default',
          state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
        },
        status: { secretName: 'test' },
      },
    ],
  };
}
