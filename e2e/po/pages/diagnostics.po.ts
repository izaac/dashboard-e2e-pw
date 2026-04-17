import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

/**
 * Diagnostics page
 */
export default class DiagnosticsPagePo extends PagePo {
  static url = '/diagnostic';

  constructor(page: Page) {
    super(page, DiagnosticsPagePo.url);
  }

  diagnosticsPackageBtn(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="diagnostics-download-diagnostic-package"]');
  }

  downloadDiagnosticsModalActionBtn(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="download-diagnostics-modal-action"]');
  }
}
