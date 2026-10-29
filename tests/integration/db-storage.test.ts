import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { DatabaseStorage } from "@/lib/storage";

describe("database image storage", () => {
  it("stores, replaces, reads and deletes files by key", async () => {
    const store = new DatabaseStorage();
    const first = await store.put("meals/2026/abc.webp", Buffer.from("first"), "image/webp");
    expect(first).toEqual({ key: "meals/2026/abc.webp", url: "/media/meals/2026/abc.webp" });
    await store.put("meals/2026/abc.webp", Buffer.from("second!"), "image/webp");
    expect((await store.read("meals/2026/abc.webp"))?.toString()).toBe("second!");
    expect(await db.storedFile.findUniqueOrThrow({ where: { key: "meals/2026/abc.webp" } })).toMatchObject({ sizeBytes: 7 });

    await store.delete("meals/2026/abc.webp");
    await store.delete("meals/2026/abc.webp"); // already gone: no error
    expect(await store.read("meals/2026/abc.webp")).toBeNull();
  });

  it("refuses unsafe keys", async () => {
    const store = new DatabaseStorage();
    await expect(store.put("../etc/passwd", Buffer.from("x"), "text/plain")).rejects.toThrow(/Unsafe/);
    await expect(store.read("a//b.webp")).rejects.toThrow(/Unsafe/);
  });
});
