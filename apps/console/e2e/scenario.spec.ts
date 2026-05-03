import { test, expect } from "@playwright/test";

test("agent pipeline becomes visible within 10s of page load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("MeshShield AI")).toBeVisible();
  for (const label of ["Threat Prioritizer", "Interceptor Allocator", "Justifier", "Escalation Officer"]) {
    await expect(page.getByText(label)).toBeVisible();
  }
  await expect(page.getByText(/RESPONSE PLAN/)).toBeVisible({ timeout: 10_000 });
});

test("operator can chat with Watch Commander over NLIP", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder(/Ask Watch Commander/);
  await input.fill("Summarize the situation.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("text=WC")).toBeVisible({ timeout: 10_000 });
});
