import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';

const TEST_ONLY_PASSWORD = 'TEST_ONLY_ci_password_2026';

export async function registerAndLogin(page) {
  const email = `ai-studio-ci-${randomUUID()}@example.invalid`;
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('TEST_ONLY AI Studio CI');
  await page.getByLabel('Địa chỉ email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(TEST_ONLY_PASSWORD);
  await page.getByLabel('Xác nhận mật khẩu').fill(TEST_ONLY_PASSWORD);
  await page.getByRole('checkbox', { name: 'Tôi xác nhận thông tin đăng ký là chính xác.' }).check();
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('status')).toContainText('Đăng ký thành công');
  await page.waitForURL('**/login', { timeout: 10_000 });

  await page.getByLabel('Địa chỉ email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(TEST_ONLY_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  return { email };
}

export async function loginExistingAccount(page, email, password = TEST_ONLY_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Địa chỉ email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
