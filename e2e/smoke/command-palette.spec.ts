// TEMPLATE: adaptable example. Adjust the command ids/labels to your app.
/**
 * E2E smoke: command palette (Cmd/Ctrl+K).
 *
 * The Vitest layer covers the filtering + keyboard logic in isolation
 * (CommandPalette.test.tsx); this spec covers the real integration: the
 * global mod+k shortcut, the overlay, and route navigation.
 */
import {test, expect} from "../fixtures/base";

test.describe("Command palette", () => {
  test("Ctrl+K opens it, filters, and navigates to the chosen route", async ({page}) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("command-palette")).toBeVisible();

    // "config" matches only the Settings command's keywords.
    await page.getByTestId("command-palette-input").fill("config");
    await expect(page.getByTestId("command-nav-dashboard")).toHaveCount(0);
    await page.getByTestId("command-nav-settings").click();

    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByTestId("command-palette")).toHaveCount(0);
  });

  test("Escape closes it without navigating", async ({page}) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("command-palette")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("command-palette")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });
});
