import type { RancherApi } from '@/support/fixtures/rancher-api';

export type Restore = () => Promise<void>;

interface SnapshotOptions {
  /** API prefix — `v1` (Steve, default) or `v3` (Norman). */
  prefix?: 'v1' | 'v3';
  /** Resource type override; defaults to the standard setting type for the prefix. */
  resourceType?: string;
}

/**
 * Snapshot a Rancher setting and return a function that restores it.
 *
 * - `v1` (Steve): full-body snapshot. The restorer fetches a fresh copy to
 *   pick up the latest `resourceVersion` (optimistic concurrency), then
 *   writes the captured body back.
 * - `v3` (Norman): value-only snapshot. The restorer fetches the current
 *   body and overrides just `value`, preserving any server-added fields.
 *
 * Settings that didn't exist at snapshot time return a no-op restorer.
 */
export async function snapshotSetting(
  rancherApi: RancherApi,
  name: string,
  options: SnapshotOptions = {},
): Promise<Restore> {
  const prefix = options.prefix ?? 'v1';
  const resourceType = options.resourceType ?? (prefix === 'v3' ? 'setting' : 'management.cattle.io.settings');

  const resp = await rancherApi.getRancherResource(prefix, resourceType, name, 0);

  if (resp.status === 404) {
    return async () => {
      // Setting was absent at snapshot time — nothing to restore.
    };
  }

  const original = structuredClone(resp.body);

  return async () => {
    const fresh = await rancherApi.getRancherResource(prefix, resourceType, name, 0);

    if (fresh.status === 404) {
      return; // Setting is gone; nothing to restore against.
    }

    if (prefix === 'v1') {
      original.metadata.resourceVersion = fresh.body.metadata.resourceVersion;
      await rancherApi.setRancherResource(prefix, resourceType, name, original);
    } else {
      await rancherApi.setRancherResource(prefix, resourceType, name, { ...fresh.body, value: original.value });
    }
  };
}
