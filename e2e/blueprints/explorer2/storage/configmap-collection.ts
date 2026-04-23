import { SAFE_RESOURCE_REVISION } from '../../blueprint.utils';

/** Generate a collection of N configmaps for pagination/filter/sort tests */
export function configmapLargeResponse(count: number, uniqueName = 'aaaa-unique-configmap', namespace = 'default') {
  const data = [];

  // Unique item sorts first alphabetically for sort verification
  data.push({
    id: `${namespace}/${uniqueName}`,
    type: 'configmap',
    apiVersion: 'v1',
    metadata: {
      fields: [uniqueName, '{}', '1m'],
      name: uniqueName,
      namespace,
      creationTimestamp: '2024-06-27T20:32:52Z',
      resourceVersion: SAFE_RESOURCE_REVISION,
      state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
    },
    data: { key: 'value' },
  });

  for (let i = 1; i < count; i++) {
    const padded = String(i).padStart(3, '0');
    const name = `configmap-${padded}`;

    data.push({
      id: `${namespace}/${name}`,
      type: 'configmap',
      apiVersion: 'v1',
      metadata: {
        fields: [name, '{}', '1m'],
        name,
        namespace,
        creationTimestamp: '2024-06-27T20:32:52Z',
        resourceVersion: SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
      },
      data: { key: `value-${padded}` },
    });
  }

  return {
    type: 'collection',
    links: { self: '/v1/configmaps' },
    createTypes: { configmap: '/v1/configmaps' },
    actions: {},
    resourceType: 'configmap',
    revision: SAFE_RESOURCE_REVISION,
    count: data.length,
    data,
  };
}
