import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';

export class FleetHelmOpCreateEditPo extends PagePo {
  private static createPath(fleetWorkspace?: string, helmOpName?: string) {
    const root = '/c/_/fleet/application/fleet.cattle.io.helmop';

    return fleetWorkspace ? `${root}/${fleetWorkspace}/${helmOpName}` : `${root}/create`;
  }

  constructor(page: Page, fleetWorkspace?: string, helmOpName?: string) {
    super(page, FleetHelmOpCreateEditPo.createPath(fleetWorkspace, helmOpName));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  async setChart(chart: string): Promise<void> {
    await LabeledInputPo.byLabel(this.page, this.self(), 'Chart').set(chart);
  }

  async setRepository(repo: string): Promise<void> {
    await LabeledInputPo.byLabel(this.page, this.self(), 'Repository').set(repo);
  }

  async setVersion(version: string): Promise<void> {
    await LabeledInputPo.byLabel(this.page, this.self(), 'Version').set(version);
  }

  async setTargetNamespace(namespace: string): Promise<void> {
    await LabeledInputPo.byLabel(this.page, this.self(), 'Target Namespace').set(namespace);
  }

  targetClusterOptions(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="fleet-target-cluster-radio-button"]');
  }

  targetCluster(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="fleet-target-cluster-name-selector"]');
  }

  secretsSelector(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.self(), 'Secrets');
  }

  configMapsSelector(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.self(), 'Config Maps');
  }
}
