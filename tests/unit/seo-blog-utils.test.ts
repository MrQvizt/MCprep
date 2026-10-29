import { describe, expect, it } from "vitest";
import {
  blogVisibility,
  countWords,
  extractVerificationCode,
  rankLinkSuggestions,
  readingMinutes,
  textFromHtml,
  tokenize,
} from "@/lib/admin/blog-utils";

const NOW = new Date("2026-10-29T12:00:00Z");

describe("blogVisibility", () => {
  it("distinguishes drafts, scheduled and published articles", () => {
    expect(blogVisibility({ status: "DRAFT", publishAt: null }, NOW)).toBe("DRAFT");
    expect(blogVisibility({ status: "DRAFT", publishAt: new Date("2026-01-01") }, NOW)).toBe("DRAFT");
    expect(blogVisibility({ status: "PUBLISHED", publishAt: new Date("2026-11-01T00:00:00Z") }, NOW)).toBe("SCHEDULED");
    expect(blogVisibility({ status: "PUBLISHED", publishAt: new Date("2026-10-01T00:00:00Z") }, NOW)).toBe("PUBLISHED");
    expect(blogVisibility({ status: "PUBLISHED", publishAt: null }, NOW)).toBe("SCHEDULED");
  });
});

describe("word counts", () => {
  it("strips HTML and counts words", () => {
    expect(textFromHtml("<h2>Meal prep</h2><p>Fresh&nbsp;meals <strong>every</strong> week.</p>")).toBe("Meal prep Fresh meals every week.");
    expect(countWords("<p>one two three</p><script>var x = 1</script>")).toBe(3);
    expect(countWords("")).toBe(0);
  });

  it("estimates reading time (minimum one minute)", () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(660)).toBe(3);
  });
});

describe("tokenize", () => {
  it("lower-cases, removes accents and short/stop words, and singularises", () => {
    const t = tokenize("High-Protein MEALS for the Pokébowl lovers with plans");
    expect(t.has("meals")).toBe(true);
    expect(t.has("meal")).toBe(true);
    expect(t.has("pokebowl")).toBe(true);
    expect(t.has("plan")).toBe(true);
    expect(t.has("with")).toBe(false);
    expect(t.has("for")).toBe(false);
  });
});

describe("rankLinkSuggestions", () => {
  const candidates = [
    { path: "/high-protein-meals-malta", label: "High-Protein Meals Malta", keywords: "high protein meal prep Malta" },
    { path: "/delivery-areas", label: "Delivery Areas", keywords: "meal prep delivery Malta localities" },
    { path: "/plans", label: "Plans & Pricing", keywords: "meal plans Malta", evergreen: true },
    { path: "/blog/self", label: "Self", keywords: "protein protein protein" },
  ];

  it("ranks by topical overlap and flags pages already linked", () => {
    const res = rankLinkSuggestions(
      { title: "High-protein meal prep tips", primaryTopic: "high protein meal prep Malta", text: "Protein matters. See our plans.", selfPath: "/blog/self" },
      candidates,
      ["/plans"],
    );
    expect(res[0].path).toBe("/high-protein-meals-malta");
    expect(res.find((r) => r.path === "/blog/self")).toBeUndefined();
    const plans = res.find((r) => r.path === "/plans")!;
    expect(plans.alreadyLinked).toBe(true);
    // already-linked suggestions are listed after unlinked ones
    expect(res[res.length - 1].alreadyLinked).toBe(true);
  });
});

describe("extractVerificationCode", () => {
  it("accepts a full meta tag or the bare code", () => {
    expect(extractVerificationCode('<meta name="google-site-verification" content="AbC_123-xyzTOKEN" />')).toBe("AbC_123-xyzTOKEN");
    expect(extractVerificationCode("  AbC_123-xyzTOKEN ")).toBe("AbC_123-xyzTOKEN");
    expect(extractVerificationCode("")).toBe("");
  });

  it("rejects anything that could inject markup", () => {
    expect(extractVerificationCode('"><script>alert(1)</script>')).toBeNull();
    expect(extractVerificationCode("abc")).toBeNull();
  });
});
