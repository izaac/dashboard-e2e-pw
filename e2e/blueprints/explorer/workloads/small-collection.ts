/**
 * Mock API response with a small collection (3 items) — used to verify
 * pagination is hidden when total rows fit on one page.
 */
export function smallCollectionResponse(resourceType: string) {
  const isPod = resourceType === 'pod';

  const items = Array.from({ length: 3 }, (_, i) => ({
    id: `default/small-item-${i}`,
    type: resourceType,
    metadata: {
      name: `small-item-${i}`,
      namespace: 'default',
      creationTimestamp: new Date().toISOString(),
      uid: `uid-small-${i}`,
      state: { error: false, message: '', name: 'active', transitioning: false },
    },
    spec: isPod ? { containers: [{ name: 'test', image: 'k8s.gcr.io/pause' }] } : {},
    status: isPod ? { phase: 'Running' } : {},
  }));

  return {
    type: 'collection',
    resourceType,
    count: items.length,
    data: items,
  };
}
