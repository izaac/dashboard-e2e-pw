import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import ButtonDropdownPo from '@/e2e/po/components/button-dropdown.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';

class ContainerMountPo extends ComponentPo {
  nthMountPoint(i: number): LabeledInputPo {
    return new LabeledInputPo(this.page, `[data-testid="mount-path-${i}"] input:first-child`);
  }
}

export default class ContainerMountPathPo extends ComponentPo {
  constructor(page: Page, selector = '.dashboard-root') {
    super(page, selector);
  }

  addVolumeButton(): ButtonDropdownPo {
    return new ButtonDropdownPo(this.page, '[data-testid="container-storage-add-button"]');
  }

  async addVolume(label: string): Promise<void> {
    await this.addVolumeButton().toggle();
    await this.addVolumeButton().clickOptionWithLabel(label);
  }

  nthVolumeMount(i: number): ContainerMountPo {
    return new ContainerMountPo(this.page, `[data-testid="container-storage-mount-${i}"]`);
  }

  async removeVolume(i: number): Promise<void> {
    await this.self().locator(`[data-testid="container-storage-array-list"] [data-testid="remove-item-${i}"]`).click();
  }
}
