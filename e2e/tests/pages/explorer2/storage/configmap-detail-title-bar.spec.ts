import { test, expect } from '@/support/fixtures';
import { ConfigMapDetailPagePo } from '@/e2e/po/pages/explorer/configmaps.po';

const CLUSTER = 'local';
const NAMESPACE = 'default';
const MAX_BADGE_GAP_PX = 20;

const variants = [
  { label: 'a short resource name', name: `a${Date.now()}` },
  {
    label: 'a long resource name',
    name: `e2e-long-configmap-name-that-should-truncate-with-ellipsis-${Date.now()}`,
  },
];

test.describe('ConfigMap detail title bar', { tag: ['@explorer2', '@adminUser', '@standardUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  for (const variant of variants) {
    test(`keeps the state badge adjacent to ${variant.label}`, async ({ page, rancherApi }) => {
      const name = variant.name;

      await rancherApi.createConfigMap(NAMESPACE, name);

      try {
        const detail = new ConfigMapDetailPagePo(page, CLUSTER, NAMESPACE, name);

        await detail.goTo();
        await detail.waitForPage();

        await expect(detail.resourceName()).toBeVisible();
        await expect(detail.badgeState()).toBeVisible();

        const nameBox = await detail.resourceName().boundingBox();
        const badgeBox = await detail.badgeState().boundingBox();

        expect(nameBox).not.toBeNull();
        expect(badgeBox).not.toBeNull();

        // Guards .resource-name from flex-growing and pushing the badge to the
        // far right of the row when the name is short.
        const gap = badgeBox!.x - (nameBox!.x + nameBox!.width);

        expect(gap).toBeLessThan(MAX_BADGE_GAP_PX);
      } finally {
        await rancherApi.deleteRancherResource('v1', 'configmaps', `${NAMESPACE}/${name}`, false);
      }
    });
  }
});
