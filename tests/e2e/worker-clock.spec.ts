import { test, expect } from '@playwright/test'

// Smoke tests — require a running dev server and seeded DB
// Run with: npx playwright test

test.describe('Worker PIN Login', () => {
  test('loads login page', async ({ page }) => {
    await page.goto('/worker/login')
    await expect(page.getByText('MarineTime')).toBeVisible()
    await expect(page.getByText('Worker Sign In')).toBeVisible()
  })

  test('shows error for wrong PIN', async ({ page }) => {
    await page.goto('/worker/login')

    await page.fill('input[placeholder="e.g. W001"]', 'W001')

    // Click wrong PIN digits
    for (const d of ['9', '9', '9', '9']) {
      await page.locator(`button:text-is("${d}")`).first().click()
    }

    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 5000 })
  })

  test('shows PIN dots as digits are entered', async ({ page }) => {
    await page.goto('/worker/login')

    // Dot count starts at 0 filled
    const dots = page.locator('.bg-sky-500')
    await expect(dots).toHaveCount(0)

    await page.locator('button:text-is("1")').first().click()
    await expect(dots).toHaveCount(1)

    await page.locator('button:text-is("2")').first().click()
    await expect(dots).toHaveCount(2)

    // Backspace removes one
    await page.locator('button:text-is("⌫")').click()
    await expect(dots).toHaveCount(1)
  })
})

test.describe('Home page', () => {
  test('shows all three login options', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Worker Login')).toBeVisible()
    await expect(page.getByText('Supervisor Login')).toBeVisible()
    await expect(page.getByText('Admin Login')).toBeVisible()
    await expect(page.getByText('Shared Tablet (Kiosk)')).toBeVisible()
  })

  test('navigates to worker login', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Worker Login').click()
    await expect(page).toHaveURL('/worker/login')
  })

  test('navigates to kiosk', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Shared Tablet (Kiosk)').click()
    await expect(page).toHaveURL('/kiosk')
  })
})

test.describe('Kiosk page', () => {
  test('loads without auth', async ({ page }) => {
    await page.goto('/kiosk')
    await expect(page.getByText('Kiosk Mode')).toBeVisible()
  })
})
