import { test, expect } from '@/support/fixtures';
import OpenLdapPo from '@/e2e/po/edit/auth/openldap.po';

// Requires an in-cluster OpenLDAP deployment and network service (openldap.openldap.svc.cluster.local:389).
// Verified locally on v2.16-head (all 4 tests passing); skipped in standard CI runs that lack a containerized LDAP daemon.
test.describe.skip('OpenLDAP Principal Identifier Attributes', { tag: ['@adminUser', '@usersAndAuths'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test.afterAll(async ({ rancherApi }) => {
    await rancherApi.deleteRancherResource('v3', 'authConfigs', 'openldap', false);
  });

  test('should render User and Group Identifier Attribute inputs as editable in create mode', async ({ page }) => {
    const openLdapPo = new OpenLdapPo(page);

    await openLdapPo.goTo();
    await openLdapPo.waitForPage();

    await expect(openLdapPo.userIdAttributeInput()).toBeVisible();
    await expect(openLdapPo.userIdAttributeInput()).toBeEnabled();
    await expect(openLdapPo.groupIdAttributeInput()).toBeVisible();
    await expect(openLdapPo.groupIdAttributeInput()).toBeEnabled();
  });

  test('should enable OpenLDAP provider with custom identifier attributes uid and cn', async ({ page }) => {
    const openLdapPo = new OpenLdapPo(page);

    await openLdapPo.goTo();
    await openLdapPo.waitForForm();

    await openLdapPo.nameInput().fill('openldap');
    await openLdapPo.hostnameInput().fill('openldap.openldap.svc.cluster.local');
    await openLdapPo.portInput().fill('389');
    await openLdapPo.serviceAccountDnInput().fill('cn=admin,dc=example,dc=org');
    await openLdapPo.serviceAccountPasswordInput().fill('adminpassword');
    await openLdapPo.userSearchBaseInput().fill('ou=people,dc=example,dc=org');
    await openLdapPo.groupSearchBaseInput().fill('ou=groups,dc=example,dc=org');
    await openLdapPo.userIdAttributeInput().fill('uid');
    await openLdapPo.groupIdAttributeInput().fill('cn');
    await openLdapPo.testUsernameInput().fill('johndoe');
    await openLdapPo.testPasswordInput().fill('password123');

    await openLdapPo.enableButton().click();

    await expect(page).toHaveURL(/\/c\/local\/auth\/config$/);
  });

  test('should lock User and Group Identifier Attribute inputs when editing an enabled OpenLDAP provider', async ({
    page,
  }) => {
    const openLdapPo = new OpenLdapPo(page, '/c/local/auth/config/openldap');

    await openLdapPo.goTo();
    await openLdapPo.waitForPage();

    await openLdapPo.editConfigButton().click();
    await expect(page).toHaveURL(/\/openldap\?mode=edit/);
    await openLdapPo.waitForForm();

    await expect(openLdapPo.userIdAttributeInput()).toBeDisabled();
    await expect(openLdapPo.groupIdAttributeInput()).toBeDisabled();
    await expect(openLdapPo.hostnameInput()).toBeEnabled();
  });

  test('should disable and clean up OpenLDAP auth config', async ({ page, rancherApi }) => {
    await rancherApi.createRancherResource('v3', 'authConfigs/openldap?action=disable', {}, false);
    await rancherApi.deleteRancherResource('v3', 'authConfigs', 'openldap', false);

    const authPage = new OpenLdapPo(page, '/c/local/auth/config');

    await authPage.goTo();
    await expect(page).toHaveURL(/\/c\/local\/auth\/config$/);
    await expect(page.getByText('No external providers configured')).toBeVisible();
  });
});
