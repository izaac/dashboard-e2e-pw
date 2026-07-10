import { rmSync } from 'fs';

/**
 * Global teardown — runs once after all projects complete.
 * Removes cached .auth/ storage state files so each run starts
 * with a fresh login, preventing stale session detection issues
 * on already-bootstrapped Rancher instances.
 */
export default async function globalTeardown() {
  rmSync('.auth', { recursive: true, force: true });
}
