// TEMPLATE: adaptable example. Adjust the palette id to one your app ships.
/**
 * E2E smoke: Settings > Appearance tab.
 *
 * Verifies that choosing a palette / mode flips the document attributes the
 * themes hang off (`data-app-theme` / `data-theme`), end to end.
 */
import {test, expect} from "../fixtures/base";

test.describe("Settings - Appearance tab", () => {
  test("selecting a palette and dark mode updates the document attributes", async ({page}) => {
    await page.goto("/settings?tab=appearance");
    await expect(page.getByTestId("appearance-settings")).toBeVisible();

    await page.getByTestId("appearance-palette-nord").click();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", "nord");

    await page.getByTestId("appearance-mode-dark").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
