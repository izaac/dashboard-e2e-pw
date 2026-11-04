import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

/**
 * Cert Manager built-in extension: overview page (`/c/<cluster>/explorer/cert-manager-overview`).
 */
export class CertManagerOverviewPagePo extends PagePo {
  static createPath(clusterId: string): string {
    return `/c/${clusterId}/explorer/cert-manager-overview`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, CertManagerOverviewPagePo.createPath(clusterId));
  }

  /** Certificates summary section */
  certificatesSection(): Locator {
    return this.page.locator('[data-testid="cert-manager-overview-certificates"]');
  }

  /** Summary status card (or state link) by visible label, e.g. "Active", "Expiring" */
  statusCard(label: string): Locator {
    return this.certificatesSection().getByText(label, { exact: false }).first();
  }
}

/**
 * Certificate detail view (`/c/<cluster>/explorer/cert-manager.io.certificate/<ns>/<name>`).
 */
export class CertificateDetailPagePo extends PagePo {
  static createPath(namespace: string, name: string, clusterId = 'local'): string {
    return `/c/${clusterId}/explorer/cert-manager.io.certificate/${namespace}/${name}`;
  }

  constructor(page: Page, namespace: string, name: string, clusterId = 'local') {
    super(page, CertificateDetailPagePo.createPath(namespace, name, clusterId));
  }

  issuanceStatusCard(): Locator {
    return this.page.locator('[data-testid="cert-manager-issuance-status-card"]');
  }

  stateBadge(): Locator {
    return this.self().locator('.masthead .badge-state, .state-banner, .badge-state').first();
  }
}
