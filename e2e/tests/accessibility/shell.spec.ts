import { test, expect } from '@/support/fixtures';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import AboutPagePo from '@/e2e/po/pages/about.po';
import PreferencesPagePo from '@/e2e/po/pages/preferences.po';
import UserMenuPo from '@/e2e/po/side-bars/user-menu.po';
import AccountPagePo from '@/e2e/po/pages/account-api-keys.po';
import CreateKeyPagePo from '@/e2e/po/pages/account-api-keys-create_key.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import CardPo from '@/e2e/po/components/card.po';
import ProductNavPo from '@/e2e/po/components/product-nav.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import LoadingPo from '@/e2e/po/components/loading.po';
import { WorkloadsDeploymentsListPagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import ExtensionsPagePo from '@/e2e/po/pages/extensions.po';
import { SettingsPagePo } from '@/e2e/po/pages/global-settings/settings.po';
import PodSecurityAdmissionsPagePo from '@/e2e/po/pages/cluster-manager/pod-security-admissions.po';
import BannersPo from '@/e2e/po/components/banners.po';
import { HomeLinksPagePo } from '@/e2e/po/pages/global-settings/home-links.po';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import { EventsCreateEditPo, EventsPageListPo } from '@/e2e/po/pages/explorer/events.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import { ProjectsNamespacesListPagePo, NamespaceCreateEditPagePo, ProjectCreateEditPagePo } from '@/e2e/po/pages/explorer/projects-namespaces.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import { dialogModal, promptModal } from '@/e2e/po/prompts/modalInstances.po';
import ClusterToolsPagePo from '@/e2e/po/pages/explorer/cluster-tools.po';
import { WorkLoadsDaemonsetsCreatePagePo, WorkloadsDaemonsetsListPagePo } from '@/e2e/po/pages/explorer/workloads-daemonsets.po';
import { SecretsCreateEditPo, SecretsListPagePo } from '@/e2e/po/pages/explorer/secrets.po';
import SlideInPo from '@/e2e/po/side-bars/slide-in.po';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import DigitalOceanCloudCredentialsCreateEditPo from '@/e2e/po/edit/cloud-credentials-digitalocean.po';
import KontainerDriversPagePo from '@/e2e/po/pages/cluster-manager/kontainer-drivers.po';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';
import UserRetentionPo from '@/e2e/po/pages/users-and-auth/user.retention.po';
import ResourceSearchDialog from '@/e2e/po/prompts/ResourceSearchDialog.po';
import { StorageClassesPagePo } from '@/e2e/po/pages/explorer/storage-classes.po';
import { BrandingPagePo } from '@/e2e/po/pages/global-settings/branding.po';
import { BannersPagePo } from '@/e2e/po/pages/global-settings/banners.po';
import { FleetApplicationCreatePo, FleetGitRepoCreateEditPo } from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';

// Accessibility check helpers using @axe-core/playwright
// These replace cy.injectAxe() + cy.checkPageAccessibility() / cy.checkElementAccessibility()
import AxeBuilder from '@axe-core/playwright';

async function checkPageAccessibility(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
}

async function checkElementAccessibility(page: import('@playwright/test').Page, selector: string) {
  const results = await new AxeBuilder({ page }).include(selector).analyze();

  expect(results.violations).toEqual([]);
}

test.describe('Shell a11y testing', { tag: ['@adminUser', '@accessibility'] }, () => {
  test.describe('Login page', () => {
    test('login page', async ({ page }) => {
      const loginPage = new LoginPagePo(page);

      await loginPage.goTo();
      await loginPage.waitForPage();
      await loginPage.username().set('test user');

      await checkPageAccessibility(page);
    });

    test('locale selector', async ({ page }) => {
      const loginPage = new LoginPagePo(page);

      await loginPage.goTo();
      await loginPage.waitForPage();
      await loginPage.localSelector().click();

      await checkPageAccessibility(page);
    });
  });

  test.describe('Logged in', () => {
    test.beforeEach(async ({ page, login }) => {
      await login();
    });

    test('Home page', async ({ page }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      await checkPageAccessibility(page);
    });

    test('About page', async ({ page }) => {
      const aboutPage = new AboutPagePo(page);
      const burgerMenu = new BurgerMenuPo(page);

      await burgerMenu.toggle();
      await burgerMenu.about().click();
      await aboutPage.waitForPage();

      await checkPageAccessibility(page);
    });

    test('Preferences page', async ({ page }) => {
      const userMenu = new UserMenuPo(page);
      const prefPage = new PreferencesPagePo(page);

      await userMenu.clickMenuItem('Preferences');
      await userMenu.isClosed();
      await prefPage.waitForPage();

      await checkPageAccessibility(page);
    });

    test('Fleet GitRepo - Add Repository page', async ({ page }) => {
      const appBundleCreatePage = new FleetApplicationCreatePo(page);
      const gitRepoCreatePage = new FleetGitRepoCreateEditPo(page);

      await appBundleCreatePage.goTo();
      await appBundleCreatePage.waitForPage();

      await appBundleCreatePage.createGitRepo();
      await gitRepoCreatePage.waitForPage();
      await gitRepoCreatePage.resourceDetail().createEditView().nameNsDescription()
        .name()
        .checkVisible();

      await checkPageAccessibility(page);
    });

    test.describe('Account and API Keys', () => {
      test('Account and API Keys Page', async ({ page }) => {
        const accountPage = new AccountPagePo(page);

        await accountPage.goTo();
        await accountPage.waitForPage();
        await accountPage.title();

        await checkPageAccessibility(page);
      });

      test('Change Password dialog', async ({ page }) => {
        const accountPage = new AccountPagePo(page);

        await accountPage.goTo();
        await accountPage.waitForPage();
        await accountPage.changePassword();
        await accountPage.currentPassword().checkVisible();

        await checkElementAccessibility(page, '[data-testid="change-password__modal"]');

        await promptModal(page).clickActionButton('Cancel');
      });

      test('API Key - Create', async ({ page }) => {
        const accountPage = new AccountPagePo(page);
        const createKeyPage = new CreateKeyPagePo(page);

        await accountPage.goTo();
        await accountPage.waitForPage();
        await accountPage.create();
        await createKeyPage.waitForPage();
        await expect(createKeyPage.mastheadTitle()).toContainText('API Key: Create');

        await checkPageAccessibility(page);

        await createKeyPage.cancel();
        await accountPage.waitForPage();
      });

      test('API Key - Delete', async ({ page }) => {
        const accountPage = new AccountPagePo(page);

        await accountPage.goTo();
        await accountPage.waitForPage();
        await accountPage.title();

        const sortableTable = accountPage.list().resourceTable().sortableTable();

        await sortableTable.selectAllCheckbox().self().click();
        await sortableTable.deleteButton().click();

        await checkPageAccessibility(page);
      });
    });

    test.describe('Explorer', () => {
      test.describe('Cluster', () => {
        test('Cluster Dashboard page', async ({ page }) => {
          const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

          await clusterDashboard.goTo();
          await clusterDashboard.waitForPage();

          await checkPageAccessibility(page);
        });

        test('Cluster Appearance Modal', async ({ page }) => {
          const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

          await clusterDashboard.goTo();
          await clusterDashboard.waitForPage();
          await clusterDashboard.customizeAppearanceButton().click();

          const customClusterCard = new CardPo(page);

          await expect(customClusterCard.getTitle()).toContainText('Cluster Appearance');

          await checkElementAccessibility(page, '[data-testid="card"]');

          await promptModal(page).clickActionButton('Cancel');
        });

        test.describe('Projects-Namespaces', () => {
          test('Projects-Namespaces - Move dialog', async ({ page }) => {
            const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);
            const sideNav = new ProductNavPo(page);

            await projectsNamespacesPage.goTo();
            await projectsNamespacesPage.waitForPage();

            const sortableTable = projectsNamespacesPage.list().resourceTable().sortableTable();
            const actionMenu = await sortableTable.rowActionMenuOpen('cattle-fleet-system');

            await actionMenu.getMenuItem('Move').click();

            await checkElementAccessibility(page, '.modal-container');

            await promptModal(page).clickActionButton('Cancel');
          });

          test('Projects-Namespaces - Delete Project dialog', async ({ page }) => {
            const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

            await projectsNamespacesPage.goTo();
            await projectsNamespacesPage.waitForPage();

            const sortableTable = projectsNamespacesPage.list().resourceTable().sortableTable();

            await sortableTable.groupByButtons(1).click();

            const actionMenu = await sortableTable.rowActionMenuOpen('Project: Default');

            await actionMenu.getMenuItem('Delete').click();

            const promptRemoveEl = new PromptRemove(page);

            await checkElementAccessibility(page, '[data-testid="card"].prompt-remove');

            await promptRemoveEl.cancel();
          });

          test('Projects-Namespaces - Create Project', async ({ page }) => {
            const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

            await projectsNamespacesPage.goTo();
            await projectsNamespacesPage.waitForPage();
            await projectsNamespacesPage.baseResourceList().masthead().create();
            await expect(projectsNamespacesPage.mastheadTitle()).toContainText('Project: Create');

            const createProjectPage = new ProjectCreateEditPagePo(page);

            await createProjectPage.waitForPage(undefined, 'members');
            await createProjectPage.resourceDetail().createEditView()
              .nameNsDescription()
              .name()
              .checkVisible();

            await checkPageAccessibility(page);
          });

          test('Projects-Namespaces - Add Project Member', async ({ page }) => {
            const createProjectPage = new ProjectCreateEditPagePo(page);

            await createProjectPage.goTo();
            await createProjectPage.waitForPage();
            await expect(createProjectPage.addProjectMemberButton()).toBeVisible();
            await createProjectPage.addProjectMemberButton().click();
            await expect(promptModal(page).getBody()).toBeVisible();

            await checkElementAccessibility(page, '.modal-container');

            await promptModal(page).clickActionButton('Cancel');

            await createProjectPage.resourceDetail().cruResource()
              .cancel()
              .click();
          });

          test('Projects-Namespaces - Create Namespace', async ({ page }) => {
            const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

            await projectsNamespacesPage.goTo();
            await projectsNamespacesPage.waitForPage();

            const sortableTable = projectsNamespacesPage.list().resourceTable().sortableTable();

            await sortableTable.groupByButtons(0).click();
            await expect(projectsNamespacesPage.createNamespaceButton()).toBeVisible();
            await projectsNamespacesPage.createNamespaceButton().click();
            await expect(projectsNamespacesPage.mastheadTitle()).toContainText('Namespace: Create');

            const createNamespacePage = new NamespaceCreateEditPagePo(page);

            await createNamespacePage.waitForPage('flatView=true', 'container-resource-limit');
            await createNamespacePage.resourceDetail().createEditView()
              .nameNsDescription()
              .name()
              .checkVisible();

            await checkPageAccessibility(page);

            await createNamespacePage.resourceDetail().cruResource()
              .cancel()
              .click();
          });

          test('Projects-Namespaces Page', async ({ page }) => {
            const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

            await projectsNamespacesPage.goTo();
            await projectsNamespacesPage.waitForPage();
            await expect(projectsNamespacesPage.list().masthead().title()).toContainText('Projects/Namespaces');

            await checkPageAccessibility(page);
          });
        });

        test.describe('Tools', () => {
          test('Cluster Tools Page', async ({ page }) => {
            const clusterTools = new ClusterToolsPagePo(page, 'local');
            const sideNav = new ProductNavPo(page);

            await clusterTools.goTo();
            await clusterTools.waitForPage();
            await expect(clusterTools.featureChartCards()).toBeVisible();

            await checkPageAccessibility(page);
          });
        });

        test.describe('Events', () => {
          test('Cluster events page', async ({ page }) => {
            const events = new EventsPageListPo(page, 'local');
            const sideNav = new ProductNavPo(page);

            await events.goTo();
            await events.waitForPage();
            await events.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

            await checkPageAccessibility(page);
          });

          test('Create event from YAML', async ({ page }) => {
            const events = new EventsPageListPo(page, 'local');
            const createEventPage = new EventsCreateEditPo(page);

            await events.goTo();
            await events.waitForPage();
            await events.baseResourceList().masthead().createYaml();
            await createEventPage.waitForPage('as=yaml');
            await expect(events.mastheadTitle()).toContainText('Event: Create');
            await createEventPage.resourceDetail().resourceYaml()
              .codeMirror()
              .checkExists();

            await checkPageAccessibility(page);

            await createEventPage.resourceDetail().resourceYaml()
              .cancel();
          });
        });
      });

      test.describe('Workloads', () => {
        test('Deployments page', async ({ page }) => {
          const deploymentsListPage = new WorkloadsDeploymentsListPagePo(page);

          await deploymentsListPage.goTo();
          await deploymentsListPage.waitForPage();

          await checkPageAccessibility(page);
        });

        test('DaemonSets - Create', async ({ page }) => {
          const daemonsetsListPage = new WorkloadsDaemonsetsListPagePo(page);
          const daemonsetsCreatePage = new WorkLoadsDaemonsetsCreatePagePo(page, 'local');

          await daemonsetsListPage.goTo();
          await daemonsetsListPage.waitForPage();
          await daemonsetsListPage.baseResourceList().masthead().create();
          await daemonsetsCreatePage.waitForPage();
          await daemonsetsCreatePage.resourceDetail().createEditView().nameNsDescription()
            .name()
            .checkVisible();

          await checkPageAccessibility(page);

          await daemonsetsCreatePage.resourceDetail().cruResource()
            .cancel()
            .click();
        });
      });

      test.describe('Storage', () => {
        test('Secret - Create page', async ({ page }) => {
          const secretsListPage = new SecretsListPagePo(page, 'local');
          const secretsCreatePage = new SecretsCreateEditPo(page, 'local');

          await secretsListPage.goTo();
          await secretsListPage.waitForPage();
          await secretsListPage.createButton().click();
          await secretsCreatePage.waitForPage();
          await expect(secretsCreatePage.mastheadTitle()).toContainText('Secret: Create');
          await expect(secretsCreatePage.resourceDetail().cruResource().findSubTypeByName('custom')).toBeVisible();

          await checkPageAccessibility(page);
        });

        test('Secret - Describe Resource', async ({ page }) => {
          const secretsListPage = new SecretsListPagePo(page, 'local');
          const secretsCreatePage = new SecretsCreateEditPo(page, 'local');
          const header = new HeaderPo(page);
          const slideIn = new SlideInPo(page);

          await secretsListPage.goTo();
          await secretsListPage.waitForPage();
          await secretsListPage.createButton().click();
          await secretsCreatePage.waitForPage();

          await header.kubectlExplain().click();

          await slideIn.checkVisible();
          await slideIn.waitforContent();

          await checkPageAccessibility(page);

          await slideIn.closeButton().click();
          await slideIn.checkNotVisible();
        });

        test('Storage Class - Create', async ({ page }) => {
          const storageClasses = new StorageClassesPagePo(page);

          await storageClasses.goTo();
          await storageClasses.waitForPage();
          await storageClasses.clickCreate();
          await storageClasses.createStorageClassesForm().waitForPage(undefined, 'parameters');
          await expect(storageClasses.mastheadTitle()).toContainText('StorageClass: Create');

          await checkPageAccessibility(page);
        });
      });

      test.describe('Header', () => {
        test('Import YAML', async ({ page }) => {
          const clusterDashboard = new ClusterDashboardPagePo(page, 'local');
          const header = new HeaderPo(page);

          await clusterDashboard.goTo();
          await clusterDashboard.waitForPage();
          await header.importYamlHeaderAction().click();
          await header.importYaml().checkVisible();

          await checkElementAccessibility(page, '[data-testid="import-yaml"]');

          await header.importYaml().importYamlCancelClick();
          await header.importYaml().checkNotExists();
        });

        test('Kubectl Shell', async ({ page }) => {
          const clusterDashboard = new ClusterDashboardPagePo(page, 'local');
          const header = new HeaderPo(page);

          await clusterDashboard.goTo();
          await clusterDashboard.waitForPage();
          await header.kubectlShell().openTerminal();
          await header.kubectlShell().waitForTerminalToBeVisible();

          await checkElementAccessibility(page, '#horizontal-window-manager');

          await header.kubectlShell().closeTerminal();
        });

        test('Resource Search', async ({ page }) => {
          const clusterDashboard = new ClusterDashboardPagePo(page, 'local');
          const header = new HeaderPo(page);
          const dialog = new ResourceSearchDialog(page);

          await clusterDashboard.goTo();
          await clusterDashboard.waitForPage();
          await header.resourceSearchButton().click();
          await expect(dialog.searchBox()).toBeVisible();

          await checkElementAccessibility(page, '[data-testid="search-modal"]');

          await dialog.close();
          await dialog.checkNotExists();
        });
      });
    });

    test.describe('Cluster Management', () => {
      test('Clusters - Create page', async ({ page }) => {
        const createClusterPage = new ClusterManagerCreatePagePo(page);
        const loadingPo = new LoadingPo(page, '.loading-indicator');

        await createClusterPage.goTo();
        await createClusterPage.waitForPage();
        await loadingPo.checkNotExists();

        await checkPageAccessibility(page);
      });

      test('Cluster - Create Digital Ocean Cloud Credential', async ({ page }) => {
        const clusterList = new ClusterManagerListPagePo(page);
        const createClusterPage = new ClusterManagerCreatePagePo(page);
        const loadingPo = new LoadingPo(page, '.loading-indicator');
        const burgerMenu = new BurgerMenuPo(page);

        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Cluster Management');
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await createClusterPage.selectCreate(2);
        await loadingPo.checkNotExists();
        await expect(createClusterPage.rke2PageTitle()).toContainText('Create DigitalOcean');
        await createClusterPage.waitForPage('type=digitalocean&rkeType=rke2');

        await checkPageAccessibility(page);
      });

      test('Cluster - Create Digital Ocean', async ({ page, rancherApi }) => {
        const clusterList = new ClusterManagerListPagePo(page);
        const createClusterPage = new ClusterManagerCreatePagePo(page);
        const cloudCredForm = new DigitalOceanCloudCredentialsCreateEditPo(page);
        const loadingPo = new LoadingPo(page, '.loading-indicator');
        const burgerMenu = new BurgerMenuPo(page);

        // Navigate to create DigitalOcean cluster
        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Cluster Management');
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await createClusterPage.selectCreate(2);
        await loadingPo.checkNotExists();
        await createClusterPage.waitForPage('type=digitalocean&rkeType=rke2');

        // Fake cloud credential authentication
        await page.route('**/meta/proxy/api.digitalocean.com/v2/regions?per_page=1000', (route) => {
          route.fulfill({ status: 200, body: '{}' });
        });

        // Create fake cloud credential
        await cloudCredForm.credentialName().set('doCloudCredName');
        await cloudCredForm.accessToken().set('fakeToken');
        await cloudCredForm.saveCreateForm().cruResource().saveOrCreate().click();

        await createClusterPage.waitForPage('type=digitalocean&rkeType=rke2', 'basic');
        await expect(createClusterPage.rke2PageTitle()).toContainText('Create DigitalOcean');

        await checkPageAccessibility(page);

        // Clean up digital ocean cloud credentials
        const resp = await rancherApi.getRancherResource('v3', 'cloudcredentials');

        if (resp.pagination?.total > 0) {
          for (const item of resp.data) {
            if (item.digitaloceancredentialConfig) {
              await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id);
            }
          }
        }
      });

      test('Cluster drivers page', async ({ page }) => {
        const driversPage = new KontainerDriversPagePo(page);
        const sideNav = new ProductNavPo(page);
        const burgerMenu = new BurgerMenuPo(page);

        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Cluster Management');
        await sideNav.navToSideMenuGroupByLabel('Providers');
        await sideNav.navToSideMenuEntryByLabel('Cluster Drivers');
        await driversPage.waitForPage();
        await expect(driversPage.list().masthead().title()).toContainText('Cluster Drivers');
        await driversPage.list().resourceTable().sortableTable().checkVisible();
        await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

        await checkPageAccessibility(page);
      });

      test('Pod Security Admissions - Create page', async ({ page }) => {
        const podSecurityAdmissionsPage = new PodSecurityAdmissionsPagePo(page);
        const sideNav = new ProductNavPo(page);
        const burgerMenu = new BurgerMenuPo(page);

        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Cluster Management');
        await sideNav.groups().filter({ hasText: 'Advanced' }).click();
        await sideNav.navToSideMenuEntryByLabel('Pod Security Admissions');
        await podSecurityAdmissionsPage.waitForPage();
        await podSecurityAdmissionsPage.create();
        await podSecurityAdmissionsPage.createPodSecurityAdmissionForm().waitForPage();

        // Trigger error banner with invalid resource name
        await podSecurityAdmissionsPage.createPodSecurityAdmissionForm().nameNsDescription().name().set('AAA');
        await podSecurityAdmissionsPage.createPodSecurityAdmissionForm().resourceDetail().cruResource().saveOrCreate()
          .click();

        const banner = new BannersPo(page, '[data-testid="error-banner0"]');

        await banner.checkVisible();

        await checkPageAccessibility(page);
      });

      test('Repositories - Create page', async ({ page }) => {
        const repositoriesPage = new ChartRepositoriesPagePo(page, undefined, 'manager');
        const sideNav = new ProductNavPo(page);
        const burgerMenu = new BurgerMenuPo(page);

        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Cluster Management');

        const clusterList = new ClusterManagerListPagePo(page);

        await clusterList.waitForPage();
        await sideNav.groups().filter({ hasText: 'Advanced' }).click();
        await sideNav.navToSideMenuEntryByLabel('Repositories');
        await repositoriesPage.waitForPage();
        await repositoriesPage.create();
        await repositoriesPage.createEditRepositories().waitForPage();
        await repositoriesPage.createEditRepositories().lablesAnnotationsKeyValue().addButton('Add Label').click();

        await checkPageAccessibility(page);
      });
    });

    test.describe('Users', () => {
      test('Users page', async ({ page }) => {
        const usersPo = new UsersPo(page, '_');
        const burgerMenu = new BurgerMenuPo(page);
        const sideNav = new ProductNavPo(page);

        const getUsersPromise = page.waitForResponse((resp) => resp.url().includes('/v1/management.cattle.io.users') && resp.status() === 200);

        await usersPo.goTo();
        await usersPo.waitForPage();
        await expect(usersPo.list().masthead().title()).toContainText('Users');
        await getUsersPromise;
        await usersPo.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
        await usersPo.list().refreshGroupMembership().checkVisible();

        await checkPageAccessibility(page);
      });

      test('Users - Create page', async ({ page }) => {
        const usersPo = new UsersPo(page, '_');
        const userCreate = usersPo.createEdit();

        await usersPo.goTo();
        await usersPo.waitForPage();
        await usersPo.list().masthead().create();
        await userCreate.waitForPage();
        await expect(userCreate.mastheadTitle()).toContainText('User: Create');
        await userCreate.username().checkVisible();

        await checkPageAccessibility(page);

        await userCreate.resourceDetail().cruResource().cancel()
          .click();
        await usersPo.waitForPage();
      });

      test('User Retention Settings', async ({ page }) => {
        const usersPo = new UsersPo(page, '_');
        const userRetentionPo = new UserRetentionPo(page);

        await usersPo.goTo();
        await usersPo.waitForPage();
        await usersPo.userRetentionLink().click();
        await userRetentionPo.waitForPage();
        await userRetentionPo.disableAfterPeriodCheckbox().checkVisible();

        await checkPageAccessibility(page);
      });
    });

    test.describe('Charts', () => {
      test('Charts page', async ({ page }) => {
        const chartsPage = new ChartsPage(page);
        const burgerMenu = new BurgerMenuPo(page);
        const sideNav = new ProductNavPo(page);

        await burgerMenu.goToCluster('local');
        await sideNav.navToSideMenuGroupByLabel('Apps');
        await chartsPage.waitForPage();

        await checkPageAccessibility(page);
      });

      test('Chart Detail Page - Kubecost', async ({ page }) => {
        const chartsPage = new ChartsPage(page);
        const chartPage = new ChartPage(page);
        const burgerMenu = new BurgerMenuPo(page);
        const sideNav = new ProductNavPo(page);

        await burgerMenu.goToCluster('local');
        await sideNav.navToSideMenuGroupByLabel('Apps');
        await chartsPage.waitForPage();
        await chartsPage.chartsSearchFilterInput().fill('Kubecost');
        await chartsPage.clickChart('Kubecost');
        await chartPage.waitForChartPage('rancher-partner-charts', 'cost-analyzer');
        await chartPage.waitForChartHeader('Kubecost', 30000);

        await checkPageAccessibility(page);
      });
    });

    test.describe('Extensions', () => {
      test('Extensions page', async ({ page, rancherApi }) => {
        const extensionsPo = new ExtensionsPagePo(page);

        await extensionsPo.goTo();
        await extensionsPo.waitForPage(undefined, 'available');
        await expect(extensionsPo.loading()).not.toBeAttached();
        await extensionsPo.extensionTabBuiltinClick();
        await extensionsPo.waitForPage(undefined, 'builtin');
        await extensionsPo.extensionCardPo('AKS Provisioning').checkVisible();

        await checkPageAccessibility(page);
      });

      test('Add Rancher Repositories Modal', async ({ page }) => {
        const extensionsPo = new ExtensionsPagePo(page);

        await extensionsPo.goTo();
        await extensionsPo.waitForPage(undefined, 'available');
        await expect(extensionsPo.loading()).not.toBeAttached();
        await extensionsPo.extensionMenuToggle();
        await extensionsPo.addRepositoriesClick();
        await dialogModal(page).checkVisible();

        await checkElementAccessibility(page, '#modal-container-element');

        await dialogModal(page).clickActionButton('Cancel');
      });

      test('Import Extension Catalog Modal', async ({ page }) => {
        const extensionsPo = new ExtensionsPagePo(page);

        await extensionsPo.goTo();
        await extensionsPo.waitForPage(undefined, 'available');
        await expect(extensionsPo.loading()).not.toBeAttached();
        await extensionsPo.extensionMenuToggle();
        await extensionsPo.manageExtensionCatalogsClick();
        await extensionsPo.catalogsList().sortableTable()
          .bulkActionButton('Import Extension Catalog')
          .click();
        await dialogModal(page).checkVisible();

        await checkElementAccessibility(page, '#modal-container-element');

        await dialogModal(page).clickActionButton('Cancel');
      });
    });

    test.describe('Global Settings', () => {
      test('Settings page', async ({ page }) => {
        const settingsPage = new SettingsPagePo(page, 'local');
        const burgerMenu = new BurgerMenuPo(page);

        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
        await settingsPage.waitForPage();

        await checkPageAccessibility(page);

        // Expand menu
        await settingsPage.actionButtonByLabel('agent-tls-mode').click();
        await expect(settingsPage.editSettingsButton()).toBeVisible();

        await checkElementAccessibility(page, '[dropdown-menu-item]:has-text("Edit Setting")');
      });

      test('Home Links page', async ({ page }) => {
        const homeLinksPage = new HomeLinksPagePo(page);
        const burgerMenu = new BurgerMenuPo(page);
        const sideNav = new ProductNavPo(page);

        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
        await sideNav.navToSideMenuEntryByLabel('Home Links');
        await homeLinksPage.addLinkButton().click();
        await homeLinksPage.displayTextInput().checkVisible();
        await homeLinksPage.urlInput().checkVisible();

        await checkPageAccessibility(page);
      });

      test('Branding page', async ({ page }) => {
        const brandingPage = new BrandingPagePo(page);
        const burgerMenu = new BurgerMenuPo(page);
        const sideNav = new ProductNavPo(page);

        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
        await sideNav.navToSideMenuEntryByLabel('Branding');
        await brandingPage.privateLabel().checkVisible();

        await checkPageAccessibility(page);
      });

      test('Banners page', async ({ page }) => {
        const bannersPage = new BannersPagePo(page);
        const burgerMenu = new BurgerMenuPo(page);
        const sideNav = new ProductNavPo(page);

        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
        await sideNav.navToSideMenuEntryByLabel('Banners');
        await bannersPage.headerBannerCheckbox().checkVisible();

        await checkPageAccessibility(page);
      });
    });

    test.describe('Menus', () => {
      test('User Menu', async ({ page }) => {
        const homePage = new HomePagePo(page);
        const userMenu = new UserMenuPo(page);

        await homePage.goTo();
        await homePage.waitForPage();
        await userMenu.ensureOpen();

        await checkElementAccessibility(page, '[dropdown-menu-collection]');
      });

      test('Burger Menu', async ({ page }) => {
        const homePage = new HomePagePo(page);
        const burgerMenu = new BurgerMenuPo(page);

        await homePage.goTo();
        await homePage.waitForPage();
        await burgerMenu.checkVisible();
        await burgerMenu.toggle();

        await checkElementAccessibility(page, '[data-testid="side-menu"]');
      });

      test('Product Side navigation', async ({ page }) => {
        const clusterDashboard = new ClusterDashboardPagePo(page, 'local');
        const sideNav = new ProductNavPo(page);

        await clusterDashboard.goTo();
        await clusterDashboard.waitForPage();

        const sideNavOptions = ['Cluster', 'Workloads', 'Apps', 'Service Discovery', 'Storage', 'Policy', 'More Resources'];

        for (const option of sideNavOptions) {
          await sideNav.navToSideMenuGroupByLabel(option);
          await checkElementAccessibility(page, '.side-nav');
        }
      });
    });
  });
});
