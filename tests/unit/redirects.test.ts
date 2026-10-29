import { describe, expect, it } from "vitest";
import { checkRedirect } from "@/lib/redirect-rules";

describe("checkRedirect", () => {
  it("accepts a simple redirect", () => {
    expect(checkRedirect({ fromPath: "/old", toPath: "/new" }, [])).toBeNull();
  });
  it("rejects same-path and reserved sources", () => {
    expect(checkRedirect({ fromPath: "/a", toPath: "/a/" }, [])).toBe("SAME_PATH");
    expect(checkRedirect({ fromPath: "/admin/x", toPath: "/a" }, [])).toBe("RESERVED_SOURCE");
  });
  it("detects loops", () => {
    expect(checkRedirect({ fromPath: "/b", toPath: "/a" }, [{ fromPath: "/a", toPath: "/b" }])).toBe("LOOP");
    expect(
      checkRedirect({ fromPath: "/c", toPath: "/a" }, [
        { fromPath: "/a", toPath: "/b" },
        { fromPath: "/b", toPath: "/c" },
      ]),
    ).toBe("LOOP");
  });
  it("reports chains", () => {
    expect(checkRedirect({ fromPath: "/x", toPath: "/a" }, [{ fromPath: "/a", toPath: "/b" }])).toBe("CHAIN");
  });
  it("validates targets", () => {
    expect(checkRedirect({ fromPath: "/x", toPath: "javascript:alert(1)" }, [])).toBe("INVALID_TARGET");
    expect(checkRedirect({ fromPath: "/x", toPath: "https://www.instagram.com/mcpreps.mt/" }, [])).toBeNull();
  });
});
