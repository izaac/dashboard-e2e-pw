import { CYPRESS_SAFE_RESOURCE_REVISION } from '../../blueprint.utils';

export const fleetContentsGetResponseEmpty = {
  type: 'collection',
  links: { self: '/v1/fleet.cattle.io.contents' },
  createTypes: { 'fleet.cattle.io.content': '/v1/fleet.cattle.io.contents' },
  actions: {},
  resourceType: 'fleet.cattle.io.content',
  revision: CYPRESS_SAFE_RESOURCE_REVISION,
  count: 0,
  data: [],
};

export const fleetContentsResponseSmallSet = {
  type: 'collection',
  links: { self: '/v1/fleet.cattle.io.contents' },
  createTypes: { 'fleet.cattle.io.content': '/v1/fleet.cattle.io.contents' },
  actions: {},
  resourceType: 'fleet.cattle.io.content',
  revision: CYPRESS_SAFE_RESOURCE_REVISION,
  count: 2,
  data: [
    {
      id: 's-65075fe21d0e5087693027a2fdbb5ed559295ed1ffeb5957f98d77decb4a5',
      type: 'fleet.cattle.io.content',
      apiVersion: 'fleet.cattle.io/v1alpha1',
      kind: 'Content',
      metadata: {
        creationTimestamp: '2024-07-05T19:45:20Z',
        fields: ['s-65075fe21d0e5087693027a2fdbb5ed559295ed1ffeb5957f98d77decb4a5', '27h'],
        generation: 1,
        name: 's-65075fe21d0e5087693027a2fdbb5ed559295ed1ffeb5957f98d77decb4a5',
        relationships: null,
        resourceVersion: CYPRESS_SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
        uid: '58394962-322e-42f6-ae08-98b1faeb63f9',
      },
    },
    {
      id: 's-807cc7bcb0de2dae39c913c375f676238d021519258d34913ccc842519c63',
      type: 'fleet.cattle.io.content',
      apiVersion: 'fleet.cattle.io/v1alpha1',
      kind: 'Content',
      metadata: {
        creationTimestamp: '2024-06-27T20:37:41Z',
        fields: ['s-807cc7bcb0de2dae39c913c375f676238d021519258d34913ccc842519c63', '9d'],
        generation: 1,
        name: 's-807cc7bcb0de2dae39c913c375f676238d021519258d34913ccc842519c63',
        relationships: null,
        resourceVersion: CYPRESS_SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
        uid: '7aa06818-19c7-4b90-b386-255b26496aad',
      },
    },
  ],
};
