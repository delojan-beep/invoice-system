import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/src/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { parseOpenErApi } = await import("./rates");

describe("parseOpenErApi", () => {
  it("turns '1 CAD = 220 LKR' into the LKR-to-CAD rate", () => {
    const rates = parseOpenErApi(
      { result: "success", base_code: "CAD", time_last_update_unix: 1793145601, rates: { CAD: 1, LKR: 220, USD: 0.72 } },
      "CAD",
      ["LKR"],
    );
    expect(rates.date).toBe("2026-10-28");
    expect(rates.source).toBe("open.er-api.com");
    expect(rates.toBase.LKR).toBeCloseTo(1 / 220, 12);
    expect(Object.keys(rates.toBase)).toEqual(["LKR"]);
  });

  it("leaves out currencies the provider does not have", () => {
    const rates = parseOpenErApi({ result: "success", base_code: "CAD", time_last_update_unix: 1793145601, rates: {} }, "CAD", ["LKR"]);
    expect(rates.toBase).toEqual({});
  });

  it("rejects error responses and the wrong base", () => {
    expect(() => parseOpenErApi({ result: "error" }, "CAD", ["LKR"])).toThrow();
    expect(() =>
      parseOpenErApi({ result: "success", base_code: "USD", time_last_update_unix: 1, rates: { LKR: 300 } }, "CAD", ["LKR"]),
    ).toThrow();
  });
});
