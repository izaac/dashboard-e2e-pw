import { test, expect } from '@/support/fixtures';
import UserMenuPo from '@/e2e/po/side-bars/user-menu.po';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';

test.describe('User can logout of Rancher', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, () => {
  test('Can logout of Rancher successfully (normal/Rancher auth user)', async ({ page, login }) => {
    await login();

    const userMenu = new UserMenuPo(page);
    const loginPage = new LoginPagePo(page);

    await expect(userMenu.self()).toBeVisible();
    await userMenu.clickMenuItem('Log Out');

    await loginPage.waitForPage();
    await expect(loginPage.username().self()).toBeVisible();
    await expect(loginPage.loginPageMessage()).toContainText('You have been logged out.');

    // Verify unauthenticated navigation redirects back to login
    await page.goto('./home');
    await expect(loginPage.loginPageMessage()).toContainText('Log in again to continue.');
    await loginPage.waitForPage();
  });

  test('Can logout of Rancher successfully (SSO user)', async ({ page, login }) => {
    await login();

    const userMenu = new UserMenuPo(page);
    const loginPage = new LoginPagePo(page);

    // Mock the principals endpoint to simulate Github SSO auth
    await page.route('**/v3/principals', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'collection',
          resourceType: 'principal',
          data: [
            {
              baseType: 'principal',
              created: null,
              creatorId: null,
              id: 'github_user://97888974',
              links: { self: 'https://my-rancher-address:8005/v3/principals/github_user:%2F%2F97888974' },
              loginName: 'some-user',
              me: true,
              memberOf: false,
              name: 'Some Dummy User',
              principalType: 'user',
              profilePicture: 'https://avatars.githubusercontent.com/u/97888974?v=4',
              provider: 'github',
              type: 'principal',
            },
          ],
        }),
      });
    });

    // Reload to pick up the principals mock
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(userMenu.self()).toBeVisible();

    await userMenu.clickMenuItem('Log Out');

    await loginPage.waitForPage();
    await expect(loginPage.username().self()).toBeVisible();
    await expect(loginPage.loginPageMessage()).toContainText(
      "You've been logged out of Rancher, however you may still be logged in to your single sign-on identity provider.",
    );
  });
});
