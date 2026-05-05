import type { RancherApi } from '@/support/fixtures/rancher-api';

interface OrphanCleanupOptions {
  /** API prefix — `v1` (Steve) or `v3` (Norman, default). */
  prefix?: 'v1' | 'v3';
  /** Resource type, e.g. `tokens`, `cloudcredentials`, `management.cattle.io.users`. */
  resourceType: string;
  /** Predicate that returns `true` for items to delete. */
  match: (item: any) => boolean;
  /** Field used to identify resources for deletion. Defaults to `id`. */
  idField?: string;
}

/**
 * List a Rancher resource type, filter by `match`, delete the matches in
 * parallel with `failOnStatusCode = false` so concurrent deletes don't throw
 * on race-deleted items. Returns the list of deleted IDs.
 *
 * Use this for pre-cleaning leftover `e2e-*` resources from prior failed
 * runs at the start of a serial describe block.
 */
export async function cleanupOrphans(rancherApi: RancherApi, options: OrphanCleanupOptions): Promise<string[]> {
  const prefix = options.prefix ?? 'v3';
  const idField = options.idField ?? 'id';

  const resp = await rancherApi.getRancherResource(prefix, options.resourceType, undefined, 0);
  const items: any[] = resp.body?.data ?? [];
  const ids: string[] = items.filter(options.match).map((item) => item[idField] as string);

  await Promise.all(ids.map((id) => rancherApi.deleteRancherResource(prefix, options.resourceType, id, false)));

  return ids;
}

interface HostedClusterCleanupOptions {
  /**
   * Field on a v3 cluster object identifying the provider (e.g. `aksConfig`,
   * `eksConfig`). Used to scope cluster deletion to a specific hosted provider.
   */
  v3ClusterConfigField: string;
  /**
   * Field on the v1 provisioning cluster `spec` (e.g. `aksConfig`, `eksConfig`).
   * Same provider scope, expressed in Steve's representation.
   */
  v1ProvisioningSpecField: string;
  /**
   * Field on the v3 cloud credential identifying its provider (e.g.
   * `azurecredentialConfig`, `amazonec2credentialConfig`).
   */
  credConfigField: string;
  /** Resource name prefix — defaults to `e2e-test-`. */
  namePrefix?: string;
  /** Poll iterations × 1s for waiting on each cluster/credential to reach 404. Defaults to 30. */
  waitForGoneRetries?: number;
}

/**
 * Multi-step cleanup for stale e2e hosted clusters: delete the v3 cluster
 * objects first (the controller stops referencing their cloud credentials),
 * delete the matching v1 provisioning objects that may linger, poll each
 * cluster to 404, then delete the matching cloud credentials and poll those
 * to 404 too.
 *
 * Returns nothing — failures inside `cleanupOrphans` use the non-throwing
 * delete path; the post-delete polls will throw if a resource lingers past
 * the retry budget.
 */
export async function cleanupStaleHostedClusters(
  rancherApi: RancherApi,
  options: HostedClusterCleanupOptions,
): Promise<void> {
  const namePrefix = options.namePrefix ?? 'e2e-test-';
  const retries = options.waitForGoneRetries ?? 30;

  const staleClusterIds = await cleanupOrphans(rancherApi, {
    prefix: 'v3',
    resourceType: 'clusters',
    match: (c) => c.name?.startsWith(namePrefix) && c[options.v3ClusterConfigField],
  });

  await cleanupOrphans(rancherApi, {
    prefix: 'v1',
    resourceType: 'provisioning.cattle.io.clusters',
    match: (c) => c.metadata?.name?.startsWith(namePrefix) && c.spec?.[options.v1ProvisioningSpecField],
  });

  for (const id of staleClusterIds) {
    await rancherApi.waitForRancherResource('v3', 'clusters', id, (r: any) => r.status === 404, retries, 1000);
  }

  const staleCredIds = await cleanupOrphans(rancherApi, {
    prefix: 'v3',
    resourceType: 'cloudcredentials',
    match: (c) => c[options.credConfigField] && c.name?.startsWith(namePrefix),
  });

  for (const id of staleCredIds) {
    await rancherApi.waitForRancherResource('v3', 'cloudcredentials', id, (r: any) => r.status === 404, retries, 1000);
  }
}
