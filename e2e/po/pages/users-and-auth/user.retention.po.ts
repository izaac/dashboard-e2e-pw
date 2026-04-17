import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import ToggleSwitchPo from '@/e2e/po/components/toggle-switch.po';

export default class UserRetentionPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/auth/user.retention`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, UserRetentionPo.createPath(clusterId));
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]');
  }

  enableRegistryCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="registries-enable-checkbox"]');
  }

  disableAfterPeriodCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="disableAfterPeriod"]');
  }

  disableAfterPeriodInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="disableAfterPeriodInput"]');
  }

  deleteAfterPeriodCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="deleteAfterPeriod"]');
  }

  deleteAfterPeriodInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="deleteAfterPeriodInput"]');
  }

  userRetentionCron(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="userRetentionCron"]');
  }

  userRetentionDryRun(): ToggleSwitchPo {
    return new ToggleSwitchPo(this.page, '[data-testid="userRetentionDryRun"]');
  }

  userLastLoginDefault(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="userLastLoginDefault"]');
  }
}
