import type { Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class LoadingPo extends ComponentPo {
  constructor(page: Page, selector = '.loading-indicator') {
    super(page, selector);
  }
}
