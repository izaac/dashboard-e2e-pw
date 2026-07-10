import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

export default class BasicsRke2 extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '.dashboard-root', parent);
  }

  kubernetesVersions(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="clusterBasics__kubernetesVersions"]');
  }

  networks(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="cluster-rke2-cni-select"]');
  }

  /** Banner that appears when CNI 'none' is selected — warns that manual intervention is needed. */
  networkNoneSelectedForCni(): Locator {
    return this.page.locator('[data-testid="clusterBasics__noneOptionSelectedForCni"]');
  }

  /**
   * Ingress port input on the Basics tab, located by its exact field label.
   * The upstream LabeledInput fields carry no data-testid, so we scope by the
   * `.labeled-input` wrapper whose label text matches exactly. Exact matching
   * avoids the 'Traefik HTTP' / 'Traefik HTTPS' substring collision.
   */
  private ingressPortInput(label: string): Locator {
    return this.self()
      .locator('.labeled-input')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator('input');
  }

  traefikHttpInput(): Locator {
    return this.ingressPortInput('Traefik HTTP');
  }

  traefikHttpsInput(): Locator {
    return this.ingressPortInput('Traefik HTTPS');
  }

  nginxHttpInput(): Locator {
    return this.ingressPortInput('Ingress-NGINX HTTP');
  }

  nginxHttpsInput(): Locator {
    return this.ingressPortInput('Ingress-NGINX HTTPS');
  }
}
