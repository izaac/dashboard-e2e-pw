import { beforeMount } from '@playwright/experimental-ct-vue/hooks';
import { createStore } from 'vuex';
import vSelect from 'vue-select';
import { defineComponent, h } from 'vue';

/**
 * Globals every mounted dashboard component expects from the app shell.
 *
 * The store exists because LabeledSelect calls useLabeledSelectPagination,
 * which calls useStore unconditionally. Only the getters that are read during
 * mount need to be real; i18n/t returns the key unchanged.
 */
const store = createStore({
  getters: {
    'i18n/t': () => (key: string) => key,
    'cluster/paginationEnabled': () => () => false,
  },
});

/** Stub of the `t` i18n render component, used by the label slot. */
const T = defineComponent({
  name: 't',
  props: { k: { type: String, default: '' } },
  render() {
    return h('span', (this as any).k);
  },
});

beforeMount(async ({ app }) => {
  app.use(store);
  app.component('v-select', vSelect as any);
  app.component('t', T);
});
