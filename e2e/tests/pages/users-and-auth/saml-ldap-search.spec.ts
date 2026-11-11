import { test, expect } from '@/support/fixtures';
import SamlPo from '@/e2e/po/edit/auth/saml.po';
import { EXTENDED } from '@/support/timeouts';

interface AuthConfigPayload {
  displayNameField?: string;
  openLdapConfig?: {
    servers?: string[];
    port?: number;
    serviceAccountDistinguishedName?: string;
    userSearchBase?: string;
  };
}

const TEST_SP_KEY = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIJpg2CvvdYPixWciEiAIMZoWHL+4lEbyfJ33mSplc+B0oAoGCCqGSM49
AwEHoUQDQgAE02wK1B3oZ9eMh7hY7sX5F7Y0y9W8uK1rZ4A3d5m7q2hGv8kL8p4
-----END EC PRIVATE KEY-----`;

const TEST_SP_CERT = `-----BEGIN CERTIFICATE-----
MIICKTCCAc6gAwIBAgIITPtzh/XyrbMwCgYIKoZIzj0EAwIwRjEcMBoGA1UEChMT
cjE4MS5jYXR0bGUtc3lzdGVtMSYwJAYDVQQDEx1jYXR0bGUtc3lzdGVtLnJhbmNo
-----END CERTIFICATE-----`;

const TEST_METADATA_XML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://saml.example.com/entityid" validUntil="2036-11-11T21:53:58.819Z">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>MIIC4jCCAcoCCQC33wnybT5QZDANBgkqhkiG9w0BAQsFADAyMQswCQYDVQQGEwJV</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://mocksaml.com/api/saml/sso"/>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://mocksaml.com/api/saml/sso"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;

const DEFAULT_LDAP_PORT = 389;
const DEFAULT_LDAP_PORT_STRING = '389';
const HTTP_STATUS_OK = 200;
const EXPECTED_ZERO_COUNT = 0;

test.describe('SAML Authentication Provider LDAP Search Gating', { tag: ['@adminUser', '@usersAndAuths'] }, () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('should hide User and Group Search section on ADFS in Community mode', async ({ page, isPrime }) => {
    test.skip(isPrime, 'Validates Community edition gating only');

    const adfsPo = new SamlPo(page, 'adfs');

    await adfsPo.goTo();
    await adfsPo.waitForForm();

    await expect(adfsPo.displayNameInput()).toBeVisible();
    await expect(adfsPo.rancherApiHostInput()).toBeVisible();

    await expect(adfsPo.ldapSearchHeading()).toBeHidden();
    await expect(adfsPo.ldapSearchCheckbox()).toBeHidden();
    await expect(page.getByText('The SAML Protocol does not support search')).toBeHidden();
  });

  test(
    'should display User and Group Search section on ADFS in Prime mode and serialize openLdapConfig',
    { tag: ['@prime'] },
    async ({ page, isPrime }) => {
      test.skip(!isPrime, 'Requires Rancher Prime edition');

      const adfsPo = new SamlPo(page, 'adfs');

      let interceptedPayload: AuthConfigPayload | null = null;

      await page.route('**/v3/adfsConfigs/adfs*', async (route) => {
        const req = route.request();

        if (req.method() === 'PUT') {
          interceptedPayload = req.postDataJSON() as AuthConfigPayload;
          await route.fulfill({ status: HTTP_STATUS_OK, json: req.postDataJSON() });

          return;
        }
        await route.continue();
      });

      await adfsPo.goTo();
      await adfsPo.waitForForm();

      await expect(adfsPo.ldapSearchHeading()).toBeVisible();
      await expect(adfsPo.ldapSearchCheckbox()).toBeVisible();

      await adfsPo.displayNameInput().fill('ADFS Prime Display');
      await adfsPo.userNameInput().fill('name');
      await adfsPo.uidInput().fill('uid');
      await adfsPo.groupsInput().fill('groups');
      await adfsPo.rancherApiHostInput().fill('https://rancher.example.com');
      await adfsPo.privateKeyTextarea().fill(TEST_SP_KEY);
      await adfsPo.certificateTextarea().fill(TEST_SP_CERT);
      await adfsPo.metadataTextarea().fill(TEST_METADATA_XML);

      // Toggle LDAP search and fill details
      await adfsPo.ldapSearchCheckbox().click();
      await expect(adfsPo.ldapHostnameInput()).toBeVisible();

      await adfsPo.ldapHostnameInput().fill('openldap.example.org');
      await adfsPo.ldapPortInput().fill(DEFAULT_LDAP_PORT_STRING);
      await adfsPo.ldapServiceAccountDnInput().fill('cn=admin,dc=example,dc=org');
      await adfsPo.ldapServiceAccountPasswordInput().fill('secretpassword');
      await adfsPo.ldapUserSearchBaseInput().fill('ou=people,dc=example,dc=org');

      await adfsPo.enableButton().click();

      await expect.poll(() => interceptedPayload, { timeout: EXTENDED }).not.toBeNull();
      const payload = interceptedPayload as unknown as AuthConfigPayload;

      expect(payload.openLdapConfig).toBeDefined();
      expect(payload.openLdapConfig?.servers).toEqual(['openldap.example.org']);
      expect(Number(payload.openLdapConfig?.port)).toBe(DEFAULT_LDAP_PORT);
      expect(payload.openLdapConfig?.serviceAccountDistinguishedName).toBe('cn=admin,dc=example,dc=org');
      expect(payload.openLdapConfig?.userSearchBase).toBe('ou=people,dc=example,dc=org');
    },
  );

  test('should submit ADFS configuration without openLdapConfig in Community mode', async ({ page, isPrime }) => {
    test.skip(isPrime, 'Validates Community edition submission only');

    const adfsPo = new SamlPo(page, 'adfs');

    let interceptedPayload: AuthConfigPayload | null = null;

    await page.route('**/v3/adfsConfigs/adfs*', async (route) => {
      const req = route.request();

      if (req.method() === 'PUT') {
        interceptedPayload = req.postDataJSON() as AuthConfigPayload;
        await route.fulfill({ status: HTTP_STATUS_OK, json: req.postDataJSON() });

        return;
      }
      await route.continue();
    });

    await adfsPo.goTo();
    await adfsPo.waitForForm();

    await adfsPo.displayNameInput().fill('ADFS Display Name');
    await adfsPo.userNameInput().fill('name');
    await adfsPo.uidInput().fill('uid');
    await adfsPo.groupsInput().fill('groups');
    await adfsPo.rancherApiHostInput().fill('https://rancher.example.com');
    await adfsPo.privateKeyTextarea().fill(TEST_SP_KEY);
    await adfsPo.certificateTextarea().fill(TEST_SP_CERT);
    await adfsPo.metadataTextarea().fill(TEST_METADATA_XML);

    await adfsPo.enableButton().click();

    await expect.poll(() => interceptedPayload, { timeout: EXTENDED }).not.toBeNull();
    const payload = interceptedPayload as unknown as AuthConfigPayload;

    expect(payload.openLdapConfig).toBeUndefined();
    expect(payload.displayNameField).toBe('ADFS Display Name');
  });

  test('should display User and Group Search section on Shibboleth and toggle LDAP form', async ({ page }) => {
    const shibPo = new SamlPo(page, 'shibboleth');

    await shibPo.goTo();
    await shibPo.waitForForm();

    await expect(shibPo.ldapSearchHeading()).toBeVisible();
    await expect(shibPo.ldapSearchCheckbox()).toBeVisible();
    await expect(shibPo.ldapHostnameInput()).toBeHidden();

    // Toggle on
    await shibPo.ldapSearchCheckbox().click();
    await expect(shibPo.ldapHostnameInput()).toBeVisible();
    await expect(shibPo.ldapPortInput()).toBeVisible();
    await expect(shibPo.ldapServiceAccountDnInput()).toBeVisible();
    await expect(shibPo.ldapUserSearchBaseInput()).toBeVisible();

    // Verify direct/nested group radio option is suppressed for SAML providers
    await expect(shibPo.groupMembershipRadio()).toHaveCount(EXPECTED_ZERO_COUNT);

    // Toggle off
    await shibPo.ldapSearchCheckbox().click();
    await expect(shibPo.ldapHostnameInput()).toBeHidden();
  });

  test('should validate form enable button state when LDAP search is toggled', async ({ page }) => {
    const shibPo = new SamlPo(page, 'shibboleth');

    await shibPo.goTo();
    await shibPo.waitForForm();

    // Fill only required SAML fields
    await shibPo.displayNameInput().fill('Shibboleth Display Name');
    await shibPo.userNameInput().fill('name');
    await shibPo.uidInput().fill('uid');
    await shibPo.groupsInput().fill('groups');
    await shibPo.rancherApiHostInput().fill('https://rancher.example.com');
    await shibPo.privateKeyTextarea().fill(TEST_SP_KEY);
    await shibPo.certificateTextarea().fill(TEST_SP_CERT);
    await shibPo.metadataTextarea().fill(TEST_METADATA_XML);

    // With only SAML fields filled and LDAP disabled, form is valid
    await expect(shibPo.enableButton().self()).toBeEnabled();

    // Toggling LDAP search on makes form invalid until required LDAP fields are provided
    await shibPo.ldapSearchCheckbox().click();
    await expect(shibPo.ldapHostnameInput()).toBeVisible();
    await expect(shibPo.enableButton().self()).toBeDisabled();

    // Fill required LDAP fields
    await shibPo.ldapHostnameInput().fill('openldap.example.org');
    await shibPo.ldapServiceAccountDnInput().fill('cn=admin,dc=example,dc=org');
    await shibPo.ldapServiceAccountPasswordInput().fill('secretpassword');
    await shibPo.ldapUserSearchBaseInput().fill('ou=people,dc=example,dc=org');

    // With LDAP fields filled, form is valid again
    await expect(shibPo.enableButton().self()).toBeEnabled();

    // Toggling LDAP search off removes LDAP validation requirement
    await shibPo.ldapSearchCheckbox().click();
    await expect(shibPo.ldapHostnameInput()).toBeHidden();
    await expect(shibPo.enableButton().self()).toBeEnabled();
  });

  test('should submit Shibboleth configuration with serialized openLdapConfig when LDAP search is enabled', async ({
    page,
  }) => {
    const shibPo = new SamlPo(page, 'shibboleth');

    let interceptedPayload: AuthConfigPayload | null = null;

    await page.route('**/v3/shibbolethConfigs/shibboleth*', async (route) => {
      const req = route.request();

      if (req.method() === 'PUT') {
        interceptedPayload = req.postDataJSON() as AuthConfigPayload;
        await route.fulfill({ status: 200, json: req.postDataJSON() });

        return;
      }
      await route.continue();
    });

    await shibPo.goTo();
    await shibPo.waitForForm();

    await shibPo.displayNameInput().fill('Shibboleth Display Name');
    await shibPo.userNameInput().fill('name');
    await shibPo.uidInput().fill('uid');
    await shibPo.groupsInput().fill('groups');
    await shibPo.rancherApiHostInput().fill('https://rancher.example.com');
    await shibPo.privateKeyTextarea().fill(TEST_SP_KEY);
    await shibPo.certificateTextarea().fill(TEST_SP_CERT);
    await shibPo.metadataTextarea().fill(TEST_METADATA_XML);

    // Toggle OpenLDAP search and fill details
    await shibPo.ldapSearchCheckbox().click();
    await expect(shibPo.ldapHostnameInput()).toBeVisible();

    await shibPo.ldapHostnameInput().fill('openldap.example.org');
    await shibPo.ldapPortInput().fill('389');
    await shibPo.ldapServiceAccountDnInput().fill('cn=admin,dc=example,dc=org');
    await shibPo.ldapServiceAccountPasswordInput().fill('secretpassword');
    await shibPo.ldapUserSearchBaseInput().fill('ou=people,dc=example,dc=org');

    await shibPo.enableButton().click();

    await expect.poll(() => interceptedPayload, { timeout: EXTENDED }).not.toBeNull();
    const payload = interceptedPayload as unknown as AuthConfigPayload;

    expect(payload.openLdapConfig).toBeDefined();
    expect(payload.openLdapConfig?.servers).toEqual(['openldap.example.org']);
    expect(Number(payload.openLdapConfig?.port)).toBe(389);
    expect(payload.openLdapConfig?.serviceAccountDistinguishedName).toBe('cn=admin,dc=example,dc=org');
    expect(payload.openLdapConfig?.userSearchBase).toBe('ou=people,dc=example,dc=org');
  });

  test('should verify SAML providers regression baseline in Community mode', async ({ page }) => {
    // 1. Okta displays User and Group Search
    const oktaPo = new SamlPo(page, 'okta');

    await oktaPo.goTo();
    await oktaPo.waitForForm();
    await expect(oktaPo.ldapSearchHeading()).toBeVisible();
    await expect(oktaPo.ldapSearchCheckbox()).toBeVisible();

    // 2. Keycloak never displays User and Group Search
    const keycloakPo = new SamlPo(page, 'keycloak');

    await keycloakPo.goTo();
    await keycloakPo.waitForForm();
    await expect(keycloakPo.ldapSearchHeading()).toBeHidden();
    await expect(keycloakPo.ldapSearchCheckbox()).toBeHidden();

    // 3. Ping never displays User and Group Search
    const pingPo = new SamlPo(page, 'ping');

    await pingPo.goTo();
    await pingPo.waitForForm();
    await expect(pingPo.ldapSearchHeading()).toBeHidden();
    await expect(pingPo.ldapSearchCheckbox()).toBeHidden();
  });

  // Requires an in-cluster Mock SAML IdP deployment (mock-saml.mock-saml.svc.cluster.local:4000).
  // Verified locally on v2.16-head; skipped in standard CI runs that lack local SAML identity provider infrastructure.
  test.skip('should configure SAML provider against local containerized mock SAML IdP and OpenLDAP', async ({
    page,
    request,
  }) => {
    const response = await request.get('http://mock-saml.mock-saml.svc.cluster.local:4000/api/saml/metadata');
    const liveMetadataXml = await response.text();

    const shibPo = new SamlPo(page, 'shibboleth');

    await shibPo.goTo();
    await shibPo.waitForForm();

    await shibPo.displayNameInput().fill('Shibboleth Local Mock');
    await shibPo.userNameInput().fill('name');
    await shibPo.uidInput().fill('uid');
    await shibPo.groupsInput().fill('groups');
    await shibPo.rancherApiHostInput().fill('https://rancher.example.com');
    await shibPo.privateKeyTextarea().fill(TEST_SP_KEY);
    await shibPo.certificateTextarea().fill(TEST_SP_CERT);
    await shibPo.metadataTextarea().fill(liveMetadataXml);

    await shibPo.ldapSearchCheckbox().click();
    await expect(shibPo.ldapHostnameInput()).toBeVisible();

    await shibPo.ldapHostnameInput().fill('openldap.openldap.svc.cluster.local');
    await shibPo.ldapPortInput().fill('389');
    await shibPo.ldapServiceAccountDnInput().fill('cn=admin,dc=example,dc=org');
    await shibPo.ldapServiceAccountPasswordInput().fill('adminpassword');
    await shibPo.ldapUserSearchBaseInput().fill('ou=people,dc=example,dc=org');

    await expect(shibPo.enableButton().self()).toBeEnabled();
  });
});
