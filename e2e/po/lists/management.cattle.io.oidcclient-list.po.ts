import type { Page, Locator } from '@playwright/test';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import CopyToClipboardTextPo from '@/e2e/po/components/copy-to-clipboard-text.po';

export default class OidcClientsListPo extends BaseResourceList {
  constructor(page: Page) {
    super(page, '[data-testid="oidc-clients-list"]');
  }

  details(name: string, index: number): Locator {
    return this.resourceTable().sortableTable().rowWithName(name).column(index);
  }

  title(): Locator {
    return this.masthead().title();
  }

  issuerURL(): CopyToClipboardTextPo {
    return new CopyToClipboardTextPo(this.page, '[data-testid="oidc-clients-copy-clipboard-issuer-url"]');
  }

  discoveryDocument(): CopyToClipboardTextPo {
    return new CopyToClipboardTextPo(this.page, '[data-testid="oidc-clients-copy-clipboard-discovery-document"]');
  }

  jwksURI(): CopyToClipboardTextPo {
    return new CopyToClipboardTextPo(this.page, '[data-testid="oidc-clients-copy-clipboard-jwks-uri"]');
  }
}
