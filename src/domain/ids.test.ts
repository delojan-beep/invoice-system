import { describe, expect, it } from "vitest";
import { isUuid } from "./ids";

describe("isUuid", () => {
  it("accepts ids in the database's format", () => {
    expect(isUuid("3f2b8c1e-9a4d-4e6f-8b1a-0c2d4e6f8a1b")).toBe(true);
    expect(isUuid("3F2B8C1E-9A4D-4E6F-8B1A-0C2D4E6F8A1B")).toBe(true);
    expect(isUuid("00000000-0000-0000-0000-0000000000e1")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isUuid("new")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("3f2b8c1e-9a4d-4e6f-8b1a-0c2d4e6f8a1")).toBe(false);
    expect(isUuid("3f2b8c1e-9a4d-4e6f-8b1a-0c2d4e6f8a1b/extra")).toBe(false);
  });
});
