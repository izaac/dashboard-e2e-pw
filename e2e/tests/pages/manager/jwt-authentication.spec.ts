import { test, expect } from '@/support/fixtures';
import JWTAuthenticationPagePo from '@/e2e/po/pages/cluster-manager/jwt-authentication.po';
import HomePagePo from '@/e2e/po/pages/home.po';

const namespace = 'fleet-default';

async function createAmazonRke2ClusterWithoutMachineConfig(
  rancherApi: any,
  name: string,
  accessKey: string,
  secretKey: string,
): Promise<string> {
  // Create cloud credential
  const credResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
    type: 'provisioning.cattle.io/cloud-credential',
    metadata: { generateName: 'cc-', namespace },
    _name: name,
    annotations: { 'provisioning.cattle.io/driver': 'amazonec2' },
    amazonec2credentialConfig: { accessKey, secretKey },
    _type: 'provisioning.cattle.io/cloud-credential',
    name,
  });
  const credId = credResp.body.id;

  // Create RKE2 cluster (no machine config — uses cloud cred only)
  const clusterResp = await rancherApi.createRancherResource('v1', 'provisioning.cattle.io.clusters', {
    type: 'provisioning.cattle.io.cluster',
    metadata: { name, namespace },
    spec: {
      cloudCredentialSecretName: credId,
      rkeConfig: {},
    },
  });

  return clusterResp.body.metadata?.name ?? name;
}

async function goToJWTAuthenticationPageAndSettle(page: any, jwtAuthPage: JWTAuthenticationPagePo): Promise<void> {
  const fetchResponsePromise = page.waitForResponse(
    (resp: any) =>
      resp.url().includes('/v1/management.cattle.io.clusterproxyconfigs') && resp.request().method() === 'GET',
    { timeout: 15000 },
  );

  await jwtAuthPage.goTo();
  await jwtAuthPage.waitForPage();
  await fetchResponsePromise;

  // Filter to no rows, then reset
  await jwtAuthPage.list().resourceTable().sortableTable().filter('random text');
  await expect(
    jwtAuthPage
      .list()
      .resourceTable()
      .sortableTable()
      .rowWithPartialName('There are no rows which match your search query.')
      .self(),
  ).toBeVisible();
  await jwtAuthPage.list().resourceTable().sortableTable().resetFilter();
}

test.describe('JWT Authentication', { tag: ['@manager', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test('should show the JWT Authentication list page', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const instance0 = rancherApi.createE2EResourceName('rke2cluster0');
    const instance1 = rancherApi.createE2EResourceName('rke2cluster1');
    const jwtAuthPage = new JWTAuthenticationPagePo(page);

    try {
      await createAmazonRke2ClusterWithoutMachineConfig(
        rancherApi,
        instance0,
        envMeta.awsAccessKey!,
        envMeta.awsSecretKey!,
      );
      await createAmazonRke2ClusterWithoutMachineConfig(
        rancherApi,
        instance1,
        envMeta.awsAccessKey!,
        envMeta.awsSecretKey!,
      );

      await goToJWTAuthenticationPageAndSettle(page, jwtAuthPage);

      await expect(jwtAuthPage.list().masthead().title()).toContainText('JWT Authentication');
      await jwtAuthPage.list().resourceTable().sortableTable().checkVisible();
      await jwtAuthPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await expect(jwtAuthPage.list().resourceTable().resourceTableDetails(instance0, 1)).toContainText('Disabled');
      await expect(jwtAuthPage.list().resourceTable().resourceTableDetails(instance1, 1)).toContainText('Disabled');
    } finally {
      await rancherApi.deleteRancherResource('v1', `provisioning.cattle.io.clusters/${namespace}`, instance0, false);
      await rancherApi.deleteRancherResource('v1', `provisioning.cattle.io.clusters/${namespace}`, instance1, false);
    }
  });

  test('should be able to enable JWT Authentication for a cluster', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const instance0 = rancherApi.createE2EResourceName('rke2cluster0');
    const jwtAuthPage = new JWTAuthenticationPagePo(page);

    try {
      await createAmazonRke2ClusterWithoutMachineConfig(
        rancherApi,
        instance0,
        envMeta.awsAccessKey!,
        envMeta.awsSecretKey!,
      );

      await goToJWTAuthenticationPageAndSettle(page, jwtAuthPage);

      const enableResponsePromise = page.waitForResponse(
        (resp: any) =>
          resp.url().includes('/v1/management.cattle.io.clusterproxyconfigs') && resp.request().method() === 'POST',
        { timeout: 15000 },
      );

      await jwtAuthPage
        .list()
        .resourceTable()
        .sortableTable()
        .rowActionMenuOpen(instance0)
        .then((menu: any) => menu.getMenuItem('Enable').click());

      const enableResp = await enableResponsePromise;

      expect(enableResp.status()).toBe(201);
      const body = await enableResp.json();

      expect(body.enabled).toBe(true);

      await expect(jwtAuthPage.list().resourceTable().resourceTableDetails(instance0, 1)).toContainText('Enabled');
    } finally {
      await rancherApi.deleteRancherResource('v1', `provisioning.cattle.io.clusters/${namespace}`, instance0, false);
    }
  });

  test('should be able to disable JWT Authentication for a cluster', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const instance0 = rancherApi.createE2EResourceName('rke2cluster0');
    const jwtAuthPage = new JWTAuthenticationPagePo(page);

    try {
      await createAmazonRke2ClusterWithoutMachineConfig(
        rancherApi,
        instance0,
        envMeta.awsAccessKey!,
        envMeta.awsSecretKey!,
      );

      // Enable first so we can disable
      await rancherApi.createRancherResource(
        'v1',
        'management.cattle.io.clusterproxyconfigs',
        {
          type: 'management.cattle.io.clusterproxyconfig',
          metadata: { name: instance0, namespace },
          enabled: true,
        },
        false,
      );

      await goToJWTAuthenticationPageAndSettle(page, jwtAuthPage);

      const disableResponsePromise = page.waitForResponse(
        (resp: any) =>
          resp.url().includes('/v1/management.cattle.io.clusterproxyconfigs') && resp.request().method() === 'PUT',
        { timeout: 15000 },
      );

      await jwtAuthPage
        .list()
        .resourceTable()
        .sortableTable()
        .rowActionMenuOpen(instance0)
        .then((menu: any) => menu.getMenuItem('Disable').click());

      const disableResp = await disableResponsePromise;

      expect(disableResp.status()).toBe(200);
      const body = await disableResp.json();

      expect(body.enabled).toBe(false);

      await expect(jwtAuthPage.list().resourceTable().resourceTableDetails(instance0, 1)).toContainText('Disabled');
    } finally {
      await rancherApi.deleteRancherResource('v1', `provisioning.cattle.io.clusters/${namespace}`, instance0, false);
    }
  });

  test('should be able to enable JWT Authentication in bulk', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const instance0 = rancherApi.createE2EResourceName('rke2cluster0');
    const instance1 = rancherApi.createE2EResourceName('rke2cluster1');
    const jwtAuthPage = new JWTAuthenticationPagePo(page);

    try {
      await createAmazonRke2ClusterWithoutMachineConfig(
        rancherApi,
        instance0,
        envMeta.awsAccessKey!,
        envMeta.awsSecretKey!,
      );
      await createAmazonRke2ClusterWithoutMachineConfig(
        rancherApi,
        instance1,
        envMeta.awsAccessKey!,
        envMeta.awsSecretKey!,
      );

      await goToJWTAuthenticationPageAndSettle(page, jwtAuthPage);

      const enableResponsePromise = page.waitForResponse(
        (resp: any) =>
          resp.url().includes('/v1/management.cattle.io.clusterproxyconfigs') && resp.request().method() === 'POST',
        { timeout: 15000 },
      );

      await jwtAuthPage.list().resourceTable().sortableTable().rowSelectCtlWithName(instance0).set();
      await jwtAuthPage.list().resourceTable().sortableTable().rowSelectCtlWithName(instance1).set();
      await jwtAuthPage.list().resourceTable().sortableTable().bulkActionButton('Enable').click();

      const enableResp = await enableResponsePromise;

      expect(enableResp.status()).toBe(201);
      const body = await enableResp.json();

      expect(body.enabled).toBe(true);

      await expect(jwtAuthPage.list().resourceTable().resourceTableDetails(instance0, 1)).toContainText('Enabled');
      await expect(jwtAuthPage.list().resourceTable().resourceTableDetails(instance1, 1)).toContainText('Enabled');
    } finally {
      await rancherApi.deleteRancherResource('v1', `provisioning.cattle.io.clusters/${namespace}`, instance0, false);
      await rancherApi.deleteRancherResource('v1', `provisioning.cattle.io.clusters/${namespace}`, instance1, false);
    }
  });

  test('should be able to disable JWT Authentication in bulk', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const instance0 = rancherApi.createE2EResourceName('rke2cluster0');
    const instance1 = rancherApi.createE2EResourceName('rke2cluster1');
    const jwtAuthPage = new JWTAuthenticationPagePo(page);

    try {
      await createAmazonRke2ClusterWithoutMachineConfig(
        rancherApi,
        instance0,
        envMeta.awsAccessKey!,
        envMeta.awsSecretKey!,
      );
      await createAmazonRke2ClusterWithoutMachineConfig(
        rancherApi,
        instance1,
        envMeta.awsAccessKey!,
        envMeta.awsSecretKey!,
      );

      // Enable both clusters first
      await rancherApi.createRancherResource(
        'v1',
        'management.cattle.io.clusterproxyconfigs',
        {
          type: 'management.cattle.io.clusterproxyconfig',
          metadata: { name: instance0, namespace },
          enabled: true,
        },
        false,
      );
      await rancherApi.createRancherResource(
        'v1',
        'management.cattle.io.clusterproxyconfigs',
        {
          type: 'management.cattle.io.clusterproxyconfig',
          metadata: { name: instance1, namespace },
          enabled: true,
        },
        false,
      );

      await goToJWTAuthenticationPageAndSettle(page, jwtAuthPage);

      const disableResponsePromise = page.waitForResponse(
        (resp: any) =>
          resp.url().includes('/v1/management.cattle.io.clusterproxyconfigs') && resp.request().method() === 'PUT',
        { timeout: 15000 },
      );

      await jwtAuthPage.list().resourceTable().sortableTable().rowSelectCtlWithName(instance0).set();
      await jwtAuthPage.list().resourceTable().sortableTable().rowSelectCtlWithName(instance1).set();
      await jwtAuthPage.list().resourceTable().sortableTable().bulkActionButton('Disable').click();

      const disableResp = await disableResponsePromise;

      expect(disableResp.status()).toBe(200);
      const body = await disableResp.json();

      expect(body.enabled).toBe(false);

      await expect(jwtAuthPage.list().resourceTable().resourceTableDetails(instance0, 1)).toContainText('Disabled');
      await expect(jwtAuthPage.list().resourceTable().resourceTableDetails(instance1, 1)).toContainText('Disabled');
    } finally {
      await rancherApi.deleteRancherResource('v1', `provisioning.cattle.io.clusters/${namespace}`, instance0, false);
      await rancherApi.deleteRancherResource('v1', `provisioning.cattle.io.clusters/${namespace}`, instance1, false);
    }
  });

  test('should not have JWT Authentication side menu entry for standard user', async ({ login, page, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.manageClustersButton().click();
    await expect(page).toHaveURL(/\/c\/_\/manager/);

    const jwtAuthPage = new JWTAuthenticationPagePo(page);

    const advancedGroup = jwtAuthPage
      .sideNav()
      .self()
      .locator('a, .accordion-title, .side-nav-group-name')
      .filter({ hasText: 'Advanced' });
    const advancedVisible = await advancedGroup.isVisible({ timeout: 3000 }).catch((e: Error) => {
      if (!e.message.includes('strict mode violation')) {
        throw e;
      }

      return false;
    });

    if (advancedVisible) {
      await advancedGroup.click();
    }

    await expect(jwtAuthPage.jwtAuthNavLink()).not.toBeAttached();
  });

  test('should display JWT Authentication list page', async ({ login, page, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const jwtAuthPage = new JWTAuthenticationPagePo(page);

    await jwtAuthPage.goTo('_');
    await jwtAuthPage.waitForPage();

    await jwtAuthPage.list().resourceTable().sortableTable().checkVisible();
    await jwtAuthPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
  });

  test('should display JWT Authentication populated list page', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const instance0 = rancherApi.createE2EResourceName('rke2cluster0');
    const jwtAuthPage = new JWTAuthenticationPagePo(page);

    try {
      await createAmazonRke2ClusterWithoutMachineConfig(
        rancherApi,
        instance0,
        envMeta.awsAccessKey!,
        envMeta.awsSecretKey!,
      );

      await jwtAuthPage.goTo('_');
      await jwtAuthPage.waitForPage();

      await jwtAuthPage.list().resourceTable().sortableTable().checkVisible();
      await jwtAuthPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

      const rows = jwtAuthPage.list().resourceTable().sortableTable().rowElements();

      await expect(rows.first()).toBeVisible();
    } finally {
      await rancherApi.deleteRancherResource('v1', `provisioning.cattle.io.clusters/${namespace}`, instance0, false);
    }
  });
});
