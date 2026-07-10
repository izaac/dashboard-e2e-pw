import type { Locator } from '@playwright/test';
import ClusterManagerImportPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/import/cluster-import.po';

/**
 * Import page for a generic cluster.
 * Ported from upstream cypress/e2e/po/extensions/imported/cluster-import-generic.po.ts.
 */
export default class ClusterManagerImportGenericPagePo extends ClusterManagerImportPagePo {
  registriesAccordion(): Locator {
    return this.self().getByTestId('registries-accordion');
  }

  registriesAccordionBody(): Locator {
    return this.registriesAccordion().getByTestId('accordion-body');
  }

  networkingAccordion(): Locator {
    return this.self().getByTestId('networking-accordion');
  }

  versionManagementBanner(): Locator {
    return this.self().getByTestId('version-management-banner');
  }
}
