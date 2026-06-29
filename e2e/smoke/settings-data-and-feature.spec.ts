// TEMPLATE: adaptable example.
/**
 * E2E smoke: Settings > Data tab + the FeatureSection demo.
 *
 * The Data tab exposes the backup controls + cache management; the General
 * tab carries the disabled "feature-section" demo (visible-but-disabled
 * policy). The actual backup export/import round-trip is the manual
 * BACKUP-AKZEPTANZTEST (quality-checks.md), not this smoke - here we only
 * assert the controls render and the destructive cache action confirms.
 */
import {test, expect, cancelDialog} from "../fixtures/base";

test.describe("Settings - Data tab", () => {
  test("shows backup + cache controls; cache-clear asks to confirm", async ({page}) => {
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("data-settings")).toBeVisible();
    await expect(page.getByTestId("data-export")).toBeVisible();
    await expect(page.getByTestId("data-import")).toBeVisible();

    // Destructive action must confirm; cancel so the page does not reload.
    await page.getByTestId("data-clear-cache").click();
    await cancelDialog(page);
    await expect(page.getByTestId("data-settings")).toBeVisible();
  });
});

test.describe("Settings - feature-section demo", () => {
  test("the General tab shows a disabled feature with a reason", async ({page}) => {
    await page.goto("/settings?tab=app");
    await expect(page.getByTestId("feature-sync-demo")).toBeVisible();
    await expect(page.getByTestId("feature-sync-demo-reason")).toBeVisible();
  });
});
