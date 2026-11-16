import { test, expect } from '@playwright/experimental-ct-vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';

/**
 * rancher/dashboard#8149: vue-select only refreshes the selected option when
 * the options change and the model value is truthy, so a falsy value ('') kept
 * showing the stale label. The fix (7ce3425) adds an `_options` watcher that
 * re-resolves the selection, which is what makes this assertion pass.
 */
test('selected label follows an options change when the model value is falsy', async ({ mount }) => {
  const cmp = await mount(LabeledSelect, {
    props: {
      value: '',
      options: [
        {
          label: 'Foo',
          value: '',
        },
      ],
    },
  });

  const selected = cmp.locator('.vs__selected');

  await expect(selected).toHaveText('Foo');

  await cmp.update({
    props: {
      value: '',
      options: [
        {
          label: 'Baz',
          value: '',
        },
      ],
    },
  });

  await expect(selected).toHaveText('Baz');
});
