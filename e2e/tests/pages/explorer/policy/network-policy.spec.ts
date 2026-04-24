import { test, expect } from '@/support/fixtures';
import { NetworkPolicyListPagePo, NetworkPolicyCreateEditPagePo } from '@/e2e/po/pages/explorer/network-policy.po';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

test.describe('NetworkPolicies', { tag: ['@explorer', '@adminUser'] }, () => {
  test('creates a network policy and displays it in the list', async ({ page, login, rancherApi }) => {
    await login();

    const customNetworkPolicyName = `np-${Date.now()}`;
    const namespace = 'default';
    const networkPolicyPage = new NetworkPolicyListPagePo(page);

    await networkPolicyPage.goTo();
    await networkPolicyPage.waitForPage();
    await networkPolicyPage.baseResourceList().masthead().create();

    const createPage = new NetworkPolicyCreateEditPagePo(page);

    await createPage.waitForPage();

    await createPage.nameInput().fill(customNetworkPolicyName);
    await createPage.descriptionInput().fill('Custom Network Policy Description');

    await createPage.enableIngressCheckbox().set();
    await createPage.newNetworkPolicyRuleAddBtn().click();

    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/v1/networking.k8s.io.networkpolicies') && resp.request().method() === 'POST',
    );

    await createPage.formSave().click();

    const resp = await createResponse;

    try {
      expect(resp.status()).toBe(201);

      await networkPolicyPage.waitForPage();
      const sortableTable = networkPolicyPage.list().resourceTable().sortableTable();

      await sortableTable.filter(customNetworkPolicyName);
      await sortableTable.rowElementWithName(customNetworkPolicyName).waitFor(SHORT_TIMEOUT_OPT);
    } finally {
      await rancherApi.deleteRancherResource(
        'v1',
        'networking.k8s.io.networkpolicies',
        `${namespace}/${customNetworkPolicyName}`,
        false,
      );
    }
  });

  test('port value is sent correctly in request payload', async ({ page, login, rancherApi }) => {
    await login();

    const networkPolicyName = `np-port-${Date.now()}`;
    const namespace = 'default';
    const portValue = 8080;
    const networkPolicyPage = new NetworkPolicyListPagePo(page);

    await networkPolicyPage.goTo();
    await networkPolicyPage.waitForPage();
    await networkPolicyPage.baseResourceList().masthead().create();

    const createPage = new NetworkPolicyCreateEditPagePo(page);

    await createPage.waitForPage();

    await createPage.nameInput().fill(networkPolicyName);
    await createPage.enableIngressCheckbox().set();
    await createPage.newNetworkPolicyRuleAddBtn().click();
    await createPage.addAllowedPortButton().click();
    await createPage.ingressRuleItemPortInput(0).fill(portValue.toString());

    // Vue debounce trap: port input debounces $emit('update:value') for 500ms.
    // Blur/Tab does NOT flush the debounce — only elapsed time does.
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(600);

    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/v1/networking.k8s.io.networkpolicies') && resp.request().method() === 'POST',
    );

    await createPage.formSave().click();

    const resp = await createResponse;
    const body = await resp.json();

    try {
      expect(resp.status()).toBe(201);

      expect(body.spec.ingress).toEqual(
        expect.arrayContaining([expect.objectContaining({ ports: [expect.objectContaining({ port: portValue })] })]),
      );

      await networkPolicyPage.waitForPage();
      const sortableTable = networkPolicyPage.list().resourceTable().sortableTable();

      await sortableTable.filter(networkPolicyName);
      await sortableTable.checkLoadingIndicatorNotVisible();
      await expect(sortableTable.rowElements()).toHaveCount(1);
    } finally {
      await rancherApi.deleteRancherResource(
        'v1',
        'networking.k8s.io.networkpolicies',
        `${namespace}/${networkPolicyName}`,
        false,
      );
    }
  });

  test('can delete a network policy', async ({ page, login, rancherApi }) => {
    await login();

    const networkPolicyName = `np-del-${Date.now()}`;
    const namespace = 'default';

    await rancherApi.createRancherResource('v1', 'networking.k8s.io.networkpolicies', {
      metadata: { name: networkPolicyName, namespace },
      spec: { podSelector: {} },
    });

    try {
      const networkPolicyPage = new NetworkPolicyListPagePo(page);

      await networkPolicyPage.goTo();
      await networkPolicyPage.waitForPage();

      const sortableTable = networkPolicyPage.list().resourceTable().sortableTable();

      await sortableTable.filter(networkPolicyName);
      await sortableTable.rowElementWithName(networkPolicyName).waitFor(SHORT_TIMEOUT_OPT);

      const actionMenu = await sortableTable.rowActionMenuOpen(networkPolicyName);

      await actionMenu.getMenuItem('Delete').click();

      const deleteResponse = page.waitForResponse(
        (resp) => resp.url().includes('networking.k8s.io.networkpolicies') && resp.request().method() === 'DELETE',
      );

      await networkPolicyPage.promptRemove().remove();
      await deleteResponse;

      await expect(sortableTable.rowElementWithName(networkPolicyName)).not.toBeAttached(SHORT_TIMEOUT_OPT);
    } finally {
      await rancherApi.deleteRancherResource(
        'v1',
        'networking.k8s.io.networkpolicies',
        `${namespace}/${networkPolicyName}`,
        false,
      );
    }
  });

  test('can open Edit as YAML', async ({ page, login }) => {
    await login();

    const networkPolicyPage = new NetworkPolicyListPagePo(page);

    await networkPolicyPage.goTo();
    await networkPolicyPage.waitForPage();
    await networkPolicyPage.baseResourceList().masthead().create();

    const createPage = new NetworkPolicyCreateEditPagePo(page);

    await createPage.waitForPage();

    await createPage.editAsYamlButton().click();
    await expect(createPage.yamlEditor()).toBeAttached();
  });
});
