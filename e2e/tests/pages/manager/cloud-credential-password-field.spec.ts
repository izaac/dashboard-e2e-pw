import { test, expect } from '@/support/fixtures';
import { nodeDriveResponse } from '@/e2e/tests/pages/manager/mock-responses';
import CloudCredentialsPagePo from '@/e2e/po/pages/cluster-manager/cloud-credentials.po';

// Regression coverage for rancher/dashboard issue 16702: password-type cloud credential fields
// for imported node drivers must render as masked inputs on the create form. The imported
// driver and its credential schema are supplied via route mocks so no external driver binary
// is required; the real generic cloud credential component is exercised end to end.
const DRIVER = 'fsas';

const PASSWORD_FIELDS = ['credentialsPassword', 'slesRegistrationCode', 'sshPassword'];
const TEXT_FIELDS = ['apiUrl', 'credentialsUsername', 'dnsIp', 'ntpUrl', 'slesRegistrationEmail', 'tenantUuid'];

const passwordField = (type: string) => ({
  type,
  nullable: true,
  create: true,
  update: true,
});

const credentialConfigSchema = {
  id: `${DRIVER}credentialconfig`,
  type: 'schema',
  baseType: 'schema',
  links: { self: `https://localhost:8005/v3/schemas/${DRIVER}credentialconfig` },
  resourceFields: {
    apiUrl: passwordField('string'),
    credentialsPassword: passwordField('password'),
    credentialsUsername: passwordField('string'),
    dnsIp: passwordField('string'),
    ntpUrl: passwordField('string'),
    slesRegistrationCode: passwordField('password'),
    slesRegistrationEmail: passwordField('string'),
    sshPassword: passwordField('password'),
    tenantUuid: passwordField('string'),
  },
};

test.describe('Cloud credential password fields', { tag: ['@manager', '@adminUser'] }, () => {
  test('password-type fields for an imported node driver render as masked inputs', async ({ login, page }) => {
    let createRequestBody: any = null;

    // Routes must be registered before login so the nodedrivers prefetch is mocked.
    await page.route('**/v1/management.cattle.io.nodedrivers*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      body.data = nodeDriveResponse(true, DRIVER).data;
      await route.fulfill({ json: body });
    });

    // Inject the driver's credential config into the norman cloudcredential schema so the subtype renders.
    await page.route('**/v3/schemas/cloudcredential', async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      body.resourceFields = body.resourceFields || {};
      body.resourceFields[`${DRIVER}credentialConfig`] = {
        type: `${DRIVER}credentialconfig`,
        nullable: true,
        create: true,
        update: true,
      };
      await route.fulfill({ json: body });
    });

    await page.route('**/v3/schemas/*credentialconfig*', async (route) => {
      await route.fulfill({ json: credentialConfigSchema });
    });

    // The mocked driver advertises an external UI component; stub it so nothing hangs.
    await page.route(`**/${DRIVER}.github.io/**`, (route) => route.fulfill({ status: 200, body: '' }));

    // Capture the create request so we can assert the masked values are submitted intact.
    await page.route(/\/v3\/cloudcredentials(\?|$)/i, async (route) => {
      if (route.request().method() === 'POST') {
        createRequestBody = route.request().postDataJSON();
        await route.fulfill({
          json: {
            ...createRequestBody,
            id: 'cattle-global-data:cc-16702',
            type: 'cloudCredential',
            links: { self: '/v3/cloudCredentials/cattle-global-data:cc-16702' },
          },
        });
      } else {
        await route.continue();
      }
    });

    await login();

    const cloudCreds = new CloudCredentialsPagePo(page);

    await cloudCreds.goTo();
    await cloudCreds.waitForPage();
    await cloudCreds.create();
    await cloudCreds.createEditCloudCreds().waitForPage();

    await cloudCreds.createEditCloudCreds().cloudServiceOptions().findSubTypeByName(DRIVER).click();

    for (const key of PASSWORD_FIELDS) {
      await expect(page.getByLabel(key, { exact: true })).toHaveAttribute('type', 'password');
    }

    for (const key of TEXT_FIELDS) {
      await expect(page.getByLabel(key, { exact: true })).toHaveAttribute('type', 'text');
    }

    // Masking must not alter the submitted value: the create request should carry what was typed.
    const submitted: Record<string, string> = {
      credentialsPassword: 'SuperSecretValue123',
      slesRegistrationCode: 'SLES-REG-0000-1111',
      sshPassword: 'sshSecret456',
    };

    for (const [key, value] of Object.entries(submitted)) {
      await page.getByLabel(key, { exact: true }).fill(value);
    }

    await cloudCreds.createEditCloudCreds().nameNsDescription().name().set('e2e-16702');
    await cloudCreds.createEditCloudCreds().saveCreateForm().cruResource().saveOrCreate().click();

    await expect.poll(() => createRequestBody).not.toBeNull();

    const submittedConfig = createRequestBody[`${DRIVER}credentialConfig`];

    for (const [key, value] of Object.entries(submitted)) {
      expect(submittedConfig[key]).toBe(value);
    }
  });
});
