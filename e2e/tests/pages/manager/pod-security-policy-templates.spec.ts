import { test } from '@/support/fixtures';

test.describe('Pod Security Policy Templates', { tag: ['@manager', '@adminUser'] }, () => {
  // Serial: vestigial — all tests skipped pending rancher/dashboard#10187; serial preserved to match upstream describe shape.
  test.describe.configure({ mode: 'serial' });
  test.skip(true, 'All tests disabled upstream (blocked by rancher/dashboard#10187)');

  // eslint-disable-next-line playwright/expect-expect -- stub body never runs
  test('placeholder', async () => {});
});
