import { test } from '@/support/fixtures';

test.describe('[Vue3 Skip]: V2 monitoring Chart', { tag: ['@charts', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  // eslint-disable-next-line playwright/expect-expect -- stub body never runs
  test('every file must have a test...', async () => {
    // Placeholder — original tests are skipped pending Vue3 migration
  });
});
