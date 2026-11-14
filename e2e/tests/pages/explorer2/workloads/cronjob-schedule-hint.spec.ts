import { test, expect } from '@/support/fixtures';
import {
  WorkloadsCronJobsCreatePagePo,
  WorkloadsCronJobsEditPagePo,
} from '@/e2e/po/pages/explorer/workloads/workloads-cronjobs.po';
import UserRetentionPo from '@/e2e/po/pages/users-and-auth/user.retention.po';
import type CronScheduleHintPo from '@/e2e/po/components/cron-schedule-hint.po';
import { EXTRA_LONG } from '@/support/timeouts';

const CRON_EXPRESSION = '53 18 30 4 3';
const CRON_EXPRESSION_HINT = 'At 06:53 PM, on day 30 of the month, and on Wednesday, only in April';
const DAILY_HINT = 'At 12:00 AM, every day';
const INVALID_HINT = 'Invalid cron schedule';

// Pixel tolerance for sub-pixel layout rounding
const TOLERANCE = 2;
// Vertical centres of the input and the hint must be this close to count as "on the same row"
const ROW_TOLERANCE = 8;

/**
 * The hint sits to the right of the Schedule input, on the same row, and clears the tabs row below.
 * Polled so the check settles after the debounced hint renders and the layout reflows.
 */
async function expectHintBesideInput(schedule: CronScheduleHintPo): Promise<void> {
  await expect(schedule.hint()).toBeVisible();

  await expect
    .poll(
      async () => {
        const boxes = await schedule.boxes();

        if (!boxes || !boxes.tabs) {
          return null;
        }

        const { input, hint, tabs } = boxes;

        return {
          rightOfInput: hint.x >= input.x + input.width - TOLERANCE,
          sameRow: Math.abs(hint.y + hint.height / 2 - (input.y + input.height / 2)) <= ROW_TOLERANCE,
          aboveTabs: hint.y + hint.height <= tabs.y + TOLERANCE,
        };
      },
      { message: 'hint is right of the input, vertically aligned with it and above the tabs row' },
    )
    .toEqual({ rightOfInput: true, sameRow: true, aboveTabs: true });
}

test.describe('CronJob Schedule cron hint (#14227)', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('Create form', () => {
    test('shows the cron hint beside the Schedule input, also on a narrow viewport', async ({ page, login }) => {
      await login();

      const createPage = new WorkloadsCronJobsCreatePagePo(page);
      const schedule = createPage.schedule();

      await createPage.goTo();
      await createPage.waitForPage();
      await expect(schedule.input()).toBeVisible();

      await schedule.set(CRON_EXPRESSION);
      await expect(schedule.hint()).toHaveText(CRON_EXPRESSION_HINT);
      await expectHintBesideInput(schedule);

      await page.setViewportSize({ width: 900, height: 1000 });
      await expect(schedule.hint()).toHaveText(CRON_EXPRESSION_HINT);
      await expectHintBesideInput(schedule);
    });

    test('hint follows macros, invalid values and a cleared input', async ({ page, login }) => {
      await login();

      const createPage = new WorkloadsCronJobsCreatePagePo(page);
      const schedule = createPage.schedule();

      await createPage.goTo();
      await createPage.waitForPage();
      await expect(schedule.input()).toBeVisible();

      await schedule.set('@daily');
      await expect(schedule.hint()).toHaveText(DAILY_HINT);

      await schedule.set('abc');
      await expect(schedule.hint()).toHaveText(INVALID_HINT);

      await schedule.set('');
      await expect(schedule.hint()).toBeEmpty();
    });
  });

  test.describe('Edit form', () => {
    let cronJobName: string;

    test.beforeEach(async ({ rancherApi }) => {
      cronJobName = `e2e-cronhint-${Math.random().toString(36).slice(2, 8)}`;

      await rancherApi.createRancherResource('v1', 'batch.cronjobs', {
        apiVersion: 'batch/v1',
        kind: 'CronJob',
        metadata: { name: cronJobName, namespace: 'default' },
        spec: {
          schedule: CRON_EXPRESSION,
          suspend: true,
          jobTemplate: {
            spec: {
              template: {
                spec: {
                  containers: [{ name: 'busybox', image: 'busybox' }],
                  restartPolicy: 'OnFailure',
                },
              },
            },
          },
        },
      });
    });

    test.afterEach(async ({ rancherApi }) => {
      await rancherApi.deleteRancherResource('v1', 'batch.cronjobs', `default/${cronJobName}`, false);
    });

    test('shows the cron hint beside the Schedule input of an existing CronJob', async ({ page, login }) => {
      test.setTimeout(EXTRA_LONG);
      await login();

      const editPage = new WorkloadsCronJobsEditPagePo(page, cronJobName);
      const schedule = editPage.schedule();

      await editPage.goToEdit();
      await expect(schedule.input()).toHaveValue(CRON_EXPRESSION);
      await expect(schedule.hint()).toHaveText(CRON_EXPRESSION_HINT);
      await expectHintBesideInput(schedule);
    });
  });
});

test.describe('Cron hint regression: User Retention', { tag: ['@usersAndAuths', '@adminUser'] }, () => {
  test('hint stays below the cron input and nothing is saved', async ({ page, login, rancherApi }) => {
    await login();

    const settingsBefore = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings');
    const cronBefore = settingsBefore.body.data.find((s: any) => s.id === 'user-retention-cron')?.value ?? null;
    const writes: string[] = [];

    page.on('request', (req) => {
      if (req.method() !== 'GET' && req.url().includes('/management.cattle.io.settings')) {
        writes.push(`${req.method()} ${req.url()}`);
      }
    });

    const retention = new UserRetentionPo(page, 'local');
    const schedule = retention.userRetentionCronSchedule();

    await retention.goTo();
    await retention.waitForPage();
    await retention.disableAfterPeriodCheckbox().set();
    await expect(schedule.input()).toBeVisible();

    await schedule.set(CRON_EXPRESSION);
    await expect(schedule.hint()).toHaveText(CRON_EXPRESSION_HINT);

    await expect
      .poll(
        async () => {
          const boxes = await schedule.boxes();

          return boxes ? boxes.hint.y >= boxes.input.y + boxes.input.height - TOLERANCE : null;
        },
        { message: 'hint is below the input' },
      )
      .toBe(true);

    await schedule.set('bogus');
    await expect(schedule.hint()).toHaveText(INVALID_HINT);

    // Never saved: no write requests were issued and the stored setting is unchanged
    expect(writes).toEqual([]);

    const settingsAfter = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings');

    expect(settingsAfter.body.data.find((s: any) => s.id === 'user-retention-cron')?.value ?? null).toBe(cronBefore);
  });
});
