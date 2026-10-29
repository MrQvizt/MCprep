import { describe, expect, it } from "vitest";
import { centsForCsv, csvCell, toCsv } from "@/lib/admin/csv";

describe("csvCell", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1:A9)")).toBe("'@SUM(A1:A9)");
    expect(csvCell("\tleading tab")).toBe("'\tleading tab");
  });

  it("keeps plain numbers and phone numbers readable", () => {
    expect(csvCell("+356 7912 3456")).toBe("+356 7912 3456");
    expect(csvCell("-12.50")).toBe("-12.50");
    expect(csvCell(42)).toBe("42");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Gżira, Malta")).toBe('"Gżira, Malta"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles empty values, booleans and dates", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(true)).toBe("Yes");
    expect(csvCell(new Date("2026-10-31T22:59:00Z"))).toBe("2026-10-31T22:59:00.000Z");
  });
});

describe("toCsv", () => {
  it("builds a BOM-prefixed CRLF document", () => {
    const out = toCsv(["A", "B"], [["1", "=x"]]);
    expect(out.startsWith("\uFEFFA,B\r\n")).toBe(true);
    expect(out).toContain("1,'=x\r\n");
  });

  it("formats cents without floating point", () => {
    expect(centsForCsv(12000)).toBe("120.00");
    expect(centsForCsv(5)).toBe("0.05");
    expect(centsForCsv(-250)).toBe("-2.50");
    expect(centsForCsv(null)).toBe("");
  });
});
