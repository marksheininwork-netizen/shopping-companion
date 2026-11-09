import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/commerce.html");
});

test("catalog search and saved ideas work across reloads", async ({ page }) => {
  await page.getByLabel("Search product concepts").fill("notebook");
  await expect(page.getByRole("heading", { name: "Room to Grow notebook concept" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Small Rituals botanical tee" })).toHaveCount(0);

  await page.getByLabel("Search product concepts").fill("");
  await page.getByRole("button", { name: "Save idea" }).first().click();
  await expect(page.getByRole("button", { name: "Remove from saved ideas" }).first()).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove from saved ideas" }).first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Saved product ideas")).toBeVisible();
});

test("default manual price observation date saves and persists", async ({ page }) => {
  await page.getByLabel("Product name").fill("E2E sample observation");
  await page.getByLabel("Product page URL").fill("https://example.com/sample");
  await page.getByLabel("Observed price ($)").fill("12.34");
  await page.getByRole("button", { name: "Save observation" }).click();

  await expect(page.getByText("Observation time cannot be in the future.")).toHaveCount(0);
  await expect(page.getByText("E2E sample observation")).toBeVisible();
  await expect(page.getByText("Manual observation saved in this browser.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("E2E sample observation")).toBeVisible();
  await expect(page.getByText("$ 12.34")).toBeVisible();
});

test("unconfigured account and download access are clearly unavailable", async ({ page }) => {
  await expect(page.getByText("No account sign-in is configured.")).toBeVisible();
  await expect(page.getByText(/customer-ready package, PDF exports, license, and download delivery still need preparation/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /download/i })).toHaveCount(0);
});

test("checkout stays disabled for draft-only concepts", async ({ page }) => {
  await page.getByRole("button", { name: /Open research cart/ }).click();
  await expect(page.getByRole("button", { name: /Checkout unavailable/ })).toBeDisabled();
  await expect(page.getByText(/This is not a checkout total/)).toBeVisible();
});

test("mobile layout fits the viewport without horizontal page overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile layout assertion runs in the mobile project.");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole("heading", { name: "A little more meaning in the everyday." })).toBeVisible();
});
