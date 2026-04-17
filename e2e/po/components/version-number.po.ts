import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class VersionNumberPo extends ComponentPo {
  async checkVersion(version: string): Promise<void> {
    await expect(this.self()).toContainText(version);
  }

  async checkNormalText(): Promise<void> {
    await expect(this.self()).not.toHaveClass(/version-small/);
  }

  async checkSmallText(): Promise<void> {
    await expect(this.self()).toHaveClass(/version-small/);
  }
}
