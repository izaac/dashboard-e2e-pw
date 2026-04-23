import { test, expect } from '@/support/fixtures';
import { PersistentVolumeClaimsPagePo } from '@/e2e/po/pages/explorer/persistent-volume-claims.po';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

test.describe('PersistentVolumeClaims', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate persistent volume claims table headers', async ({ page, login }) => {
      await login();
      const pvcPage = new PersistentVolumeClaimsPagePo(page);

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = pvcPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();

      // Remember current group mode, switch to flat list to show Namespace column
      const groupBtn1 = sortableTable.groupByButtons(1);
      const classAttr = (await groupBtn1.getAttribute('class')) ?? '';
      const wasGrouped = classAttr.includes('bg-primary');

      await sortableTable.groupByButtons(0).click();

      const expectedHeaders = [
        'State',
        'Name',
        'Namespace',
        'Status',
        'Volume',
        'Capacity',
        'Access Modes',
        'Storage Class',
        'VolumeAttributesClass',
        'Volume Mode',
        'Age',
      ];
      const headerNames = await sortableTable.headerNames();

      expect(headerNames).toEqual(expectedHeaders);

      // Restore group mode if it was active
      if (wasGrouped) {
        await groupBtn1.click();
      }
    });

    test('validate table is visible', async ({ page, login }) => {
      await login();
      const pvcPage = new PersistentVolumeClaimsPagePo(page);

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = pvcPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
    });

    test('group by namespace shows namespace groups', async ({ page, login }) => {
      // Mock PVC data so group-by has rows to group (upstream uses blueprints for this)
      await page.route('**/v1/persistentvolumeclaims?*', (route) =>
        route.fulfill({
          json: {
            type: 'collection',
            resourceType: 'persistentvolumeclaim',
            count: 1,
            data: [
              {
                id: 'cattle-system/test-pvc',
                type: 'persistentvolumeclaim',
                apiVersion: 'v1',
                kind: 'PersistentVolumeClaim',
                metadata: {
                  name: 'test-pvc',
                  namespace: 'cattle-system',
                  creationTimestamp: '2024-07-05T00:27:43Z',
                  state: { name: 'pending', error: false, transitioning: false },
                },
                spec: {
                  accessModes: ['ReadWriteOnce'],
                  resources: { requests: { storage: '10Gi' } },
                  volumeMode: 'Filesystem',
                },
                status: { phase: 'Pending' },
              },
            ],
          },
        }),
      );

      await login();
      const pvcPage = new PersistentVolumeClaimsPagePo(page);

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = pvcPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.groupByButtons(1).click();

      await expect(sortableTable.groupRows().first()).toBeVisible(SHORT_TIMEOUT_OPT);
    });
  });
});
