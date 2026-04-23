import { SAFE_RESOURCE_REVISION } from '../../blueprint.utils';

/** Generate a collection of N events for pagination/filter/sort tests */
export function eventsLargeResponse(count: number, uniqueName = 'aaaa-unique-test-event') {
  const ns = 'cattle-fleet-local-system';
  const data = [];

  // Unique item sorts first alphabetically for sort verification
  data.push({
    id: `${ns}/${uniqueName}.17d80b90a6d2c000`,
    type: 'event',
    _type: 'dummy_data',
    apiVersion: 'v1',
    metadata: {
      fields: [
        '7m',
        'Normal',
        'Pulled',
        `pod/${uniqueName}`,
        'spec.containers{app}',
        'kubelet, node-1',
        `Pulled image for ${uniqueName}`,
        '7m',
        1,
        `${uniqueName}.17d80b90a6d2c000`,
      ],
      name: `${uniqueName}.17d80b90a6d2c000`,
      namespace: ns,
      relationships: null,
      resourceVersion: SAFE_RESOURCE_REVISION,
      state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
    },
    reason: 'Pulled',
  });

  for (let i = 1; i < count; i++) {
    const padded = String(i).padStart(3, '0');
    const name = `event-${padded}`;

    data.push({
      id: `${ns}/${name}.17d80b90a6d2c${padded}`,
      type: 'event',
      _type: 'dummy_data',
      apiVersion: 'v1',
      metadata: {
        fields: [
          '7m',
          'Normal',
          'Killing',
          `pod/${name}`,
          'spec.containers{agent}',
          'kubelet, node-1',
          `Stopping container ${name}`,
          '7m',
          1,
          `${name}.17d80b90a6d2c${padded}`,
        ],
        name: `${name}.17d80b90a6d2c${padded}`,
        namespace: ns,
        relationships: null,
        resourceVersion: SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
      },
      reason: 'Killing',
    });
  }

  return {
    type: 'collection',
    links: { self: '/v1/events' },
    createTypes: { event: '/v1/events' },
    actions: {},
    resourceType: 'event',
    revision: SAFE_RESOURCE_REVISION,
    count: data.length,
    data,
  };
}

export const eventsGetEmptyEventsSet = {
  type: 'collection',
  links: { self: '/v1/events' },
  createTypes: { event: '/v1/events' },
  actions: {},
  resourceType: 'event',
  revision: SAFE_RESOURCE_REVISION,
  data: [],
};

export const eventsGetResponseSmallSet = {
  type: 'collection',
  links: { self: '/v1/events' },
  createTypes: { event: '/v1/events' },
  actions: {},
  resourceType: 'event',
  revision: SAFE_RESOURCE_REVISION,
  count: 3,
  data: [
    {
      id: 'cattle-fleet-local-system/fleet-agent-0.17d80b90a6d2c7ab',
      type: 'event',
      _type: 'dummy_data',
      apiVersion: 'v1',
      metadata: {
        fields: [
          '7m',
          'Normal',
          'Killing',
          'pod/fleet-agent-0',
          'spec.containers{fleet-agent}',
          'kubelet, ip-172-31-2-245.us-east-2.compute.internal',
          'Stopping container fleet-agent',
          '7m',
          1,
          'fleet-agent-0.17d80b90a6d2c7ab',
        ],
        name: 'fleet-agent-0.17d80b90a6d2c7ab',
        namespace: 'cattle-fleet-local-system',
        relationships: null,
        resourceVersion: SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
      },
      reason: 'e2e-vai-regression-test',
    },
    {
      id: 'cattle-fleet-local-system/fleet-agent-1.17d80b90a6d2c7ac',
      type: 'event',
      _type: 'dummy_data',
      apiVersion: 'v1',
      metadata: {
        fields: [
          '7m',
          'Normal',
          'Killing',
          'pod/fleet-agent-1',
          'spec.containers{fleet-agent}',
          'kubelet, ip-172-31-2-245.us-east-2.compute.internal',
          'Stopping container fleet-agent',
          '7m',
          1,
          'fleet-agent-1.17d80b90a6d2c7ac',
        ],
        name: 'fleet-agent-1.17d80b90a6d2c7ac',
        namespace: 'cattle-fleet-local-system',
        relationships: null,
        resourceVersion: SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
      },
      reason: 'e2e-vai-regression-test',
    },
    {
      id: 'cattle-fleet-local-system/fleet-agent-2.17d80b90a6d2c7ad',
      type: 'event',
      _type: 'dummy_data',
      apiVersion: 'v1',
      metadata: {
        fields: [
          '7m',
          'Normal',
          'Killing',
          'pod/fleet-agent-2',
          'spec.containers{fleet-agent}',
          'kubelet, ip-172-31-2-245.us-east-2.compute.internal',
          'Stopping container fleet-agent',
          '7m',
          1,
          'fleet-agent-2.17d80b90a6d2c7ad',
        ],
        name: 'fleet-agent-2.17d80b90a6d2c7ad',
        namespace: 'cattle-fleet-local-system',
        relationships: null,
        resourceVersion: SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
      },
      reason: 'e2e-vai-regression-test',
    },
  ],
};
