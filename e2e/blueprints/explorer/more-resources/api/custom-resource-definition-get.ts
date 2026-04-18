import { CYPRESS_SAFE_RESOURCE_REVISION } from '../../../blueprint.utils';

export const crdsGetResponseSmallSet = {
  type: 'collection',
  links: { self: '/v1/apiextensions.k8s.io.customresourcedefinitions' },
  createTypes: {
    'apiextensions.k8s.io.customresourcedefinition': '/v1/apiextensions.k8s.io.customresourcedefinitions',
  },
  actions: {},
  resourceType: 'apiextensions.k8s.io.customresourcedefinition',
  revision: CYPRESS_SAFE_RESOURCE_REVISION,
  count: 2,
  data: [
    {
      id: 'users.management.cattle.io',
      type: 'apiextensions.k8s.io.customresourcedefinition',
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: {
        creationTimestamp: '2024-06-27T20:32:20Z',
        fields: ['users.management.cattle.io', '2024-06-27T20:32:20Z'],
        generation: 1,
        name: 'users.management.cattle.io',
        relationships: null,
        resourceVersion: CYPRESS_SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'CRD is established', name: 'active', transitioning: false },
        uid: 'c27f4c68-da43-4361-bb71-fc8aa111a313',
      },
      spec: {
        conversion: { strategy: 'None' },
        group: 'management.cattle.io',
        names: { kind: 'User', listKind: 'UserList', plural: 'users', singular: 'user' },
        scope: 'Cluster',
      },
    },
    {
      id: 'volumesnapshotclasses.snapshot.storage.k8s.io',
      type: 'apiextensions.k8s.io.customresourcedefinition',
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: {
        creationTimestamp: '2024-06-27T20:20:49Z',
        fields: ['volumesnapshotclasses.snapshot.storage.k8s.io', '2024-06-27T20:20:49Z'],
        generation: 1,
        name: 'volumesnapshotclasses.snapshot.storage.k8s.io',
        relationships: null,
        resourceVersion: CYPRESS_SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'CRD is established', name: 'active', transitioning: false },
        uid: '5a36103d-b699-4d33-b154-5e8581821447',
      },
      spec: {
        conversion: { strategy: 'None' },
        group: 'snapshot.storage.k8s.io',
        names: {
          kind: 'VolumeSnapshotClass',
          listKind: 'VolumeSnapshotClassList',
          plural: 'volumesnapshotclasses',
          singular: 'volumesnapshotclass',
        },
        scope: 'Cluster',
      },
    },
  ],
};
