import type { Page, WebSocket } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { LONG } from '@/support/timeouts';

const CRD_API_TYPE = 'apiextensions.k8s.io.customresourcedefinitions';
const MORE_RESOURCES = 'More Resources';
const PLURAL = 'qawidgets';
const SINGULAR = 'qawidget';
const KIND = 'QaWidget';
const GADGET_PLURAL = 'qagadgets';
const GADGET_SINGULAR = 'qagadget';
const GADGET_KIND = 'QaGadget';
const SCOPES = ['Namespaced', 'Cluster'] as const;

type CrdScope = (typeof SCOPES)[number];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Navigate to local Cluster Explorer and wait until the Steve schema WebSocket watch is active */
async function openExplorerAndWaitForSchemaWatch(page: Page): Promise<ProductNavPo> {
  const schemaWatchReady = new Promise<void>((resolve) => {
    const onWebSocket = (ws: WebSocket) => {
      if (!ws.url().includes('/k8s/clusters/local/v1/subscribe')) {
        return;
      }

      const onFrame = (frame: { payload: string | Buffer }) => {
        const text = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8');

        if (text.includes('resource.start') && text.includes('"schema"')) {
          ws.off('framereceived', onFrame);
          page.off('websocket', onWebSocket);
          resolve();
        }
      };

      ws.on('framereceived', onFrame);
    };

    page.on('websocket', onWebSocket);
  });

  const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

  await clusterDashboard.goTo();
  await clusterDashboard.waitForPage();
  await schemaWatchReady;

  const productNav = new ProductNavPo(page);

  await expect(productNav.groups().first()).toBeAttached({ timeout: LONG });
  await productNav.navToSideMenuGroupByLabel(MORE_RESOURCES);

  return productNav;
}

const buildCrdPayload = (group: string, plural: string, singular: string, kind: string, scope: CrdScope) => ({
  apiVersion: 'apiextensions.k8s.io/v1',
  kind: 'CustomResourceDefinition',
  metadata: { name: `${plural}.${group}` },
  spec: {
    group,
    scope,
    names: {
      plural,
      singular,
      kind,
      listKind: `${kind}List`,
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
});

// CRD create/delete mutates the cluster API schema registry, so keep these cases serial.
test.describe.configure({ mode: 'serial' });

test.describe('Side navigation: CRD reactivity (issue 16664)', { tag: ['@navigation', '@adminUser'] }, () => {
  for (const scope of SCOPES) {
    test(`New ${scope}-scoped CRD group appears and disappears without reload`, async ({ page, login, rancherApi }) => {
      const group = `qa16664-${scope.toLowerCase()}-${Date.now()}.example.com`;
      const crdName = `${PLURAL}.${group}`;
      const crdPayload = buildCrdPayload(group, PLURAL, SINGULAR, KIND, scope);

      await login();

      const productNav = await openExplorerAndWaitForSchemaWatch(page);

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

        // Leave the CRD list via the side-nav (SPA only) so no watch stays open on the CRD being deleted
        await productNav
          .tabHeaders()
          .first()
          .click({ position: { x: 1, y: 1 } });
        await expect(page).toHaveURL(/\/c\/local\/explorer(#.*)?$/);

        // Delete out-of-band: the group must vanish without a reload
        await rancherApi.deleteRancherResource('v1', CRD_API_TYPE, crdName, false);

        await expect(productNav.sideMenuGroupLocator(group)).toHaveCount(0, { timeout: LONG });
      } finally {
        await rancherApi.deleteRancherResource('v1', CRD_API_TYPE, crdName, false);
        await rancherApi.expectResourceGone('v1', CRD_API_TYPE, crdName);
      }
    });
  }

  test('Adding a second CRD to an existing API group updates the expanded group without reload', async ({
    page,
    login,
    rancherApi,
  }) => {
    const group = `qa16664-multi-${Date.now()}.example.com`;
    const widgetCrdName = `${PLURAL}.${group}`;
    const gadgetCrdName = `${GADGET_PLURAL}.${group}`;
    const widgetPayload = buildCrdPayload(group, PLURAL, SINGULAR, KIND, 'Namespaced');
    const gadgetPayload = buildCrdPayload(group, GADGET_PLURAL, GADGET_SINGULAR, GADGET_KIND, 'Namespaced');

    await login();

    const productNav = await openExplorerAndWaitForSchemaWatch(page);

    await expect(productNav.sideMenuGroupLocator(group)).toHaveCount(0);

    try {
      // First CRD creates the group; no reload or navigation from here on
      await rancherApi.createRancherResource('v1', CRD_API_TYPE, widgetPayload);

      await expect(productNav.sideMenuGroupLocator(group)).toBeVisible({ timeout: LONG });
      await productNav.navToSideMenuGroupByLabel(group);
      await expect(productNav.sideMenuEntryLocator(KIND)).toBeVisible({ timeout: LONG });

      // Second CRD lands in the same, already expanded group
      await rancherApi.createRancherResource('v1', CRD_API_TYPE, gadgetPayload);

      const gadgetEntry = productNav.sideMenuEntryLocator(GADGET_KIND);

      await expect(gadgetEntry).toBeVisible({ timeout: LONG });
      await expect(productNav.sideMenuGroupLocator(group)).toHaveCount(1);
      await expect(productNav.sideMenuEntryLocator(KIND)).toBeVisible();

      await gadgetEntry.click();

      await expect(page).toHaveURL(new RegExp(`/${escapeRegExp(`${group}.${GADGET_SINGULAR}`)}$`));

      // Leave the CRD list via the side-nav (SPA only) so no watch stays open on the CRD being deleted
      await productNav
        .tabHeaders()
        .first()
        .click({ position: { x: 1, y: 1 } });
      await expect(page).toHaveURL(/\/c\/local\/explorer(#.*)?$/);

      // Deleting only the second CRD removes its entry but keeps the group and the first entry
      await rancherApi.deleteRancherResource('v1', CRD_API_TYPE, gadgetCrdName, false);

      await expect(gadgetEntry).toHaveCount(0, { timeout: LONG });
      await expect(productNav.sideMenuGroupLocator(group)).toBeVisible();
      await expect(productNav.sideMenuEntryLocator(KIND)).toBeVisible();

      // Deleting the last CRD removes the group
      await rancherApi.deleteRancherResource('v1', CRD_API_TYPE, widgetCrdName, false);

      await expect(productNav.sideMenuGroupLocator(group)).toHaveCount(0, { timeout: LONG });
    } finally {
      await rancherApi.deleteRancherResource('v1', CRD_API_TYPE, gadgetCrdName, false);
      await rancherApi.deleteRancherResource('v1', CRD_API_TYPE, widgetCrdName, false);
      await rancherApi.expectResourceGone('v1', CRD_API_TYPE, gadgetCrdName);
      await rancherApi.expectResourceGone('v1', CRD_API_TYPE, widgetCrdName);
    }
  });
});
