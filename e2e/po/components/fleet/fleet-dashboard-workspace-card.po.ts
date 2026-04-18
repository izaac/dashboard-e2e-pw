import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';

class ResourcePanelPo extends ComponentPo {
  chart(): Locator {
    return this.self().locator('[data-testid="chart-container"] .chart');
  }

  description(): Locator {
    return this.self().locator('[data-testid="description"]');
  }

  stateBadge(state: string): Locator {
    return this.self().locator(`.badge.bg-${state}`);
  }
}

class StatePanelPo extends ComponentPo {
  title(): Locator {
    return this.self().locator('.title .state-title');
  }

  card(name: string): Locator {
    return this.self().locator('[data-testid="item-card-header-title"]').filter({ hasText: name });
  }
}

class CardPanelPo extends ComponentPo {
  private workspace: string;

  constructor(page: Page, parent: Locator, workspace: string) {
    super(page, '.cards-panel', parent);
    this.workspace = workspace;
  }

  statePanel(stateDisplay: string): StatePanelPo {
    return new StatePanelPo(this.page, `[data-testid="state-panel-${stateDisplay}"]`, this.self());
  }
}

class TablePanelPo extends ComponentPo {
  constructor(page: Page, parent: Locator) {
    super(page, '.table-panel', parent);
  }
}

class ExpandedPanelPo extends ComponentPo {
  private workspace: string;

  constructor(page: Page, parent: Locator, workspace: string) {
    super(page, `[data-testid="fleet-dashboard-expanded-panel-${workspace}"]`, parent);
    this.workspace = workspace;
  }

  cardsPanel(): CardPanelPo {
    return new CardPanelPo(this.page, this.self(), this.workspace);
  }

  tablePanel(): TablePanelPo {
    return new TablePanelPo(this.page, this.self());
  }

  gitReposFilter(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Show Git Repos');
  }

  helmOpsFilter(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Show Helm Ops');
  }
}

export default class FleetDashboardWorkspaceCardPo extends ComponentPo {
  private workspace: string;

  constructor(page: Page, workspace: string) {
    super(page, `[data-testid="fleet-dashboard-workspace-card-${workspace}"]`);
    this.workspace = workspace;
  }

  resourcePanel(type: 'applications' | 'clusters' | 'cluster-groups'): ResourcePanelPo {
    return new ResourcePanelPo(this.page, `[data-testid="resource-panel-${type}"]`, this.self());
  }

  expandedPanel(): ExpandedPanelPo {
    return new ExpandedPanelPo(this.page, this.self(), this.workspace);
  }

  expandButton(): Locator {
    return this.self().locator(`[data-testid="workspace-expand-btn-${this.workspace}"]`);
  }
}
