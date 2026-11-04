import { describe, expect, it } from "vitest";
import { convertMinor, formatMoney, parseAmount } from "./money";

const LKR = { code: "LKR", symbol: "Rs", decimal_places: 2 };
const CAD = { code: "CAD", symbol: "$", decimal_places: 2 };
const JPY = { code: "JPY", symbol: "¥", decimal_places: 0 };

describe("formatMoney", () => {
  it("formats minor units with grouping and the currency's decimals", () => {
    expect(formatMoney(25000000, LKR)).toBe("Rs 250,000.00");
    expect(formatMoney(123405, CAD)).toBe("$ 1,234.05");
    expect(formatMoney(7, CAD)).toBe("$ 0.07");
    expect(formatMoney(0, CAD)).toBe("$ 0.00");
    expect(formatMoney(1500, JPY)).toBe("¥ 1,500");
    expect(formatMoney(-250, CAD)).toBe("-$ 2.50");
  });
});

describe("parseAmount", () => {
  it("reads typed amounts into minor units", () => {
    expect(parseAmount("250000", 2)).toBe(25000000);
    expect(parseAmount("1,234.5", 2)).toBe(123450);
    expect(parseAmount(" 19.99 ", 2)).toBe(1999);
    expect(parseAmount("0.07", 2)).toBe(7);
    expect(parseAmount("12.", 2)).toBe(1200);
    expect(parseAmount("1500", 0)).toBe(1500);
  });

  it("refuses anything that is not a plain non-negative amount", () => {
    expect(parseAmount("", 2)).toBeNull();
    expect(parseAmount("abc", 2)).toBeNull();
    expect(parseAmount("-5", 2)).toBeNull();
    expect(parseAmount("1.234", 2)).toBeNull();
    expect(parseAmount("1.5", 0)).toBeNull();
    expect(parseAmount("1e5", 2)).toBeNull();
  });
});

describe("convertMinor", () => {
  const cad = { code: "CAD", symbol: "$", decimal_places: 2 };
  const lkr = { code: "LKR", symbol: "Rs", decimal_places: 2 };
  const jpy = { code: "JPY", symbol: "¥", decimal_places: 0 };
  const toBase = { CAD: 1, LKR: 0.005, JPY: 0.01 };

  it("converts in both directions through the base currency", () => {
    expect(convertMinor(10000, cad, lkr, toBase)).toBe(2000000);
    expect(convertMinor(2000000, lkr, cad, toBase)).toBe(10000);
  });

  it("converts between two currencies that are not the base", () => {
    expect(convertMinor(100000, lkr, jpy, toBase)).toBe(500);
  });

  it("handles a currency with different decimal places", () => {
    expect(convertMinor(500, jpy, cad, toBase)).toBe(500);
  });

  it("gives null when a rate is missing", () => {
    expect(convertMinor(100, cad, { code: "TST", symbol: "T", decimal_places: 2 }, toBase)).toBeNull();
  });
});
