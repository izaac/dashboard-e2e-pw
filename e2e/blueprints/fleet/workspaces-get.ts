const resourceType = 'management.cattle.io.fleetworkspace';

/** Generate N fleet workspaces for pagination/filter/sort tests */
export function fleetWorkspacesLargeResponse(count: number, uniqueName = 'aaaa-unique-workspace') {
  const data = [];

  // Unique item sorts first alphabetically
  data.push({
    id: uniqueName,
    type: resourceType,
    metadata: {
      name: uniqueName,
      state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
    },
    status: {},
  });

  for (let i = 1; i < count; i++) {
    const padded = String(i).padStart(3, '0');
    const name = `workspace-${padded}`;

    data.push({
      id: name,
      type: resourceType,
      metadata: {
        name,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
      },
      status: {},
    });
  }

  return { type: 'collection', resourceType, count: data.length, data };
}

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
