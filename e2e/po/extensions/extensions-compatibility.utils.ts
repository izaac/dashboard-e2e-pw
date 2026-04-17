import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import ChartInstalledAppsListPagePo from '@/e2e/po/pages/chart-installed-apps.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';

const ROOT = '.dashboard-root';

export default class ExtensionsCompatibilityUtils {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  appsPage(): ChartInstalledAppsListPagePo {
    return new ChartInstalledAppsListPagePo(this.page);
  }

  chartInstallPage(): InstallChartPage {
    return new InstallChartPage(this.page);
  }

  genericPage(path: string): PagePo {
    return new PagePo(this.page, path);
  }

  genericResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, ROOT);
  }

  genericNameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ROOT);
  }

  genericResourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ROOT);
  }

  genericCodeMirror(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.page.locator(ROOT), '[data-testid="yaml-editor-code-mirror"]');
  }
}
