import { CYPRESS_SAFE_RESOURCE_REVISION } from '../../../blueprint.utils';

export const horizontalpodautoscalerGetResponseEmpty = {
  type: 'collection',
  links: { self: 'https://yonasb29head.qa.rancher.space/v1/autoscaling.horizontalpodautoscalers' },
  createTypes: {
    'autoscaling.horizontalpodautoscaler':
      'https://yonasb29head.qa.rancher.space/v1/autoscaling.horizontalpodautoscalers',
  },
  actions: {},
  resourceType: 'autoscaling.horizontalpodautoscaler',
  revision: CYPRESS_SAFE_RESOURCE_REVISION,
  count: 0,
  data: [],
};

export const horizontalpodautoscalerGetResponseSmallSet = {
  type: 'collection',
  links: { self: 'https://yonasb29head.qa.rancher.space/v1/autoscaling.horizontalpodautoscalers' },
  createTypes: {
    'autoscaling.horizontalpodautoscaler':
      'https://yonasb29head.qa.rancher.space/v1/autoscaling.horizontalpodautoscalers',
  },
  actions: {},
  resourceType: 'autoscaling.horizontalpodautoscaler',
  revision: CYPRESS_SAFE_RESOURCE_REVISION,
  count: 1,
  data: [
    {
      id: 'cattle-system/test',
      type: 'autoscaling.horizontalpodautoscaler',
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        annotations: { 'field.cattle.io/description': 'test' },
        creationTimestamp: '2024-07-04T19:15:24Z',
        fields: ['test', 'Deployment/rancher', '\u003cunknown\u003e/80%', '1', 10, 3, '3m18s'],
        name: 'test',
        namespace: 'cattle-system',
        relationships: null,
        resourceVersion: '3839186',
        state: {
          error: true,
          message: 'the HPA was unable to compute the replica count',
          name: 'pending',
          transitioning: false,
        },
        uid: 'eee41148-d897-496f-abf6-539e842a6673',
      },
      spec: {
        maxReplicas: 10,
        metrics: [
          { resource: { name: 'cpu', target: { averageUtilization: 80, type: 'Utilization' } }, type: 'Resource' },
        ],
        minReplicas: 1,
        scaleTargetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: 'rancher' },
      },
      status: {
        conditions: [],
        currentMetrics: null,
        currentReplicas: 3,
        desiredReplicas: 0,
      },
    },
  ],
};
