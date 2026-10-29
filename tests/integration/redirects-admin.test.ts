import { describe, expect, it } from "vitest";
import { deleteRedirect, saveRedirect, toggleRedirect } from "@/app/admin/(dashboard)/redirects/actions";
import { db } from "@/lib/db";
import { findRedirect } from "@/lib/redirects";
import { signInAs } from "./helpers";
import { expectRedirect, formData } from "./seo.fixtures";

const prev = { ok: false };
const form = (from: string, to: string, extra: Record<string, string | boolean> = {}) =>
  formData({ fromPath: from, toPath: to, statusCode: "301", isActive: true, ...extra });

describe("redirect manager", () => {
  it("creates a normalised 301 redirect that the proxy can find", async () => {
    await signInAs("EDITOR");
    const target = await expectRedirect(() => saveRedirect(null, prev, form("/Old-Menu/", "/menu")));
    expect(target).toBe("/admin/redirects?created=1");
    const rule = await db.redirectRule.findUniqueOrThrow({ where: { fromPath: "/old-menu" } });
    expect(rule).toMatchObject({ toPath: "/menu", statusCode: 301, isActive: true });
    expect(await findRedirect("/OLD-MENU")).toMatchObject({ toPath: "/menu", statusCode: 301 });
  });

  it("rejects redirect loops", async () => {
    await signInAs("EDITOR");
    await db.redirectRule.create({ data: { fromPath: "/a", toPath: "/b" } });
    await db.redirectRule.create({ data: { fromPath: "/b", toPath: "/menu" } });
    const res = await saveRedirect(null, prev, form("/menu-old", "/a", { confirmUnknownTarget: true }));
    // /a → /b → /menu is a chain, not a loop
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/redirects somewhere else/i);

    const loop = await saveRedirect(null, prev, form("/menu", "/a", { confirmReplacePage: true }));
    expect(loop.ok).toBe(false);
    expect(loop.message).toMatch(/loop/i);
    expect(await db.redirectRule.count()).toBe(2);
  });

  it("rejects reserved addresses, unsafe targets and duplicates", async () => {
    await signInAs("EDITOR");
    expect((await saveRedirect(null, prev, form("/admin/orders", "/menu"))).ok).toBe(false);
    expect((await saveRedirect(null, prev, form("/x", "javascript:alert(1)"))).ok).toBe(false);
    await db.redirectRule.create({ data: { fromPath: "/dup", toPath: "/menu" } });
    const dup = await saveRedirect(null, prev, form("/dup", "/plans"));
    expect(dup.ok).toBe(false);
    expect(dup.fieldErrors?.fromPath).toBeTruthy();
  });

  it("asks for confirmation before redirecting a live page or pointing at an unknown page", async () => {
    await signInAs("EDITOR");
    const live = await saveRedirect(null, prev, form("/plans", "/menu"));
    expect(live.ok).toBe(false);
    expect(live.fieldErrors?.confirmReplacePage).toBeTruthy();

    const unknown = await saveRedirect(null, prev, form("/old", "/does-not-exist"));
    expect(unknown.ok).toBe(false);
    expect(unknown.fieldErrors?.confirmUnknownTarget).toBeTruthy();

    await expectRedirect(() => saveRedirect(null, prev, form("/old", "/does-not-exist", { confirmUnknownTarget: true })));
    expect(await db.redirectRule.count()).toBe(1);
  });

  it("allows external https targets", async () => {
    await signInAs("EDITOR");
    await expectRedirect(() => saveRedirect(null, prev, form("/insta", "https://www.instagram.com/mcpreps.mt/")));
    expect((await db.redirectRule.findUniqueOrThrow({ where: { fromPath: "/insta" } })).toPath).toBe("https://www.instagram.com/mcpreps.mt/");
  });

  it("pauses, re-activates and deletes redirects, and writes the audit log", async () => {
    await signInAs("EDITOR");
    const rule = await db.redirectRule.create({ data: { fromPath: "/gone", toPath: "/menu" } });
    expect((await toggleRedirect(rule.id)).ok).toBe(true);
    expect((await db.redirectRule.findUniqueOrThrow({ where: { id: rule.id } })).isActive).toBe(false);
    expect(await findRedirect("/gone")).toBeNull();
    expect((await toggleRedirect(rule.id)).ok).toBe(true);
    expect((await deleteRedirect(rule.id)).ok).toBe(true);
    expect(await db.redirectRule.count()).toBe(0);
    expect(await db.auditLog.count({ where: { entityType: "RedirectRule" } })).toBe(3);
  });

  it("requires a signed-in admin", async () => {
    const res = await saveRedirect(null, prev, form("/x", "/menu"));
    expect(res.ok).toBe(false);
    expect(await db.redirectRule.count()).toBe(0);
  });
});
