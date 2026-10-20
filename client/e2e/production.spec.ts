import { expect, test } from '@playwright/test';

test('built frontend boots under production CSP and preserves direct-link authentication', async ({ page, request }) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', event => console.error(`CSP_VIOLATION:${event.violatedDirective}`));
  });
  page.on('console', message => { if (message.text().startsWith('CSP_VIOLATION:')) violations.push(message.text()); });
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Login required' } }) }));
  await page.goto('/employees/123');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(page.url()).toContain('#/login');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(violations).toEqual([]);
  const missingApi = await request.get('/api/not-real', { headers: { Accept: 'text/html' } });
  expect(missingApi.status()).toBe(404);
  expect(missingApi.headers()['content-type']).toContain('application/json');
  const missingAsset = await request.get('/assets/not-real.js');
  expect(missingAsset.status()).toBe(404);
});
