import { rmSync } from 'fs';

/**
 * Compute the same host+port auth slug used by auth.setup.ts and
 * playwright.config.ts. Keeping the three in sync ensures teardown removes the
 * exact file the run created.
 */
const authSlug = (): string => {
  const rawBaseUrl = (process.env.TEST_BASE_URL || 'https://localhost:8005').replace(/\/+$/, '');
  const u = new URL(rawBaseUrl);
  const host = u.hostname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');

  return `${host}-${port}`;
};

/**
 * Global teardown — runs once after all projects complete.
 * Removes only this instance's cached storage-state file so each run starts
 * with a fresh login, preventing stale session detection on already-bootstrapped
 * Rancher instances. Scoped to the current host slug (not the whole .auth/
 * directory) so sharded runs that share a bind-mounted checkout do not delete a
 * sibling shard's auth file mid-run.
 */
export default async function globalTeardown() {
  rmSync(`.auth/admin-${authSlug()}.json`, { force: true });
}
