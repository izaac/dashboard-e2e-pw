/**
 * Generic small-collection mock response for pagination-hidden tests.
 * Each workload type reuses this factory — only the resourceType differs.
 *
 * Includes spec.containers + status so the Rancher UI doesn't crash
 * when rendering pod image columns or status badges.
 */
export function smallCollectionResponse(resourceType: string, count = 3) {
  return {
    type: 'collection',
    resourceType,
    count,
    data: Array.from({ length: count }, (_, i) => ({
      id: `default/mock-${i + 1}`,
      type: resourceType,
      metadata: {
        name: `mock-${i + 1}`,
        namespace: 'default',
        resourceVersion: '1',
      },
      spec: {
        containers: [{ name: 'mock', image: 'nginx:latest' }],
        template: { spec: { containers: [{ name: 'mock', image: 'nginx:latest' }] } },
      },
      status: { phase: 'Running' },
      state: { name: 'active', error: false, transitioning: false, message: '' },
    })),
  };
}
