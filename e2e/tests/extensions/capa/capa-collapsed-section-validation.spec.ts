import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import ClusterManagerCreateCapaAwsPagePo from '@/e2e/po/extensions/capa/cluster-create-capa-aws.po';
import { EXTENSION_OPS, LONG, LONG_TIMEOUT_OPT, SHORT_TIMEOUT_OPT } from '@/support/timeouts';

/**
 * rancher/dashboard#18850: the content of a collapsed RcSection is still validated. On the "Create Cluster API
 * Provider AWS" form (CAPA UI extension), a collapsed section that holds invalid fields keeps Create disabled and
 * shows a red error icon in its header.
 *
 * The fix lives in the shared UI code that every extension bundles, so it only reaches the CAPA form once the
 * extension is built on shell >= 3.0.15-rc.4. On the released capa 0.0.1 (shell 3.0.13) the "keeps Create
 * disabled" test fails by design; it passes on a rebuilt extension (for example one loaded with Developer Load
 * and persisted).
 *
 * Tags: `@needsInfra` is the repo's infra gate (docs/RUNNING-TESTS.md), the default GREP_TAGS filters it out.
 * Run with `GREP_TAGS=@needsInfra` and `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (optional `AWS_REGION`,
 * default us-west-1) exported. `@prime` because the capa extension is Prime only. The keys build a cloud
 * credential and a static identity and are never logged; the form is opened but Create is never clicked, so
 * nothing is provisioned in AWS.
 *
 * Setup, all created through the API and removed in afterAll only when this spec created them:
 * - the cloud credential, the AWSClusterStaticIdentity (with its secret) and the credential annotation that links
 *   them, always created
 * - CAPIProvider `aws`
 * - when no capa extension is present: ClusterRepo `prov-capi-ui-extensions` and the released extension
 * Precondition checked with a failing message: Rancher Turtles (CAPIProvider CRD) is installed.
 */
test.describe(
  'CAPA create form: collapsed section validation',
  { tag: ['@extensions', '@adminUser', '@prime', '@needsInfra'] },
  () => {
    const DEFAULT_REGION = 'us-west-1';
    const INSTANCE_PROFILE = 'control-plane.cluster-api-provider-aws.sigs.k8s.io';
    const PROVIDER_NS = 'cattle-turtles-system';
    const PROVIDER_NAME = 'aws';
    const PROVIDER_TYPE = 'turtles-capi.cattle.io.capiproviders';
    const IDENTITY_TYPE = 'infrastructure.cluster.x-k8s.io.awsclusterstaticidentities';
    const IDENTITY_ANNOTATION = 'cluster-api.cattle.io/capi-static-identity-ref';
    const REPO_NAME = 'prov-capi-ui-extensions';
    const REPO_URL = 'https://rancher.github.io/prov-capi-ui-extensions';
    const EXTENSION_NAME = 'capa';
    const EXTENSION_NS = 'cattle-ui-plugin-system';

    const region = process.env.AWS_REGION || DEFAULT_REGION;

    let credentialName = '';
    let credentialId = '';
    let identityName = '';
    let identitySecretName = '';
    let createdProvider = false;
    let createdRepo = false;
    let installedExtension = false;

    /** Cleanup step that warns with context and lets the remaining steps run when it fails. */
    async function cleanupStep<T>(what: string, step: () => Promise<T>): Promise<T | undefined> {
      try {
        return await step();
      } catch (err) {
        console.warn(`[capa-collapsed-section-validation cleanup] ${what}: ${(err as Error)?.message ?? err}`);

        return undefined;
      }
    }

    async function ensureCapiProvider(rancherApi: RancherApi): Promise<void> {
      const crd = await rancherApi.getRancherResource('v1', PROVIDER_TYPE, undefined, 0);

      expect(
        crd.status,
        'Precondition: Rancher Turtles is not installed (CAPIProvider resources are not served by Rancher)',
      ).toBe(200);

      const existing = await rancherApi.getRancherResource('v1', PROVIDER_TYPE, `${PROVIDER_NS}/${PROVIDER_NAME}`, 0);

      if (existing.status === 200) {
        return;
      }

      await rancherApi.createRancherResource('v1', PROVIDER_TYPE, {
        apiVersion: 'turtles-capi.cattle.io/v1alpha1',
        kind: 'CAPIProvider',
        metadata: { name: PROVIDER_NAME, namespace: PROVIDER_NS },
        spec: { type: 'infrastructure', name: PROVIDER_NAME },
      });
      createdProvider = true;
    }

    // Matches the released chart ('capa') and a persisted Developer Load ('capa-developer-load')
    async function hasCapaExtension(rancherApi: RancherApi): Promise<boolean> {
      const plugins = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.uiplugins');

      return (plugins.body.data as Array<{ spec?: { plugin?: { name?: string } } }>).some((plugin) =>
        plugin.spec?.plugin?.name?.startsWith(EXTENSION_NAME),
      );
    }

    async function ensureCapaExtension(rancherApi: RancherApi): Promise<void> {
      if (await hasCapaExtension(rancherApi)) {
        return;
      }

      const repo = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.clusterrepos', REPO_NAME, 0);

      if (repo.status !== 200) {
        await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
          apiVersion: 'catalog.cattle.io/v1',
          kind: 'ClusterRepo',
          metadata: { name: REPO_NAME },
          spec: { url: REPO_URL },
        });
        createdRepo = true;
      }

      expect(
        await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', REPO_NAME),
        `ClusterRepo '${REPO_NAME}' did not finish downloading`,
      ).toBe(true);
      await rancherApi.ensureChartInstalled(REPO_NAME, EXTENSION_NS, EXTENSION_NAME);
      installedExtension = true;

      expect(
        await rancherApi.waitForResourceState('v1', 'catalog.cattle.io.uiplugins', `${EXTENSION_NS}/${EXTENSION_NAME}`),
        `UIPlugin '${EXTENSION_NAME}' did not become active`,
      ).toBe(true);
    }

    async function createCredentials(rancherApi: RancherApi, accessKey: string, secretKey: string): Promise<void> {
      identityName = rancherApi.createE2EResourceName('capa-identity');
      identitySecretName = `${identityName}-creds`;

      await rancherApi.createSecret(PROVIDER_NS, identitySecretName, {
        type: 'Opaque',
        data: {
          AccessKeyID: Buffer.from(accessKey).toString('base64'),
          SecretAccessKey: Buffer.from(secretKey).toString('base64'),
        },
      });
      await rancherApi.createRancherResource('v1', IDENTITY_TYPE, {
        apiVersion: 'infrastructure.cluster.x-k8s.io/v1beta2',
        kind: 'AWSClusterStaticIdentity',
        metadata: { name: identityName },
        spec: { secretRef: identitySecretName, allowedNamespaces: {} },
      });

      credentialName = rancherApi.createE2EResourceName('capa-aws');
      const credential = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'provisioning.cattle.io/cloud-credential',
        name: credentialName,
        annotations: { [IDENTITY_ANNOTATION]: identityName },
        amazonec2credentialConfig: { accessKey, secretKey, defaultRegion: region },
      });

      credentialId = credential.body.id;
    }

    test.beforeAll(async ({ rancherApi }) => {
      test.setTimeout(EXTENSION_OPS);

      const accessKey = process.env.AWS_ACCESS_KEY_ID;
      const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

      test.skip(!accessKey || !secretKey, 'Requires AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');

      await ensureCapiProvider(rancherApi);
      await ensureCapaExtension(rancherApi);
      await createCredentials(rancherApi, accessKey as string, secretKey as string);
    });

    test.afterAll(async ({ rancherApi }) => {
      test.setTimeout(EXTENSION_OPS);

      if (credentialId) {
        await cleanupStep('cloud credential', () =>
          rancherApi.deleteRancherResource('v3', 'cloudcredentials', credentialId, false),
        );
      }

      if (identityName) {
        await cleanupStep('static identity', () =>
          rancherApi.deleteRancherResource('v1', IDENTITY_TYPE, identityName, false),
        );
      }

      if (identitySecretName) {
        await cleanupStep('static identity secret', () =>
          rancherApi.deleteRancherResource('v1', 'secrets', `${PROVIDER_NS}/${identitySecretName}`, false),
        );
      }

      if (installedExtension) {
        await cleanupStep('capa extension', () => rancherApi.ensureChartUninstalled(EXTENSION_NS, EXTENSION_NAME));
      }

      if (createdRepo) {
        await cleanupStep('cluster repo', () =>
          rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', REPO_NAME, false),
        );
      }

      if (createdProvider) {
        await cleanupStep('capi provider', () =>
          rancherApi.deleteRancherResource('v1', PROVIDER_TYPE, `${PROVIDER_NS}/${PROVIDER_NAME}`, false),
        );
      }

      createdProvider = false;
      createdRepo = false;
      installedExtension = false;
      credentialId = '';
      identityName = '';
      identitySecretName = '';
    });

    test.beforeEach(async ({ page, login, rancherApi }) => {
      await login();

      const form = new ClusterManagerCreateCapaAwsPagePo(page);

      await form.goToForm();
      await form.waitForForm();

      await form.selectCloudCredential(credentialName);
      await expect(form.regionSelect().selectedOption()).toContainText(region, SHORT_TIMEOUT_OPT);
      await form.nameNsDescription().name().set(rancherApi.createE2EResourceName('capa-cluster'));
      await form.setInstanceProfile(INSTANCE_PROFILE);
      await expect(form.iamInstanceProfileSelect().selectedOption()).toContainText(INSTANCE_PROFILE, SHORT_TIMEOUT_OPT);
    });

    test('Create is enabled with a managed network', async ({ page }) => {
      const form = new ClusterManagerCreateCapaAwsPagePo(page);

      await expect(form.managedNetworkOption()).toHaveAttribute('aria-checked', 'true');
      await expect(form.createButton()).toBeEnabled(LONG_TIMEOUT_OPT);
    });

    test('keeps Create disabled and flags the section when an unmanaged network is collapsed', async ({ page }) => {
      const form = new ClusterManagerCreateCapaAwsPagePo(page);
      const network = form.networkConfigurationSection();

      await form.selectUnmanagedNetwork();
      await expect(form.unmanagedNetworkOption()).toHaveAttribute('aria-checked', 'true');
      await expect(form.createButton()).toBeDisabled(LONG_TIMEOUT_OPT);

      await network.toggle();
      await expect(network.toggleButton()).toHaveAttribute('aria-expanded', 'false');

      await expect(form.createButton()).toBeDisabled();
      await expect(network.invalidFieldsIcon()).toBeVisible(SHORT_TIMEOUT_OPT);

      await network.hoverInvalidFieldsIcon();
      await expect(form.shownTooltip()).toContainText('Some fields inside this section are invalid', {
        timeout: LONG,
      });
    });

    test('clears the section error and enables Create once the unmanaged network is valid', async ({ page }) => {
      const form = new ClusterManagerCreateCapaAwsPagePo(page);
      const network = form.networkConfigurationSection();

      await form.selectUnmanagedNetwork();
      await network.toggle();
      await expect(network.toggleButton()).toHaveAttribute('aria-expanded', 'false');

      await network.toggle();
      await expect(network.toggleButton()).toHaveAttribute('aria-expanded', 'true');

      await form.selectFirstVpc();
      await form.selectFirstSubnet();

      await network.toggle();
      await expect(network.toggleButton()).toHaveAttribute('aria-expanded', 'false');

      await expect(network.invalidFieldsIcon()).not.toBeAttached(SHORT_TIMEOUT_OPT);
      await expect(form.createButton()).toBeEnabled(LONG_TIMEOUT_OPT);
    });
  },
);
