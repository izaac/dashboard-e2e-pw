import { SAFE_RESOURCE_REVISION } from '../../blueprint.utils';

export const roleBindingGetResponseEmpty = {
  type: 'collection',
  links: { self: 'https://yonasb29head.qa.rancher.space/v1/rbac.authorization.k8s.io.rolebindings' },
  createTypes: {
    'rbac.authorization.k8s.io.rolebinding':
      'https://yonasb29head.qa.rancher.space/v1/rbac.authorization.k8s.io.rolebindings',
  },
  actions: {},
  resourceType: 'rbac.authorization.k8s.io.rolebinding',
  revision: SAFE_RESOURCE_REVISION,
  count: 0,
  data: [],
};

export const roleBindingResponseSmallSet = {
  type: 'collection',
  links: { self: 'https://yonasb29head.qa.rancher.space/v1/rbac.authorization.k8s.io.rolebindings' },
  createTypes: {
    'rbac.authorization.k8s.io.rolebinding':
      'https://yonasb29head.qa.rancher.space/v1/rbac.authorization.k8s.io.rolebindings',
  },
  actions: {},
  resourceType: 'rbac.authorization.k8s.io.rolebinding',
  revision: SAFE_RESOURCE_REVISION,
  count: 3,
  data: [
    {
      id: 'cluster-fleet-default-c-7h4dt-d2a039d07d4b/request-frnrr',
      type: 'rbac.authorization.k8s.io.rolebinding',
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        creationTimestamp: '2024-06-28T19:40:59Z',
        fields: [
          'request-frnrr',
          'ClusterRole/fleet-bundle-deployment',
          '8d',
          '',
          '',
          'cluster-fleet-default-c-7h4dt-d2a039d07d4b/request-frnrr-8e2c5553-bd20-44a4-94b1-552b07f6abed',
        ],
        finalizers: ['wrangler.cattle.io/auth-prov-v2-rb'],
        labels: {
          'fleet.cattle.io/managed': 'true',
          'objectset.rio.cattle.io/hash': 'adcc7c97783d5a2fc193934050368eeedf0a6e5a',
        },
        name: 'request-frnrr',
        namespace: 'cluster-fleet-default-c-7h4dt-d2a039d07d4b',
        resourceVersion: SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
        uid: '020198ab-9d82-44f3-8c1b-afefb65bb207',
      },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'fleet-bundle-deployment' },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'request-frnrr-8e2c5553-bd20-44a4-94b1-552b07f6abed',
          namespace: 'cluster-fleet-default-c-7h4dt-d2a039d07d4b',
        },
      ],
    },
    {
      id: 'cluster-fleet-default-c-9khnf-46795bb742fd/request-5sz89',
      type: 'rbac.authorization.k8s.io.rolebinding',
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        creationTimestamp: '2024-07-05T19:57:45Z',
        fields: [
          'request-5sz89',
          'ClusterRole/fleet-bundle-deployment',
          '27h',
          '',
          '',
          'cluster-fleet-default-c-9khnf-46795bb742fd/request-5sz89-2177abef-5641-4730-82c9-0ff7a3504c99',
        ],
        finalizers: ['wrangler.cattle.io/auth-prov-v2-rb'],
        labels: {
          'fleet.cattle.io/managed': 'true',
          'objectset.rio.cattle.io/hash': '7c278d92d2db9684224a67e8d80bf3ff59d79229',
        },
        name: 'request-5sz89',
        namespace: 'cluster-fleet-default-c-9khnf-46795bb742fd',
        resourceVersion: SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
        uid: '0d74e4e4-133c-4a78-abe9-16d0488692bc',
      },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'fleet-bundle-deployment' },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'request-5sz89-2177abef-5641-4730-82c9-0ff7a3504c99',
          namespace: 'cluster-fleet-default-c-9khnf-46795bb742fd',
        },
      ],
    },
    {
      id: 'kube-system/rke2-ingress-nginx',
      type: 'rbac.authorization.k8s.io.rolebinding',
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        annotations: {
          'meta.helm.sh/release-name': 'rke2-ingress-nginx',
          'meta.helm.sh/release-namespace': 'kube-system',
        },
        creationTimestamp: '2024-06-27T20:21:36Z',
        fields: ['rke2-ingress-nginx', 'Role/rke2-ingress-nginx', '9d', '', '', 'kube-system/rke2-ingress-nginx'],
        finalizers: ['wrangler.cattle.io/auth-prov-v2-rb'],
        labels: { 'app.kubernetes.io/managed-by': 'Helm' },
        name: 'rke2-ingress-nginx',
        namespace: 'kube-system',
        resourceVersion: SAFE_RESOURCE_REVISION,
        state: { error: false, message: 'Resource is current', name: 'active', transitioning: false },
        uid: 'e3156530-f58e-4ef0-b80b-46fe4cc194d9',
      },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'rke2-ingress-nginx' },
      subjects: [{ kind: 'ServiceAccount', name: 'rke2-ingress-nginx', namespace: 'kube-system' }],
    },
  ],
};
