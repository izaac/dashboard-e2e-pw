import type { Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class VersionNumberPo extends ComponentPo {
  /** Get the link within the version component */
  link(): Locator {
    return this.self().locator('a');
  }
}
