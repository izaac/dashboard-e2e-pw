import { test, expect } from '@/support/fixtures';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { LONG } from '@/support/timeouts';

const CRD_API_TYPE = 'apiextensions.k8s.io.customresourcedefinitions';
const MORE_RESOURCES = 'More Resources';
const PLURAL = 'qawidgets';
const SINGULAR = 'qawidget';
const KIND = 'QaWidget';
const SCOPES = ['Namespaced', 'Cluster'] as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// CRD create/delete mutates the cluster API schema registry, so keep these cases serial.
test.describe.configure({ mode: 'serial' });

test.describe('Side navigation: CRD reactivity (issue 16664)', { tag: ['@navigation', '@adminUser'] }, () => {
  for (const scope of SCOPES) {
    test(`New ${scope}-scoped CRD group appears and disappears without reload`, async ({ page, login, rancherApi }) => {
      const group = `qa16664-${scope.toLowerCase()}-${Date.now()}.example.com`;
      const crdName = `${PLURAL}.${group}`;
      const crdPayload = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: { name: crdName },
        spec: {
          group,
          scope,
          names: {
            plural: PLURAL,
            singular: SINGULAR,
            kind: KIND,
            listKind: `${KIND}List`,
          },
          versions: [
            {
              name: 'v1',
              served: true,
              storage: true,
              schema: {
                openAPIV3Schema: {
                  type: 'object',
                  properties: {
                    spec: { type: 'object', 'x-kubernetes-preserve-unknown-fields': true },
                  },
                },
              },
            },
          ],
        },
      };

      await login();

      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();

      const productNav = new ProductNavPo(page);

      await expect(productNav.groups().first()).toBeAttached({ timeout: LONG });
      await productNav.navToSideMenuGroupByLabel(MORE_RESOURCES);

      // The new API group must not exist before the CRD is created
      await expect(productNav.sideMenuGroupLocator(group)).toHaveCount(0);

      try {
        // Create the CRD out-of-band: no page reload or navigation from here on
        await rancherApi.createRancherResource('v1', CRD_API_TYPE, crdPayload);

        // The side nav must pick up the new API group reactively
        await expect(productNav.sideMenuGroupLocator(group)).toBeVisible({ timeout: LONG });

        await productNav.navToSideMenuGroupByLabel(group);

        // Entry label is the pluralised kind (e.g. "QaWidgets"), so match by substring
        const entry = productNav.sideMenuEntryLocator(KIND);

        await expect(entry).toBeVisible({ timeout: LONG });
        await entry.click();

        await expect(page).toHaveURL(new RegExp(`/${escapeRegExp(`${group}.${SINGULAR}`)}$`));

        // Delete out-of-band: the group must vanish without a reload
        await rancherApi.deleteRancherResource('v1', CRD_API_TYPE, crdName, false);

        await expect(productNav.sideMenuGroupLocator(group)).toHaveCount(0, { timeout: LONG });
      } finally {
        await rancherApi.deleteRancherResource('v1', CRD_API_TYPE, crdName, false);
        await rancherApi.expectResourceGone('v1', CRD_API_TYPE, crdName);
      }
    });
  }
});
