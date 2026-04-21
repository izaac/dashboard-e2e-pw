import { test, expect } from '@/support/fixtures';
import CloudCredentialsPagePo from '@/e2e/po/pages/cluster-manager/cloud-credentials.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';

test.describe('Cloud Credentials', { tag: ['@manager', '@adminUser'] }, () => {
  test('can see error when authentication fails', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const cloudCredentialName = rancherApi.createE2EResourceName('cc-err');
    const cloudCredentialsPage = new CloudCredentialsPagePo(page);

    await cloudCredentialsPage.goTo();
    await cloudCredentialsPage.waitForPage();
    await cloudCredentialsPage.create();
    await cloudCredentialsPage.createEditCloudCreds().waitForPage();
    await cloudCredentialsPage.createEditCloudCreds().cloudServiceOptions().selectSubTypeByIndex(0).click();
    await cloudCredentialsPage.createEditCloudCreds().nameNsDescription().name().set(cloudCredentialName);
    await cloudCredentialsPage
      .createEditCloudCreds()
      .nameNsDescription()
      .description()
      .set(`${cloudCredentialName}-description`);
    await cloudCredentialsPage.createEditCloudCreds().accessKey().set(envMeta.awsAccessKey!);
    await cloudCredentialsPage.createEditCloudCreds().secretKey().set(`${envMeta.awsSecretKey}abc`);
    await cloudCredentialsPage.createEditCloudCreds().defaultRegion().checkOptionSelected('us-west-2');
    await cloudCredentialsPage.createEditCloudCreds().saveCreateForm().cruResource().saveOrCreate().click();

    await expect(cloudCredentialsPage.createEditCloudCreds().errorBanner().banner()).toContainText(
      'Authentication test failed, please check your credentials',
    );
  });

  test('can create aws cloud credentials', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const cloudCredentialName = rancherApi.createE2EResourceName('cc-create');
    const cloudCredentialsPage = new CloudCredentialsPagePo(page);
    let cloudcredentialId = '';

    try {
      await cloudCredentialsPage.goTo();
      await cloudCredentialsPage.waitForPage();
      await cloudCredentialsPage.create();
      await cloudCredentialsPage.createEditCloudCreds().waitForPage();
      await cloudCredentialsPage.createEditCloudCreds().cloudServiceOptions().selectSubTypeByIndex(0).click();
      await cloudCredentialsPage.createEditCloudCreds().waitForPage('type=aws');
      await cloudCredentialsPage
        .createEditCloudCreds()
        .nameNsDescription()
        .description()
        .set(`${cloudCredentialName}-description`);
      await cloudCredentialsPage.createEditCloudCreds().accessKey().set(envMeta.awsAccessKey!);
      await cloudCredentialsPage.createEditCloudCreds().secretKey().set(envMeta.awsSecretKey!);
      await cloudCredentialsPage.createEditCloudCreds().defaultRegion().checkOptionSelected('us-west-2');

      // Name is mandatory — verify placeholder has no "optional"
      const placeholder = await cloudCredentialsPage
        .createEditCloudCreds()
        .nameNsDescription()
        .name()
        .getAttributeValue('placeholder');

      expect(placeholder).not.toContain('optional');

      await cloudCredentialsPage
        .createEditCloudCreds()
        .saveCreateForm()
        .cruResource()
        .saveOrCreate()
        .expectToBeDisabled();
      await cloudCredentialsPage.createEditCloudCreds().nameNsDescription().name().set(cloudCredentialName);
      await cloudCredentialsPage
        .createEditCloudCreds()
        .saveCreateForm()
        .cruResource()
        .saveOrCreate()
        .expectToBeEnabled();

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/cloudcredentials') && resp.request().method() === 'POST',
        { timeout: 15000 },
      );

      await cloudCredentialsPage.createEditCloudCreds().saveCreateForm().cruResource().saveOrCreate().click();
      const response = await responsePromise;

      expect(response.status()).toBe(201);
      const body = await response.json();

      cloudcredentialId = body.id;

      await cloudCredentialsPage.waitForPage();
      await expect(cloudCredentialsPage.list().details(cloudCredentialName, 2)).toBeVisible();
    } finally {
      if (cloudcredentialId) {
        await rancherApi.deleteRancherResource('v3', 'cloudCredentials', cloudcredentialId, false);
      }
    }
  });

  test('can edit cloud credentials', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const cloudCredentialName = rancherApi.createE2EResourceName('cc-edit');
    const cloudCredentialsPage = new CloudCredentialsPagePo(page);
    let credId = '';

    try {
      const createResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'provisioning.cattle.io/cloud-credential',
        metadata: { generateName: 'cc-', namespace: 'fleet-default' },
        _name: cloudCredentialName,
        annotations: { 'provisioning.cattle.io/driver': 'amazonec2' },
        amazonec2credentialConfig: {
          accessKey: envMeta.awsAccessKey,
          secretKey: envMeta.awsSecretKey,
        },
        _type: 'provisioning.cattle.io/cloud-credential',
        name: cloudCredentialName,
      });

      credId = createResp.body.id;

      await cloudCredentialsPage.goTo();
      await cloudCredentialsPage.waitForPage();

      const actionMenu = await cloudCredentialsPage.list().actionMenu(cloudCredentialName);

      await actionMenu.getMenuItem('Edit Config').click();
      await cloudCredentialsPage.createEditCloudCreds(credId).waitForPage('mode=edit');

      await cloudCredentialsPage
        .createEditCloudCreds()
        .nameNsDescription()
        .name()
        .set(`${cloudCredentialName}-name-edit`);
      await cloudCredentialsPage
        .createEditCloudCreds()
        .nameNsDescription()
        .description()
        .set(`${cloudCredentialName}-description-edit`);

      // Edit page shows Key-Value form (hide-sensitive pref defaults to true)
      // Row order for Amazon EC2: accessKey=0, defaultRegion=1, secretKey=2
      await cloudCredentialsPage.createEditCloudCreds().kvValueByIndex(2).fill(envMeta.awsSecretKey!);

      const putResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/cloudCredentials') && resp.request().method() === 'PUT',
        { timeout: 15000 },
      );

      await cloudCredentialsPage.createEditCloudCreds().saveCreateForm().cruResource().saveOrCreate().click();
      await putResponsePromise;
      await cloudCredentialsPage.waitForPage();

      await expect(cloudCredentialsPage.list().details(`${cloudCredentialName}-name-edit`, 2)).toBeVisible();
      await expect(cloudCredentialsPage.list().details(`${cloudCredentialName}-description-edit`, 3)).toBeVisible();
    } finally {
      if (credId) {
        await rancherApi.deleteRancherResource('v3', 'cloudCredentials', credId, false);
      }
    }
  });

  test('can clone cloud credentials', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const cloudCredentialName = rancherApi.createE2EResourceName('cc-clone');
    const cloudCredentialsPage = new CloudCredentialsPagePo(page);
    const createdIds: string[] = [];

    try {
      const createResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'provisioning.cattle.io/cloud-credential',
        metadata: { generateName: 'cc-', namespace: 'fleet-default' },
        _name: cloudCredentialName,
        annotations: { 'provisioning.cattle.io/driver': 'amazonec2' },
        amazonec2credentialConfig: {
          accessKey: envMeta.awsAccessKey,
          secretKey: envMeta.awsSecretKey,
        },
        _type: 'provisioning.cattle.io/cloud-credential',
        name: cloudCredentialName,
      });

      createdIds.push(createResp.body.id);

      await cloudCredentialsPage.goTo();
      await cloudCredentialsPage.waitForPage();

      const actionMenu = await cloudCredentialsPage.list().actionMenu(cloudCredentialName);

      await actionMenu.getMenuItem('Clone').click();
      await cloudCredentialsPage.createEditCloudCreds(createResp.body.id).waitForPage('mode=clone');

      await cloudCredentialsPage.createEditCloudCreds().nameNsDescription().name().set(`${cloudCredentialName}-clone`);

      // Clone page shows Key-Value form (hide-sensitive pref defaults to true)
      // Row order for Amazon EC2: accessKey=0, defaultRegion=1, secretKey=2
      await cloudCredentialsPage.createEditCloudCreds().kvValueByIndex(0).fill(envMeta.awsAccessKey!);
      await cloudCredentialsPage.createEditCloudCreds().kvValueByIndex(2).fill(envMeta.awsSecretKey!);

      const postResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/cloudcredentials') && resp.request().method() === 'POST',
        { timeout: 15000 },
      );

      await cloudCredentialsPage.createEditCloudCreds().saveCreateForm().cruResource().saveOrCreate().click();
      const response = await postResponsePromise;
      const body = await response.json();

      createdIds.push(body.id);
      await cloudCredentialsPage.waitForPage();

      await expect(cloudCredentialsPage.list().details(`${cloudCredentialName}-clone`, 1)).toBeVisible();
    } finally {
      for (const id of createdIds) {
        await rancherApi.deleteRancherResource('v3', 'cloudCredentials', id, false);
      }
    }
  });

  test('can delete cloud credentials', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const cloudCredentialName = rancherApi.createE2EResourceName('cc-del');
    const cloudCredentialsPage = new CloudCredentialsPagePo(page);

    const createResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
      type: 'provisioning.cattle.io/cloud-credential',
      metadata: { generateName: 'cc-', namespace: 'fleet-default' },
      _name: cloudCredentialName,
      annotations: { 'provisioning.cattle.io/driver': 'amazonec2' },
      amazonec2credentialConfig: {
        accessKey: envMeta.awsAccessKey,
        secretKey: envMeta.awsSecretKey,
      },
      _type: 'provisioning.cattle.io/cloud-credential',
      name: cloudCredentialName,
    });

    const credId = createResp.body.id;

    try {
      await cloudCredentialsPage.goTo();
      await cloudCredentialsPage.waitForPage();

      const actionMenu = await cloudCredentialsPage.list().actionMenu(cloudCredentialName);

      await actionMenu.getMenuItem('Delete').click();

      const promptRemove = new PromptRemove(page);
      const deletePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/cloudCredentials') && resp.request().method() === 'DELETE',
        { timeout: 15000 },
      );

      await promptRemove.remove();
      await deletePromise;
      await cloudCredentialsPage.waitForPage();

      await expect(
        cloudCredentialsPage.list().resourceTable().sortableTable().rowElementWithName(cloudCredentialName),
      ).not.toBeAttached();
    } finally {
      await rancherApi.deleteRancherResource('v3', 'cloudCredentials', credId, false);
    }
  });

  test('can delete cloud credentials via bulk actions', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const cloudCredentialName = rancherApi.createE2EResourceName('cc-bulk');
    const cloudCredentialsPage = new CloudCredentialsPagePo(page);

    const createResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
      type: 'provisioning.cattle.io/cloud-credential',
      metadata: { generateName: 'cc-', namespace: 'fleet-default' },
      _name: cloudCredentialName,
      annotations: { 'provisioning.cattle.io/driver': 'amazonec2' },
      amazonec2credentialConfig: {
        accessKey: envMeta.awsAccessKey,
        secretKey: envMeta.awsSecretKey,
      },
      _type: 'provisioning.cattle.io/cloud-credential',
      name: cloudCredentialName,
    });

    const credId = createResp.body.id;

    try {
      await cloudCredentialsPage.goTo();
      await cloudCredentialsPage.waitForPage();

      await cloudCredentialsPage.list().resourceTable().sortableTable().rowSelectCtlWithName(cloudCredentialName).set();
      await cloudCredentialsPage.list().resourceTable().sortableTable().deleteButton().click();

      const promptRemove = new PromptRemove(page);
      const deletePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/cloudCredentials') && resp.request().method() === 'DELETE',
        { timeout: 15000 },
      );

      await promptRemove.remove();
      await deletePromise;
      await cloudCredentialsPage.waitForPage();

      await expect(
        cloudCredentialsPage.list().resourceTable().sortableTable().rowElementWithName(cloudCredentialName),
      ).not.toBeAttached();
    } finally {
      await rancherApi.deleteRancherResource('v3', 'cloudCredentials', credId, false);
    }
  });
});
