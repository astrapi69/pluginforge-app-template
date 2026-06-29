// TEMPLATE: adaptable example.
/**
 * E2E smoke: Settings > About tab.
 *
 * Covers the integration surface the Vitest layer can't: the QR-code modal
 * (qrcode lib + overlay) and the Developer Mode toggle persistence.
 */
import {test, expect} from "../fixtures/base";

test.describe("Settings - About tab", () => {
  test("shows the version + links and opens the QR share modal", async ({page}) => {
    await page.goto("/settings?tab=about");
    await expect(page.getByTestId("about-tab")).toBeVisible();
    await expect(page.getByTestId("about-app-version")).toContainText("v");
    await expect(page.getByTestId("about-link-repo")).toBeVisible();

    await page.getByTestId("about-share-button").click();
    await expect(page.getByTestId("qr-modal")).toBeVisible();
    await expect(page.getByTestId("qr-modal-image")).toBeVisible();
    await page.getByTestId("qr-modal-close").click();
    await expect(page.getByTestId("qr-modal")).toHaveCount(0);
  });

  test("Developer Mode toggle flips and persists", async ({page}) => {
    await page.goto("/settings?tab=about");
    const toggle = page.getByTestId("devmode-toggle");
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expect(toggle).toBeChecked();

    await page.reload();
    await expect(page.getByTestId("devmode-toggle")).toBeChecked();
  });
});
