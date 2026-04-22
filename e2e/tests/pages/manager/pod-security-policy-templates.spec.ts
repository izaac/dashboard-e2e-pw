import { test } from '@/support/fixtures';

test.describe('Pod Security Policy Templates', { tag: ['@manager', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(true, 'All tests disabled upstream (blocked by rancher/dashboard#10187)');

  test('placeholder', async () => {});
});
