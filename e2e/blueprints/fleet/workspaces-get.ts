const resourceType = 'management.cattle.io.fleetworkspace';

/** 2 fleet workspaces — verifies pagination is hidden when row count is below threshold */
export function fleetWorkspacesSmallResponse() {
  const names = ['fleet-default', 'fleet-local'];
  const data = names.map((name) => ({
    id: name,
    type: resourceType,
    metadata: {
      name,
      state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
    },
    status: {},
  }));

  return { type: 'collection', resourceType, count: data.length, data };
}
