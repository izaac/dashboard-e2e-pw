import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CronHintBoxes {
  input: Box;
  hint: Box;
  tabs?: Box;
}

/**
 * Cron schedule input plus its human readable hint
 * (workload CronJob Schedule field, User Retention "process schedule" field).
 */
export default class CronScheduleHintPo extends ComponentPo {
  private hintSelector: string;
  private tabsSelector?: string;

  constructor(page: Page, inputSelector: string, hintSelector: string, tabsSelector?: string) {
    super(page, inputSelector);
    this.hintSelector = hintSelector;
    this.tabsSelector = tabsSelector;
  }

  /** CronJob create/edit form: Schedule input, hint beside it, general tabs row below */
  static forWorkload(page: Page): CronScheduleHintPo {
    return new CronScheduleHintPo(
      page,
      'input[aria-describedby="cron-schedule-hint"]',
      '[data-testid="cron-schedule-hint"]',
      ':is([data-testid="workload-horizontal-tabs"], [data-testid="workload-general-tabs"]) [role="tablist"]',
    );
  }

  /** User Retention page: hint node is the element whose id is the input aria-describedby value */
  static forUserRetention(page: Page): CronScheduleHintPo {
    return new CronScheduleHintPo(
      page,
      'input[data-testid="userRetentionCron"]',
      `xpath=//*[@id = //input[@data-testid="userRetentionCron"]/@aria-describedby]`,
    );
  }

  input(): Locator {
    return this.self();
  }

  hint(): Locator {
    return this.page.locator(this.hintSelector);
  }

  tabs(): Locator {
    if (!this.tabsSelector) {
      throw new Error('No tabs row configured for this cron schedule field');
    }

    return this.page.locator(this.tabsSelector).first();
  }

  async set(value: string): Promise<void> {
    const input = this.input();

    await input.scrollIntoViewIfNeeded();
    await input.fill(value);
  }

  /** Bounding boxes of the input, the hint and (when configured) the tabs row; null while any is not laid out */
  async boxes(): Promise<CronHintBoxes | null> {
    const input = await this.input().boundingBox();
    const hint = await this.hint().boundingBox();
    const tabs = this.tabsSelector ? await this.tabs().boundingBox() : undefined;

    if (!input || !hint || (this.tabsSelector && !tabs)) {
      return null;
    }

    return { input, hint, tabs: tabs ?? undefined };
  }
}
