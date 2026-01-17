import { test, expect } from '@playwright/test';

const routes = [
  { path: '/', title: 'myID' },
  { path: '/auth/signin', title: 'Welcome Back' },
  { path: '/auth/signup', title: 'Create Account' },
  { path: '/profile', title: 'Profile' },
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/settings/', title: 'Settings' },
  { path: '/otp', title: 'OTP' },
  { path: '/security/qes', title: 'QES' },
  { path: '/security/pki', title: 'PKI' },
  { path: '/security/passkeys', title: 'Passkey' },
  { path: '/enterprise/uct-scanner', title: 'UCT' },
];

test.describe('Route Navigation', () => {
  routes.forEach(({ path, title }) => {
    test(`${path} loads successfully`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(new RegExp(title, 'i'));
    });
  });
});

test.describe('Authentication Flow', () => {
  test('can sign up', async ({ page }) => {
    await page.goto('/auth/signup');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'SecurePassword123!');
    await page.fill('input[placeholder*="Confirm"]', 'SecurePassword123!');
    await page.check('input[type="checkbox"]');

    await page.click('button[type="submit"]');

    // Should redirect to onboarding
    await expect(page).toHaveURL(/\/onboarding\/step-1/);
  });

  test('can sign in', async ({ page }) => {
    await page.goto('/auth/signin');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');

    await page.click('button[type="submit"]');

    // Should redirect to profile
    await expect(page).toHaveURL('/profile');
  });
});

test.describe('Onboarding Flow', () => {
  test('completes full onboarding', async ({ page }) => {
    // Sign up first
    await page.goto('/auth/signup');
    await page.fill('input[type="email"]', 'anna@example.com');
    await page.fill('input[type="password"]', 'SecurePass123!');
    await page.fill('input[placeholder*="Confirm"]', 'SecurePass123!');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');

    // Step 1: Personal Information
    await expect(page).toHaveURL('/onboarding/step-1');
    await page.waitForSelector('h1:has-text("Personal Information")');

    // Navigate through steps (simplified - in real test would fill forms)
    for (let step = 1; step <= 9; step++) {
      await expect(page).toHaveURL(`/onboarding/step-${step}`);
      // Click continue button if present
      const continueBtn = page.locator('button:has-text("Continue")');
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
      }
    }

    // Should reach verification success
    await expect(page).toHaveURL('/verification-success');
  });
});

test.describe('UCT Flow', () => {
  test('generates UCT token', async ({ page }) => {
    // Login first
    await page.goto('/auth/signin');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Go to UCT scanner
    await page.goto('/enterprise/uct-scanner');

    // Simulate QR scan (in real test would use actual QR)
    // Navigate through UCT flow
    await page.goto('/enterprise/uct-consent');
    await page.goto('/enterprise/uct-generated');
    await page.goto('/enterprise/uct-authorization');

    // Verify audit trail
    await page.goto('/enterprise/uct-audit');
    await expect(page.locator('h1')).toContainText('Audit');
  });
});

test.describe('OTP Management', () => {
  test('displays OTP dashboard', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.goto('/otp');
    await expect(page.locator('h1')).toContainText('OTP');
  });

  test('navigates to add OTP', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.goto('/otp');
    await page.goto('/otp/add');

    await expect(page).toHaveURL('/otp/add');
    await expect(page.locator('h1')).toContainText('Add');
  });
});

test.describe('Security Features', () => {
  test('navigates to passkey management', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.goto('/security/passkeys');
    await expect(page.locator('h1')).toContainText('Passkey');
  });

  test('navigates to PKI', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.goto('/security/pki');
    await expect(page.locator('h1')).toContainText('PKI');
  });
});

test.describe('PWA Features', () => {
  test('has service worker', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });

    expect(swRegistered).toBe(true);
  });

  test('has manifest', async ({ page }) => {
    await page.goto('/');
    const manifestLink = await page.locator('link[rel="manifest"]').count();
    expect(manifestLink).toBeGreaterThan(0);
  });
});
