import { expect, test } from "@playwright/test";

/**
 * SEO-critical routing guarantees. These run against a production build and
 * assert the server-level contract (status codes + Location headers) rather
 * than page content, so they stay stable regardless of backend availability.
 */

test.describe("canonical trailing slash", () => {
  test("redirects a slash-less path to its trailing-slash form", async ({ request }) => {
    const response = await request.get("/about", { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toContain("/about/");
  });
});

test.describe("canonical host", () => {
  test("permanently redirects the apex host to www", async ({ playwright, baseURL }) => {
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { host: "boardingedu.com" },
    });

    try {
      const response = await context.get("/about/", { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      expect(response.headers()["location"]).toBe("https://www.boardingedu.com/about/");
    } finally {
      await context.dispose();
    }
  });
});
