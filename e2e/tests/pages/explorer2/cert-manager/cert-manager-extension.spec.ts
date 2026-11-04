import path from 'path';
import fs from 'fs';
import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import { CertManagerOverviewPagePo, CertificateDetailPagePo } from '@/e2e/po/pages/explorer/cert-manager.po';
import { LONG } from '@/support/timeouts';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-18749-cert-manager-extension-support-evidence';

const CM_CRD = 'certificates.cert-manager.io';
const CERT_API = 'cert-manager.io.certificates';
const ISSUER_API = 'cert-manager.io.clusterissuers';

test.describe('Cert Manager Built-in Extension (#18749)', { tag: ['@explorer2', '@adminUser'] }, () => {
  let testNamespace = '';
  let clusterIssuerName = '';
  let activeCertName = '';
  let expiringCertName = '';

  test.beforeAll(async ({ rancherApi }) => {
    const crd = await rancherApi.getRancherResource(
      'v1',
      'apiextensions.k8s.io.customresourcedefinitions',
      CM_CRD,
      0,
    );

    test.skip(crd.status !== 200, 'cert-manager CRDs are not installed on the local cluster');

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    testNamespace = rancherApi.createE2EResourceName('qa-18749-cm');
    clusterIssuerName = rancherApi.createE2EResourceName('ci-18749');
    activeCertName = rancherApi.createE2EResourceName('cert-act');
    expiringCertName = rancherApi.createE2EResourceName('cert-exp');

    await rancherApi.createNamespace(testNamespace);

    await rancherApi.createRancherResource('v1', ISSUER_API, {
      type: 'cert-manager.io.clusterissuer',
      metadata: { name: clusterIssuerName },
      spec: { selfSigned: {} },
    });

    await rancherApi.createRancherResource('v1', CERT_API, {
      type: 'cert-manager.io.certificate',
      metadata: { name: activeCertName, namespace: testNamespace },
      spec: {
        secretName: `${activeCertName}-secret`,
        duration: '2160h',
        renewBefore: '360h',
        dnsNames: ['active.example.com'],
        issuerRef: { name: clusterIssuerName, kind: 'ClusterIssuer' },
      },
    });

    await rancherApi.createRancherResource('v1', CERT_API, {
      type: 'cert-manager.io.certificate',
      metadata: { name: expiringCertName, namespace: testNamespace },
      spec: {
        secretName: `${expiringCertName}-secret`,
        duration: '72h',
        renewBefore: '48h',
        dnsNames: ['expiring.example.com'],
        issuerRef: { name: clusterIssuerName, kind: 'ClusterIssuer' },
      },
    });
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      if (clusterIssuerName) {
        await rancherApi.deleteRancherResource('v1', ISSUER_API, clusterIssuerName, false);
      }
    } finally {
      if (testNamespace) {
        await rancherApi.deleteNamespace([testNamespace]);
      }
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('Cert Manager navigation group renders in Cluster Explorer', async ({ page }) => {
    const explorer = new PagePo(page, '/c/local/explorer');

    await explorer.goTo();
    await explorer.waitForPage();

    const nav = explorer.productNav();
    const group = nav.sideMenuGroupLocator('Cert Manager');

    await expect(group).toBeVisible({ timeout: LONG });
    await group.click();

    for (const label of ['Overview', 'Certificates', 'Issuers', 'Cluster Issuers']) {
      await expect(nav.sideMenuEntryLocator(label).first()).toBeVisible();
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-cert-manager-nav-group-appearance.png') });
  });

  test('Overview page shows status cards and deep-links to a filtered Certificates list', async ({ page }) => {
    const overview = new CertManagerOverviewPagePo(page);

    await overview.goTo();
    await overview.waitForPage();

    await expect(overview.certificatesSection()).toBeVisible({ timeout: LONG });
    await expect(overview.statusCard('Active')).toBeVisible();
    await expect(overview.statusCard('Expiring')).toBeVisible();

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-02-cert-manager-overview-cards.png') });

    await overview.statusCard('Expiring').click();

    await expect(page).toHaveURL(/cert-manager\.io\.certificate/);
    await expect(page).toHaveURL(/stateFilter=/);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-03-overview-state-filter-deep-link.png') });
  });

  test('Certificate detail view displays Ready status and issuance chain', async ({ page }) => {
    const detail = new CertificateDetailPagePo(page, testNamespace, activeCertName);

    await detail.goTo();
    await detail.waitForPage();

    await expect(detail.issuanceStatusCard()).toBeVisible({ timeout: LONG });
    await expect(detail.stateBadge()).toBeVisible();
    await expect(detail.stateBadge()).toContainText(/Active|Ready/i, { timeout: LONG });

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-05-certificate-detail-issuance-chain.png') });
  });

  test('Core Explorer navigation remains functional without route shadowing', async ({ page }) => {
    const workloads = new PagePo(page, '/c/local/explorer/workload');
    const overview = new CertManagerOverviewPagePo(page);

    await workloads.goTo();
    await workloads.waitForPage();
    await expect(page.getByRole('heading', { name: 'Workloads' }).first()).toBeVisible({ timeout: LONG });
    expect(await workloads.isFailWhaleVisible()).toBe(false);

    await overview.goTo();
    await overview.waitForPage();
    await expect(page.getByRole('heading', { name: /Cert Manager Overview/i }).first()).toBeVisible({ timeout: LONG });
    await expect(overview.certificatesSection()).toBeVisible({ timeout: LONG });
    expect(await overview.isFailWhaleVisible()).toBe(false);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-07-explorer-core-navigation-unshadowed.png') });
  });
});
