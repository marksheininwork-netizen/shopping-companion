import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/commerce.html");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("Shopping Companion preview also carries a noindex directive", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
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

test("account sign-in is available and paid downloads stay hidden until an order exists", async ({ page }) => {
  await expect(page.getByRole("link", { name: "Sign in with email" })).toHaveAttribute("href", /\/api\/v1\/customer\/sign-in$/);
  await expect(page.getByText(/Review packages are prepared for owner review\. Final license approval and private customer download delivery are not enabled\./i)).toBeVisible();
  await expect(page.getByRole("link", { name: /download/i })).toHaveCount(0);
});

test("support message drafts are saved locally and survive reload", async ({ page }) => {
  await page.getByLabel("Your message").fill("Question about a draft product");
  await page.getByRole("button", { name: "Save message draft" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved on this device." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your message")).toHaveValue("Question about a draft product");
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

test("accessibility smoke checks landmarks, labels, image alternatives, and names", async ({ page, isMobile }) => {
  test.skip(isMobile, "Accessibility smoke check runs once on desktop.");
  const audit = await page.evaluate(() => {
    const named = (element: Element) => {
      const aria = element.getAttribute("aria-label");
      const labelledBy = element.getAttribute("aria-labelledby");
      const text = element.textContent?.trim();
      const title = element.getAttribute("title");
      return Boolean(aria?.trim() || labelledBy?.trim() || text || title?.trim());
    };
    const controls = Array.from(document.querySelectorAll("input:not([type=hidden]), select, textarea"));
    const unnamedControls = controls.filter((element) => {
      if (element.getAttribute("aria-label") || element.getAttribute("aria-labelledby")) return false;
      const id = element.id;
      return !Array.from(document.querySelectorAll("label")).some((label) =>
        (id && label.htmlFor === id) || label.contains(element)
      );
    });
    return {
      h1Count: document.querySelectorAll("h1").length,
      mainCount: document.querySelectorAll("main").length,
      missingImageAlternatives: Array.from(document.images).filter((image) => !image.hasAttribute("alt")).length,
      unnamedButtons: Array.from(document.querySelectorAll("button")).filter((button) => !named(button)).length,
      unnamedLinks: Array.from(document.querySelectorAll("a")).filter((link) => !named(link)).length,
      unnamedControls: unnamedControls.length,
    };
  });
  expect(audit).toEqual({
    h1Count: 1,
    mainCount: 1,
    missingImageAlternatives: 0,
    unnamedButtons: 0,
    unnamedLinks: 0,
    unnamedControls: 0,
  });
});

test("Shopping Companion budget, comparison, save, and backup work together", async ({ page, isMobile }) => {
  await page.goto("/index.html");
  await expect(page.getByRole("heading", { name: "Make shopping simple." })).toBeVisible();
  await page.getByLabel("Shopping budget").fill("100");
  await page.getByLabel("New shopping item").fill("Rain jacket");
  await page.getByLabel("Estimated unit price").fill("35");
  await page.getByLabel("Estimated shipping").fill("5");
  await page.getByLabel("Estimated tax").fill("2.80");
  await page.getByRole("button", { name: "Add Item" }).click();

  await page.getByLabel("Compare Rain jacket").check();
  await expect(page.getByText("Estimated total: $42.80")).toBeVisible();
  await expect(page.locator(".budget-status")).toHaveText("$57.20 left of $100.00");
  await page.reload();
  await expect(page.getByText("Rain jacket")).toBeVisible();
  await expect(page.getByLabel("Shopping budget")).toHaveValue("100");
  await expect(page.locator(".budget-status")).toHaveText("$57.20 left of $100.00");
  if (isMobile) return;

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("shopping-companion-backup.json");
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(backup.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Rain jacket", price: 35, shipping: 5, estimatedTax: 2.8 })
  ]));

  await page.getByRole("button", { name: "Delete Rain jacket" }).click();
  await expect(page.getByText("Rain jacket")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({
    name: "shopping-companion-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText("Rain jacket")).toBeVisible();
});
