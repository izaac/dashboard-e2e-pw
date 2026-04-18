import { test } from '@/support/fixtures';

test.describe(
  '[Vue3 Skip]: Agent Configuration for RKE2',
  { tag: ['@manager', '@adminUser', '@clusterConfig'] },
  () => {
    test.skip(true, 'All tests disabled upstream (Vue3 skip)');

    test('placeholder', async () => {});
  },
);
