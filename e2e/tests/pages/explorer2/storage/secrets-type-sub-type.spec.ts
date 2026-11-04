import fs from 'fs';
import { test, expect } from '@/support/fixtures';
import { SecretsListPagePo } from '@/e2e/po/pages/explorer/secrets.po';
import ResourceDetailMetadataPo from '@/e2e/po/detail/resource-detail-metadata.po';
import {
  setTablePreferences,
  restoreTablePreferences,
  type SavedPrefs,
} from '@/e2e/tests/pages/explorer2/workloads/pagination.utils';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-16720-secret-type-header-summary-evidence';

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const SECRETS = {
  opaque: 'qa-opaque-secret',
  docker: 'qa-docker-secret',
  tls: 'qa-tls-secret',
  basicAuth: 'qa-basic-auth-secret',
};

const b64 = (value: string) => Buffer.from(value).toString('base64');

test.describe('Secrets type and sub-type', { tag: ['@explorer2', '@adminUser'] }, () => {
  let testNamespace: string;
  let savedPrefs: SavedPrefs;

  test.beforeAll(async ({ rancherApi }) => {
    testNamespace = rancherApi.createE2EResourceName('qa-16720-sec');

    await rancherApi.createNamespace(testNamespace);
    await rancherApi.createSecret(testNamespace, SECRETS.opaque, {
      type: 'Opaque',
      data: { key1: b64('value1') },
    });
    await rancherApi.createSecret(testNamespace, SECRETS.docker, {
      type: 'kubernetes.io/dockerconfigjson',
      data: {
        '.dockerconfigjson': b64(JSON.stringify({ auths: { 'registry.example.com': { auth: 'Zm9vOmJhcg==' } } })),
      },
    });
    await rancherApi.createSecret(testNamespace, SECRETS.tls, {
      type: 'kubernetes.io/tls',
      data: {
        'tls.crt': b64('-----BEGIN CERTIFICATE-----\nMIIB...-----END CERTIFICATE-----\n'),
        'tls.key': b64('-----BEGIN RSA PRIVATE KEY-----\nMIIE...-----END RSA PRIVATE KEY-----\n'),
      },
    });
    await rancherApi.createSecret(testNamespace, SECRETS.basicAuth, {
      type: 'kubernetes.io/basic-auth',
      data: { username: b64('admin'), password: b64('pass') },
    });

    // Scope the list to the seeded namespace so the list scenarios are deterministic
    savedPrefs = await setTablePreferences(rancherApi, [testNamespace]);
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      // Guard so a failed beforeAll does not mask its own error
      if (savedPrefs) {
        await restoreTablePreferences(rancherApi, savedPrefs);
      }
    } finally {
      // Namespace cleanup must run even when preference restoration throws
      if (testNamespace) {
        await rancherApi.deleteNamespace([testNamespace]);
      }
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('list column header displays Type instead of Kind', async ({ page }) => {
    const secretsListPage = new SecretsListPagePo(page, 'local');

    await secretsListPage.goTo();
    await secretsListPage.waitForPage();

    const table = secretsListPage.list().resourceTable().sortableTable();

    await expect(table.self()).toBeVisible();
    await expect(table.rowElementWithName(SECRETS.opaque)).toBeVisible();

    const headerNames = await table.headerNames();

    expect(headerNames).toContain('Type');
    expect(headerNames).not.toContain('Kind');

    await page.screenshot({ path: `${EVIDENCE_DIR}/scenario-01-secrets-list-type-header.png`, fullPage: true });
  });

  test('opaque secret detail summary shows Opaque', async ({ page }) => {
    await page.goto(`./c/local/explorer/secret/${testNamespace}/${SECRETS.opaque}`);

    const metadata = new ResourceDetailMetadataPo(page);

    await expect(metadata.self()).toContainText('Opaque');
    await expect(metadata.self()).not.toContainText('Kind: Secret');

    await page.screenshot({ path: `${EVIDENCE_DIR}/scenario-02-opaque-secret-detail-type.png`, fullPage: true });
  });

  test('docker registry secret detail summary shows kubernetes.io/dockerconfigjson', async ({ page }) => {
    await page.goto(`./c/local/explorer/secret/${testNamespace}/${SECRETS.docker}`);

    const metadata = new ResourceDetailMetadataPo(page);

    await expect(metadata.self()).toContainText('kubernetes.io/dockerconfigjson');
    await expect(metadata.self()).not.toContainText('Kind: Secret');

    await page.screenshot({ path: `${EVIDENCE_DIR}/scenario-03-registry-secret-detail-type.png`, fullPage: true });
  });

  test('TLS secret detail summary shows kubernetes.io/tls', async ({ page }) => {
    await page.goto(`./c/local/explorer/secret/${testNamespace}/${SECRETS.tls}`);

    const metadata = new ResourceDetailMetadataPo(page);

    await expect(metadata.self()).toContainText('kubernetes.io/tls');
    await expect(metadata.self()).not.toContainText('Kind: Secret');

    await page.screenshot({ path: `${EVIDENCE_DIR}/scenario-04-tls-secret-detail-type.png`, fullPage: true });
  });

  test('basic-auth secret detail summary shows kubernetes.io/basic-auth', async ({ page }) => {
    await page.goto(`./c/local/explorer/secret/${testNamespace}/${SECRETS.basicAuth}`);

    const metadata = new ResourceDetailMetadataPo(page);

    await expect(metadata.self()).toContainText('kubernetes.io/basic-auth');
    await expect(metadata.self()).not.toContainText('Kind: Secret');

    await page.screenshot({ path: `${EVIDENCE_DIR}/scenario-05-basic-auth-secret-detail-type.png`, fullPage: true });
  });

  test('sorting on the Type column toggles the sort direction icon', async ({ page }) => {
    const secretsListPage = new SecretsListPagePo(page, 'local');

    await secretsListPage.goTo();
    await secretsListPage.waitForPage();

    const table = secretsListPage.list().resourceTable().sortableTable();

    await expect(table.self()).toBeVisible();
    await expect(table.rowElementWithName(SECRETS.tls)).toBeVisible();

    // Type is th index 4 (checkbox 0, State 1, Name 2, Namespace 3, Type 4)
    const typeColIndex = 4;

    // The Type column is unsorted on first load, so the first click sets the
    // default direction (DESC icon state) and the second click toggles it.
    await table.sort(typeColIndex).click();
    await expect(table.sortIcon(typeColIndex, 'down')).toBeVisible();

    await table.sort(typeColIndex).click();
    await expect(table.sortIcon(typeColIndex, 'up')).toBeVisible();

    await expect(table.sortIcon(typeColIndex, 'down')).toBeHidden();

    await page.screenshot({ path: `${EVIDENCE_DIR}/scenario-06-secrets-list-type-sorting.png`, fullPage: true });
  });
});
