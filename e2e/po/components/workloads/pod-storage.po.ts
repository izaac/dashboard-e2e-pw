import type { Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';
import ButtonDropdownPo from '@/e2e/po/components/button-dropdown.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

class WorkloadVolumePo extends ComponentPo {
  yamlEditor(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="yaml-editor-code-mirror"]');
  }
}

export default class WorkloadPodStoragePo extends ComponentPo {
  constructor(page: Page, selector = '.dashboard-root') {
    super(page, selector);
  }

  nthVolumeComponent(n: number): WorkloadVolumePo {
    return new WorkloadVolumePo(this.page, `[data-testid="volume-component-${n}"]`);
  }

  addVolumeButton(): ButtonDropdownPo {
    return new ButtonDropdownPo(this.page, '[data-testid="dropdown-button-storage-volume"]');
  }

  driverInput(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="workload-storage-driver"]');
  }
}
