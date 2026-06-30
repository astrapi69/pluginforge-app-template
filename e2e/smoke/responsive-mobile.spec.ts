// TEMPLATE: adaptable example.
/**
 * E2E smoke: the new features fit a 375px mobile viewport.
 *
 * Catches the horizontal-overflow class of responsive bug (a fixed-width
 * element wider than the screen) on the surfaces added this cycle. The
 * assertion is document-wide: scrollWidth must not exceed the viewport.
 */
import {test, expect, cancelDialog} from "../fixtures/base";
import type {Page} from "@playwright/test";

test.use({viewport: {width: 375, height: 812}});

/** Horizontal overflow in px (<= 1 means the page fits the viewport). */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("Mobile 375px - new surfaces fit the viewport", () => {
  test("command palette overlay fits", async ({page}) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("command-palette")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("About tab + QR modal fit", async ({page}) => {
    await page.goto("/settings?tab=about");
    await expect(page.getByTestId("about-tab")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await page.getByTestId("about-share-button").click();
    await expect(page.getByTestId("qr-modal")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("Appearance + Data tabs fit", async ({page}) => {
    await page.goto("/settings?tab=appearance");
    await expect(page.getByTestId("appearance-settings")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("data-settings")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    // Destructive action must still confirm on mobile; cancel to avoid reload.
    await page.getByTestId("data-clear-cache").click();
    await cancelDialog(page);
  });
});
