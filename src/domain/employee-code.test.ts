import { describe, expect, it } from "vitest";
import { nextEmployeeCode } from "./employee-code";

describe("nextEmployeeCode", () => {
  it("starts at E001", () => {
    expect(nextEmployeeCode([])).toBe("E001");
    expect(nextEmployeeCode([null, null])).toBe("E001");
  });

  it("continues after the highest E-number, in any order", () => {
    expect(nextEmployeeCode(["E014", null, "E002"])).toBe("E015");
  });

  it("ignores codes in any other format", () => {
    expect(nextEmployeeCode(["T001", "QN99", "E12A", "E003"])).toBe("E004");
  });

  it("gets longer after E999", () => {
    expect(nextEmployeeCode(["E999"])).toBe("E1000");
  });
});
