import { test } from '@/support/fixtures';

test.describe('Node Drivers', { tag: ['@manager', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(true, 'All tests disabled upstream (blocked by rancher/dashboard#10275)');

  // eslint-disable-next-line playwright/expect-expect -- stub body never runs
  test('placeholder', async () => {});
});
