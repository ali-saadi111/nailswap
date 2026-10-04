import { test, expect } from "@playwright/test";

test("map selection leads to the salon feed and photo-only guided camera", async ({ page }, testInfo) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Find your nail salon" })).toBeVisible();
  await expect(page.locator(".salon-map-pin").first()).toBeVisible();
  await expect
    .poll(() => page.locator(".leaflet-tile-loaded").count(), { timeout: 30000 })
    .toBeGreaterThanOrEqual(4);
  await page.locator('.salon-marker[aria-label="Glow Nails Beirut"]').click();
  await expect(page.getByRole("heading", { name: "Glow Nails Beirut", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("discovery.png"), fullPage: true });
  await page.getByRole("link", { name: "View salon & book" }).click();
  await expect(page).toHaveURL(/\/s\/glow-beirut/);
  await expect(page.getByRole("link", { name: "Try on my photo", exact: true }).first()).toBeVisible();
  const bookHref = await page
    .getByRole("link", { name: "Book this look", exact: true })
    .first()
    .getAttribute("href");
  expect(bookHref).toContain("/book?designId=");
  const booking = await page.request.get(bookHref!);
  expect(booking.status()).toBe(200);
  await page.screenshot({ path: testInfo.outputPath("salon-feed.png"), fullPage: true });
  await page.getByRole("link", { name: "Try on my photo", exact: true }).first().click();
  await expect(page.getByText("Live AR", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Take a picture/ }).click();
  const camera = page.getByRole("dialog", { name: "Take a hand photo" });
  await expect(camera).toBeVisible();
  await expect(camera.locator("svg path[stroke-dasharray]")).toBeVisible();
  await expect(camera.getByRole("button", { name: "Take picture", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("hand-camera.png") });
  await camera.getByRole("button", { name: "Close camera" }).click();
  await expect(camera).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Upload a photo", exact: true })).toBeVisible();
});

test("photo progress continues polling through unchanged status and temporary network errors", async ({
  page,
}) => {
  let reads = 0;
  const id = "11111111-1111-4111-8111-111111111111";
  await page.route(`**/api/tryon/jobs/${id}`, async (route) => {
    reads++;
    if (reads === 3) return route.abort();
    const done = reads >= 5;
    await route.fulfill({
      json: {
        id,
        salonId: null,
        designId: null,
        polishId: null,
        status: done ? "succeeded" : "generating",
        progress: done ? 100 : 50,
        params: { mode: "describe", variations: 1 },
        variations: 1,
        provider: "fal",
        cached: false,
        errorCode: null,
        results: done ? ["/icon.png"] : [],
        inputUrl: "/icon.png",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isSaved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  });
  await page.goto(`/en/try?jobId=${id}`);
  await expect.poll(() => reads, { timeout: 20000 }).toBeGreaterThanOrEqual(5);
  await expect(page.getByRole("button", { name: /Try another/i })).toBeVisible();
});

test("merchant can edit profile and hours with bookings as the default landing", async ({ page }) => {
  const sent = await page.request.post("/api/auth/otp/send", { data: { phone: "96170000001" } });
  expect(sent.ok()).toBeTruthy();
  const verified = await page.request.post("/api/auth/otp/verify", {
    data: { phone: "96170000001", code: "123456" },
  });
  expect(verified.ok()).toBeTruthy();
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/dashboard\/bookings/);
  await page.goto("/en/dashboard/profile");
  await expect(page.getByRole("heading", { name: "Profile & hours" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible();
  const description = page.getByLabel("Tell clients about your salon");
  const original = await description.inputValue();
  const caption = `Profile verification ${Date.now()}`;
  try {
    await description.fill(caption);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Your salon page has been updated." }),
    ).toBeVisible();
    await page.reload();
    await expect(description).toHaveValue(caption);
  } finally {
    await description.fill(original);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Your salon page has been updated." }),
    ).toBeVisible();
  }
  await page.goto("/en/dashboard/catalog");
  await page.getByRole("button", { name: /^Classic French/ }).click();
  const editor = page.getByRole("dialog", { name: "Classic French", exact: true });
  const previousCaption = await editor.getByLabel("Caption", { exact: true }).inputValue();
  try {
    await editor.getByLabel("Caption", { exact: true }).fill(caption);
    await editor.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(editor).toHaveCount(0);
    const publicPage = await page.request.get("/en/s/glow-beirut");
    expect(await publicPage.text()).toContain(caption);
  } finally {
    await page.goto("/en/dashboard/catalog");
    await page.getByRole("button", { name: /^Classic French/ }).click();
    await editor.getByLabel("Caption", { exact: true }).fill(previousCaption);
    await editor.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(editor).toHaveCount(0);
  }
});
