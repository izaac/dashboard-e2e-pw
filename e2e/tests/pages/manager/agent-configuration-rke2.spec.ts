import { test } from '@/support/fixtures';

test.describe(
  '[Vue3 Skip]: Agent Configuration for RKE2',
  { tag: ['@manager', '@adminUser', '@clusterConfig'] },
  () => {
    // Serial: vestigial — all tests skipped pending Vue3 port; serial preserved to match upstream describe shape.
    test.describe.configure({ mode: 'serial' });
    test.skip(true, 'All tests disabled upstream (Vue3 skip)');

    // eslint-disable-next-line playwright/expect-expect -- stub body never runs
    test('placeholder', async () => {});
  },
);
