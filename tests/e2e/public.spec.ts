import { expect, test } from "@playwright/test";
import { canonical, h1Texts, metaContent } from "./helpers";

const INDEXABLE_PAGES = [
  "/",
  "/menu",
  "/plans",
  "/how-it-works",
  "/about",
  "/faq",
  "/contact",
  "/gallery",
  "/offers",
  "/meal-prep-malta",
  "/healthy-meal-delivery-malta",
  "/meal-plans-malta",
  "/high-protein-meals-malta",
  "/delivery-areas",
  "/blog",
  "/privacy-policy",
  "/terms",
  "/cookie-policy",
];

test.describe("public pages, crawlable Malta content and metadata", () => {
  test("homepage server-renders Malta-specific content, H1, metadata and LocalBusiness schema", async ({ request, baseURL }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    const h1 = h1Texts(html);
    expect(h1).toHaveLength(1);
    expect(h1[0]).toMatch(/meal prep in Malta/i);
    expect(h1[0]).toMatch(/fuel your lift/i);
    expect(html).toMatch(/<title>[^<]*MC PREPS Malta[^<]*<\/title>/);
    expect(metaContent(html, "description")).toMatch(/Malta/);
    expect(canonical(html)?.replace(/\/$/, "")).toBe(baseURL);
    expect(html).toContain('"@type":"LocalBusiness"');
    expect(html).toContain('"@type":"WebSite"');
    expect(html).toContain("https://www.instagram.com/mcpreps.mt/");
    expect(html).toContain("Chicken Poke Bowl");
  });

  test("every indexable page has a unique title, description, canonical and one H1", async ({ request, baseURL }) => {
    const titles = new Map<string, string>();
    for (const path of INDEXABLE_PAGES) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
      expect(title, `${path} title`).toBeTruthy();
      expect(titles.has(title!), `duplicate title on ${path}`).toBe(false);
      titles.set(title!, path);
      expect(metaContent(html, "description")?.length ?? 0, `${path} description`).toBeGreaterThan(40);
      expect(canonical(html)?.replace(/\/$/, ""), `${path} canonical`).toBe(`${baseURL}${path}`.replace(/\/$/, ""));
      expect(h1Texts(html).length, `${path} h1`).toBe(1);
      expect(metaContent(html, "og:image"), `${path} og:image`).toBeTruthy();
      expect(html, `${path} robots`).not.toMatch(/<meta name="robots" content="noindex/);
    }
  });

  test("Malta service pages have distinct, substantial content", async ({ request }) => {
    const bodies: string[] = [];
    for (const path of ["/meal-prep-malta", "/healthy-meal-delivery-malta", "/meal-plans-malta", "/high-protein-meals-malta"]) {
      const html = await (await request.get(path)).text();
      const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      expect(text).toMatch(/Malta/);
      expect(html).toContain('"@type":"BreadcrumbList"');
      bodies.push(h1Texts(html)[0]);
    }
    expect(new Set(bodies).size).toBe(4);
  });

  test("order and confirmation pages are not indexed", async ({ request }) => {
    const html = await (await request.get("/order")).text();
    expect(html).toMatch(/<meta name="robots" content="noindex/);
  });

  test("sitemap lists public pages and excludes private ones", async ({ request, baseURL }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const path of ["/meal-prep-malta", "/plans", "/menu/chicken-pokebowl", "/delivery-areas"]) {
      expect(xml).toContain(`<loc>${baseURL}${path}</loc>`);
    }
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/order/confirmation");
    expect(xml).not.toContain("<loc>" + baseURL + "/order</loc>");
  });

  test("robots.txt blocks private areas and points to the sitemap", async ({ request }) => {
    const txt = await (await request.get("/robots.txt")).text();
    expect(txt).toMatch(/Disallow: \/admin/);
    expect(txt).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });

  test("delivery areas only show localities the business enabled", async ({ request }) => {
    const html = await (await request.get("/delivery-areas")).text();
    expect(html).toContain("Sliema");
    expect(html).not.toContain("Valletta");
  });

  test("the live promotion shows a real countdown to its stored end time", async ({ page }) => {
    await page.goto("/");
    const timer = page.getByRole("timer").first();
    await expect(timer).toBeVisible();
    const first = await timer.textContent();
    await page.waitForTimeout(2100);
    expect(await timer.textContent()).not.toBe(first); // ticking
    await page.reload();
    await expect(page.getByRole("timer").first()).toBeVisible(); // does not reset/disappear on refresh
  });

  test("the homepage leads with the €6 first-week offer and its countdown, then the packages", async ({ page }) => {
    await page.goto("/");
    const offer = page.getByRole("region", { name: "New customer offer" });
    await expect(offer).toBeVisible();
    await expect(offer).toContainText("Limited-time deal");
    await expect(offer).toContainText(/First week\s*€6\s*a meal/i);
    await expect(offer).toContainText("€9.50"); // the normal price per meal, struck through
    await expect(offer).toContainText("10 meals for €60 instead of €95 — save €35");
    await expect(offer.getByRole("timer")).toBeVisible();
    await expect(offer.getByRole("link", { name: /Claim my €6 meals/ })).toHaveAttribute("href", "/order");
    // No red bar while the big banner is on screen; it slides in under the header once the banner scrolls away.
    const bar = page.getByRole("region", { name: "Offer", exact: true });
    await expect(bar).toHaveCount(0);
    await page.mouse.wheel(0, 3000);
    await expect(bar).toBeInViewport();
    await expect(bar.getByRole("timer")).toBeVisible();
    // Packages come straight after the hero, before the menu.
    const order = await page.evaluate(() => {
      const plans = document.getElementById("plans");
      const menu = [...document.querySelectorAll("h2")].find((h) => /menu/i.test(h.textContent ?? ""));
      return plans && menu ? plans.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
    });
    expect(order).toBeTruthy();
  });

  test("package cards show the first-week price with the visitor's live countdown", async ({ page }) => {
    await page.goto("/plans");
    const card = page.locator('article[aria-label="Lunch + Dinner · 5 days"]').first();
    await expect(card).toContainText(/First week\s*€60/i);
    const timer = card.getByRole("timer");
    await expect(timer).toContainText(/Ends in \d:\d\d:\d\d/);
    const first = await timer.textContent();
    await page.waitForTimeout(1500);
    expect(await timer.textContent()).not.toBe(first); // ticking
  });

  test("the red deal bar stays on screen while scrolling other pages", async ({ page }) => {
    await page.goto("/menu");
    const bar = page.getByRole("region", { name: "Offer", exact: true });
    await expect(bar).toBeInViewport();
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(300);
    await expect(bar).toBeInViewport();
  });

  test("the ordering deadline names the week it is for", async ({ page }) => {
    await page.goto("/menu");
    const note = page.getByRole("note", { name: "Ordering deadline" });
    await expect(note).toContainText(/Order by \w{3} \d{1,2} \w{3}, 4pm for delivery from Mon \d{1,2} \w{3}/);
    await expect(note).not.toContainText("next week");
  });

  test("the About page shows the stage photo uncropped", async ({ page }) => {
    await page.goto("/about");
    const photo = page.getByRole("img", { name: /IFBB Semipro/ });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const box = (await photo.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(1238 / 1271, 1); // frame follows the photo's shape
  });

  test("the first-week offer's personal 2-hour window doesn't restart on reload", async ({ page }) => {
    await page.goto("/menu");
    const bar = page.locator('[data-promotion="first-week-6-euro"]').first();
    await expect(bar).toBeVisible();
    const toSeconds = (t: string | null) => {
      const parts = (t ?? "").trim().split(":").map(Number);
      return parts.reduce((acc, n) => acc * 60 + n, 0);
    };
    const first = toSeconds(await bar.getByRole("timer").textContent());
    expect(first).toBeGreaterThan(60 * 60); // close to 2 hours on the first visit
    await page.waitForTimeout(2100);
    await page.reload();
    const again = toSeconds(await page.locator('[data-promotion="first-week-6-euro"]').first().getByRole("timer").textContent());
    expect(again).toBeLessThan(first); // counting down, not reset
  });

  test("unknown pages return a branded 404", async ({ request }) => {
    const res = await request.get("/this-page-does-not-exist");
    expect(res.status()).toBe(404);
    expect(await res.text()).toMatch(/MC PREPS/);
  });
});
