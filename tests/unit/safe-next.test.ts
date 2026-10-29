import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/order?plan=lunch-5-days&dishes=a:1#top")).toBe("/order?plan=lunch-5-days&dishes=a:1#top");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of [
      undefined,
      "",
      "account",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/%09/evil.example".replace("%09", "\t"),
      "/" + "a".repeat(400),
    ]) {
      expect(safeNext(bad)).toBe("/account");
    }
    expect(safeNext("//evil.example", "/")).toBe("/");
  });
});
