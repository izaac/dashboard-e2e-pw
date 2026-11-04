import type { Page, Request } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { SecretsListPagePo } from '@/e2e/po/pages/explorer/secrets.po';
import { SecretEditPagePo } from '@/e2e/po/edit/secret-edit.po';
import SecretDetailPagePo from '@/e2e/po/detail/secret-detail.po';
import InstalledAppDetailPagePo from '@/e2e/po/detail/catalog.cattle.io.app.po';
import type { RancherApi } from '@/support/fixtures/rancher-api';

const CLUSTER = 'local';
const SWEEP_LABEL = 'e2e-suite';
const SWEEP_LABEL_VALUE = 'helm-release-secret-edit';
const FAKE_NAMESPACE = 'helm-secret-edit-e2e';
const APP_NAMESPACE = 'helm-secret-edit-app-e2e';
const REPO = 'rancher-charts';
const REAL_LABEL = 'e2e-label';
const DESCRIPTION_ANNOTATION = 'field.cattle.io/description';
const DESCRIPTION_TEXT = 'description saved on a helm release secret';
const APP_INSTALL_ATTEMPTS = 48;
const APP_POLL_MS = 5000;

const APP_CHART = {
  chartName: 'rancher-alerting-drivers',
  releaseName: 'rancher-alerting-drivers',
  version: '108.0.1',
  upgradeVersion: '109.0.0',
};

const CHART_ANNOTATIONS = {
  'catalog.cattle.io/ui-source-repo-type': 'cluster',
  'catalog.cattle.io/ui-source-repo': REPO,
};

const helmSecretName = (release: string, revision: number) => `sh.helm.release.v1.${release}.v${revision}`;

const HELM_SECRET = 'sh.helm.release.v1.helm-secret-edit-e2e.v1';
const OPAQUE_SECRET = 'helm-secret-edit-opaque-e2e';
const HELM_RELEASE_DATA = 'dGVzdA==';
const OPAQUE_DATA_KEY = 'qa-key';
const OPAQUE_DATA_VALUE = Buffer.from('qa-value').toString('base64');

test.describe('Helm release secret edit protects release data', { tag: ['@generic', '@adminUser'] }, () => {
  const testNamespace = FAKE_NAMESPACE;

  /** The welcome modal mounts late, so wait for it briefly (isVisible does not wait) before dismissing */
  async function dismissWelcome(page: Page): Promise<void> {
    const welcome = new WelcomeDialogPo(page);

    await welcome
      .self()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});
    await welcome.dismissIfVisible();
  }

  /** Open the edit page of a secret and make sure it is rendered */
  async function openEditPage(page: Page, name: string, namespace = testNamespace): Promise<SecretEditPagePo> {
    const editPage = new SecretEditPagePo(page, CLUSTER, namespace, name);

    await editPage.goToEdit();
    await editPage.waitForPage('mode=edit');
    await dismissWelcome(page);
    await expect(editPage.createEditView().saveButtonPo().self()).toBeVisible();

    return editPage;
  }

  /** Click Save and capture the resulting write request to the secret */
  async function saveAndCaptureRequest(
    page: Page,
    editPage: SecretEditPagePo,
    name: string,
    namespace = testNamespace,
  ): Promise<Request> {
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes(`/v1/secrets/${namespace}/${name}`) && ['PATCH', 'PUT'].includes(req.method()),
    );

    await editPage.createEditView().saveButtonPo().click();

    return requestPromise;
  }

  /** Parse a captured helm secret PATCH, assert it only touches labels and annotations and return the ops */
  function expectMetadataOnlyPatch(request: Request): Array<{ op: string; path: string; value?: any }> {
    const body = request.postData() ?? '';
    const ops: Array<{ op: string; path: string; value?: any }> = JSON.parse(body);

    expect(request.method()).toBe('PATCH');
    expect(request.headers()['content-type']).toContain('application/json-patch+json');
    expect(ops.map((o) => o.path)).toEqual(['/metadata/labels', '/metadata/annotations']);
    expect(ops.every((o) => !o.path.startsWith('/data'))).toBe(true);

    return ops;
  }

  /** Read a secret straight from the kube API (Steve strips data.release for helm secrets) */
  async function readRawSecret(rancherApi: RancherApi, namespace: string, name: string, expectedStatus = 200) {
    const { status, body } = await rancherApi.getRancherResource(
      `k8s/clusters/${CLUSTER}/api/v1/namespaces/${namespace}`,
      'secrets',
      name,
      expectedStatus,
    );

    return { status, body };
  }

  /**
   * Resolve whether a fixed-name namespace is ours. Returns false when it does not exist, true when it carries the
   * suite label, and throws (touching nothing) when it exists without the label.
   */
  async function isOwnedNamespace(rancherApi: RancherApi, name: string): Promise<boolean> {
    const { status, body } = await rancherApi.getRancherResource('v1', 'namespaces', name, 0);

    if (status === 404) {
      return false;
    }

    if (body.metadata?.labels?.[SWEEP_LABEL] !== SWEEP_LABEL_VALUE) {
      throw new Error(
        `Namespace '${name}' already exists without label ${SWEEP_LABEL}=${SWEEP_LABEL_VALUE}; refusing to touch it`,
      );
    }

    return true;
  }

  /** Delete a namespace owned by this suite (uninstalling given releases first) and wait until it is gone */
  async function removeOwnedNamespace(rancherApi: RancherApi, name: string, releases: string[] = []): Promise<void> {
    if (!(await isOwnedNamespace(rancherApi, name))) {
      return;
    }

    for (const release of releases) {
      await rancherApi.ensureChartUninstalled(name, release);
    }

    await rancherApi.deleteRancherResource('v1', 'namespaces', name, false);
    expect(await rancherApi.waitForResourceGone('v1', 'namespaces', name, 60, 2000), `namespace ${name} gone`).toBe(
      true,
    );
  }

  /** Create a namespace carrying the suite label */
  async function createLabeledNamespace(rancherApi: RancherApi, name: string): Promise<void> {
    await rancherApi.createRancherResource('v1', 'namespaces', {
      type: 'namespace',
      metadata: {
        name,
        labels: { [SWEEP_LABEL]: SWEEP_LABEL_VALUE },
        annotations: { 'field.cattle.io/containerDefaultResourceLimit': '{}' },
      },
      disableOpenApiValidation: false,
    });
  }

  test.beforeAll(async ({ rancherApi }) => {
    test.setTimeout(5 * 60_000);

    await removeOwnedNamespace(rancherApi, testNamespace);
    await createLabeledNamespace(rancherApi, testNamespace);

    await rancherApi.createRancherResource('v1', 'secrets', {
      type: 'secret',
      _type: 'helm.sh/release.v1',
      metadata: {
        name: HELM_SECRET,
        namespace: testNamespace,
        labels: {
          [SWEEP_LABEL]: SWEEP_LABEL_VALUE,
          owner: 'helm',
          name: 'helm-secret-edit-e2e',
          status: 'deployed',
          version: '1',
        },
      },
      data: { release: HELM_RELEASE_DATA },
    });

    await rancherApi.createRancherResource('v1', 'secrets', {
      type: 'secret',
      _type: 'Opaque',
      metadata: { name: OPAQUE_SECRET, namespace: testNamespace, labels: { [SWEEP_LABEL]: SWEEP_LABEL_VALUE } },
      data: { [OPAQUE_DATA_KEY]: OPAQUE_DATA_VALUE },
    });
  });

  test.afterAll(async ({ rancherApi }) => {
    test.setTimeout(5 * 60_000);
    try {
      await rancherApi.deleteRancherResource('v1', 'secrets', `${testNamespace}/${HELM_SECRET}`, false);
      await rancherApi.deleteRancherResource('v1', 'secrets', `${testNamespace}/${OPAQUE_SECRET}`, false);
    } finally {
      await removeOwnedNamespace(rancherApi, testNamespace);
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('helm release secret edit page shows banner and no data editor', async ({ page }) => {
    const editPage = await openEditPage(page, HELM_SECRET);

    await expect(editPage.helmReleaseBanner()).toBeVisible();
    await expect(editPage.dataEditorAddButton()).toHaveCount(0);
    await expect(editPage.createEditView().editYamlButton().self()).toHaveCount(0);
  });

  test('Edit YAML is not offered in the row action menu for a helm release secret', async ({ page }) => {
    const listPage = new SecretsListPagePo(page, CLUSTER);

    await listPage.goTo();
    await listPage.waitForPage();
    await dismissWelcome(page);

    const table = listPage.list().resourceTable().sortableTable();

    await table.checkLoadingIndicatorNotVisible();

    await listPage.filterByName(HELM_SECRET);
    await expect(table.rowWithName(HELM_SECRET).self()).toBeVisible();

    const actionMenu = await listPage.list().actionMenu(HELM_SECRET);

    await expect(actionMenu.getMenuItem('Edit Config')).toBeVisible();
    await expect(actionMenu.getMenuItem('Edit YAML')).toHaveCount(0);
  });

  test('Edit YAML is not offered in the detail masthead for a helm release secret', async ({ page }) => {
    const detailPage = new SecretDetailPagePo(page, CLUSTER, testNamespace, HELM_SECRET);

    await detailPage.goTo();
    await detailPage.waitForPage();
    await dismissWelcome(page);
    await expect(detailPage.detail().title()).toContainText(HELM_SECRET);

    const actionMenu = await detailPage.openMastheadActionMenu();

    await expect(actionMenu.getMenuItem('Edit Config')).toBeVisible();
    await expect(actionMenu.getMenuItem('Edit YAML')).toHaveCount(0);
  });

  test('saving a helm release secret sends a PATCH with only labels and annotations', async ({ page }) => {
    const editPage = await openEditPage(page, HELM_SECRET);

    await editPage.addLabel('e2e-patch', 'test');

    const request = await saveAndCaptureRequest(page, editPage, HELM_SECRET);

    expect(expectMetadataOnlyPatch(request)).toHaveLength(2);
  });

  test('helm release data survives after editing labels', async ({ page, rancherApi }) => {
    const editPage = await openEditPage(page, HELM_SECRET);

    await editPage.addLabel('e2e-survive', 'test');
    await saveAndCaptureRequest(page, editPage, HELM_SECRET);

    // Steve strips data.release for helm secrets, so read the secret straight from the kube API
    await expect
      .poll(
        async () => {
          const { body } = await readRawSecret(rancherApi, testNamespace, HELM_SECRET);

          return {
            release: body.data?.release,
            label: body.metadata?.labels?.['e2e-survive'],
          };
        },
        { message: 'label saved and data.release preserved' },
      )
      .toEqual({ release: HELM_RELEASE_DATA, label: 'test' });

    // Reopen the edit page and check the saved label on the Labels tab
    const reopened = await openEditPage(page, HELM_SECRET);

    await reopened.labelsTab().click();
    await expect.poll(async () => (await reopened.labelEntries())['e2e-survive']).toBe('test');
  });

  test('non-helm secrets keep the data editor, Edit as YAML and save with PUT', async ({ page }) => {
    const editPage = await openEditPage(page, OPAQUE_SECRET);

    await expect(editPage.helmReleaseBanner()).toHaveCount(0);
    await expect(editPage.dataEditorAddButton().first()).toBeVisible();
    await expect(editPage.createEditView().editYamlButton().self()).toBeVisible();

    await editPage.addLabel('e2e-opaque', 'test');

    // The Data tab still hosts the data editor for non-helm secrets
    await editPage.tabs().tab('data').click();
    await expect(editPage.dataEditorAddButton().first()).toBeVisible();

    const request = await saveAndCaptureRequest(page, editPage, OPAQUE_SECRET);

    expect(request.method()).toBe('PUT');
  });

  test('description is saved as an annotation without touching the release data', async ({ page, rancherApi }) => {
    const editPage = await openEditPage(page, HELM_SECRET);

    await editPage.descriptionInput().fill(DESCRIPTION_TEXT);

    const request = await saveAndCaptureRequest(page, editPage, HELM_SECRET);
    const ops = expectMetadataOnlyPatch(request);
    const annotationsOp = ops.find((o) => o.path === '/metadata/annotations');

    expect(JSON.stringify(annotationsOp?.value)).toContain(DESCRIPTION_ANNOTATION);
    expect(JSON.stringify(annotationsOp?.value)).toContain(DESCRIPTION_TEXT);

    await expect
      .poll(
        async () => {
          const { body } = await readRawSecret(rancherApi, testNamespace, HELM_SECRET);

          return {
            release: body.data?.release,
            description: body.metadata?.annotations?.[DESCRIPTION_ANNOTATION],
          };
        },
        { message: 'description annotation saved and data.release preserved' },
      )
      .toEqual({ release: HELM_RELEASE_DATA, description: DESCRIPTION_TEXT });

    // Reopen the edit page and check the persisted description
    const reopened = await openEditPage(page, HELM_SECRET);

    await expect(reopened.descriptionInput()).toHaveValue(DESCRIPTION_TEXT);
  });

  test.describe('real Helm app release secret', () => {
    /** Install a chart through the catalog action and report whether it reached deployed */
    async function installChart(rancherApi: RancherApi): Promise<boolean> {
      const { status } = await rancherApi.createRancherResource(
        'v1',
        `catalog.cattle.io.clusterrepos/${REPO}?action=install`,
        {
          charts: [
            {
              chartName: APP_CHART.chartName,
              version: APP_CHART.version,
              releaseName: APP_CHART.releaseName,
              annotations: CHART_ANNOTATIONS,
              values: {},
            },
          ],
          noHooks: false,
          timeout: '600s',
          wait: true,
          namespace: APP_NAMESPACE,
          projectId: '',
        },
        false,
        60_000,
      );

      if (![200, 201].includes(status)) {
        return false;
      }

      return waitForDeployed(rancherApi, APP_CHART.version);
    }

    /** Poll the catalog app until it is deployed at the given chart version */
    async function waitForDeployed(rancherApi: RancherApi, version: string): Promise<boolean> {
      return rancherApi.waitForRancherResource(
        'v1',
        'catalog.cattle.io.apps',
        `${APP_NAMESPACE}/${APP_CHART.releaseName}`,
        (resp) =>
          resp.status === 200 &&
          resp.body?.status?.summary?.state === 'deployed' &&
          resp.body?.spec?.chart?.metadata?.version === version,
        APP_INSTALL_ATTEMPTS,
        APP_POLL_MS,
      );
    }

    test.beforeAll(async ({ rancherApi }) => {
      test.setTimeout(15 * 60_000);

      await removeOwnedNamespace(rancherApi, APP_NAMESPACE, [APP_CHART.releaseName]);
      await createLabeledNamespace(rancherApi, APP_NAMESPACE);
    });

    test.afterAll(async ({ rancherApi }) => {
      test.setTimeout(10 * 60_000);
      await removeOwnedNamespace(rancherApi, APP_NAMESPACE, [APP_CHART.releaseName]);
    });

    test('editing the release secret of a real app keeps it deployed and upgradable', async ({ page, rancherApi }) => {
      test.setTimeout(10 * 60_000);

      await test.step('install the chart', async () => {
        expect(await installChart(rancherApi), `${APP_CHART.chartName} ${APP_CHART.version} deployed`).toBe(true);
      });

      const v1 = helmSecretName(APP_CHART.releaseName, 1);
      let releaseBefore = '';

      await test.step('add a label to the release secret', async () => {
        const { body } = await readRawSecret(rancherApi, APP_NAMESPACE, v1);

        releaseBefore = body.data?.release ?? '';
        expect(releaseBefore).not.toBe('');

        const editPage = await openEditPage(page, v1, APP_NAMESPACE);

        await editPage.addLabel(REAL_LABEL, 'test');

        const request = await saveAndCaptureRequest(page, editPage, v1, APP_NAMESPACE);

        expectMetadataOnlyPatch(request);

        await expect
          .poll(async () => (await readRawSecret(rancherApi, APP_NAMESPACE, v1)).body.metadata?.labels?.[REAL_LABEL])
          .toBe('test');

        const reopened = await openEditPage(page, v1, APP_NAMESPACE);

        await reopened.labelsTab().click();
        await expect.poll(async () => (await reopened.labelEntries())[REAL_LABEL]).toBe('test');
      });

      await test.step('app is still deployed and release data is unchanged', async () => {
        const app = await rancherApi.getRancherResource(
          'v1',
          'catalog.cattle.io.apps',
          `${APP_NAMESPACE}/${APP_CHART.releaseName}`,
        );

        expect(app.body.status?.summary?.state).toBe('deployed');

        const { body } = await readRawSecret(rancherApi, APP_NAMESPACE, v1);

        expect(body.data?.release).toBe(releaseBefore);

        const appPage = new InstalledAppDetailPagePo(page, CLUSTER, APP_NAMESPACE, APP_CHART.releaseName);

        await appPage.goTo();
        await appPage.waitForPage();
        await dismissWelcome(page);
        await expect(appPage.stateBadge()).toContainText('Deployed');
        await expect(appPage.resourcesPanel()).toBeVisible();
        await appPage.valuesTab().click();
        await expect(appPage.valuesPanel()).toBeVisible();
      });

      await test.step('remove the label again', async () => {
        const editPage = await openEditPage(page, v1, APP_NAMESPACE);

        await editPage.removeLabel(REAL_LABEL);

        const request = await saveAndCaptureRequest(page, editPage, v1, APP_NAMESPACE);

        expectMetadataOnlyPatch(request);

        await expect
          .poll(async () => {
            const { body } = await readRawSecret(rancherApi, APP_NAMESPACE, v1);

            return { label: body.metadata?.labels?.[REAL_LABEL], release: body.data?.release };
          })
          .toEqual({ label: undefined, release: releaseBefore });

        const reopened = await openEditPage(page, v1, APP_NAMESPACE);

        await reopened.labelsTab().click();
        await expect.poll(async () => Object.keys(await reopened.labelEntries())).not.toContain(REAL_LABEL);
        expect(Object.keys(await reopened.labelEntries())).toContain('owner');
      });

      await test.step('upgrade the chart and open the new revision', async () => {
        await rancherApi.createRancherResource(
          'v1',
          `catalog.cattle.io.clusterrepos/${REPO}?action=upgrade`,
          {
            charts: [
              {
                chartName: APP_CHART.chartName,
                version: APP_CHART.upgradeVersion,
                releaseName: APP_CHART.releaseName,
                annotations: CHART_ANNOTATIONS,
                values: {},
                resetValues: false,
              },
            ],
            noHooks: false,
            timeout: '600s',
            wait: true,
            namespace: APP_NAMESPACE,
            projectId: '',
          },
          true,
          60_000,
        );

        expect(await waitForDeployed(rancherApi, APP_CHART.upgradeVersion), 'upgrade deployed').toBe(true);

        await expect
          .poll(
            async () =>
              (await readRawSecret(rancherApi, APP_NAMESPACE, helmSecretName(APP_CHART.releaseName, 2), 0)).status,
            { message: 'revision 2 helm secret exists' },
          )
          .toBe(200);

        const appPage = new InstalledAppDetailPagePo(page, CLUSTER, APP_NAMESPACE, APP_CHART.releaseName);

        await appPage.goTo();
        await appPage.waitForPage();
        await dismissWelcome(page);
        await expect(appPage.stateBadge()).toContainText('Deployed');
        await expect(appPage.resourcesPanel()).toBeVisible();
      });
    });
  });
});
