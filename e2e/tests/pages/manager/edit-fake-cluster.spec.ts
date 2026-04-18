import { test } from '@/support/fixtures';

test.describe('Cluster Edit (Fake DO cluster)', { tag: ['@manager', '@adminUser'] }, () => {
  test.skip(
    true,
    'Requires fake-cluster blueprint (2700+ line mock infrastructure with 20+ route intercepts). Port nav/fake-cluster.ts first.',
  );

  test('Clearing a registry auth item should retain its authentication ID', async () => {});

  test('documentation link in editing a cluster should open in a new tab', async () => {});
});
