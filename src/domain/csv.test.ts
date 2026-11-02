import { describe, expect, it } from "vitest";
import { minorToDecimal, toCsv } from "./csv";

describe("toCsv", () => {
  it("writes rows with a BOM and CRLF line endings", () => {
    expect(toCsv([["a", "b"], [1, null]])).toBe("﻿a,b\r\n1,\r\n");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv([['Perera, Nimal', 'He said "hi"', "two\nlines"]])).toBe(
      '﻿"Perera, Nimal","He said ""hi""","two\nlines"\r\n',
    );
  });

  it("stops text that looks like a formula from running", () => {
    expect(toCsv([["=HYPERLINK(\"http://x\")", "+1", "-2", "@SUM(A1)"]])).toBe(
      "﻿\"'=HYPERLINK(\"\"http://x\"\")\",'+1,'-2,'@SUM(A1)\r\n",
    );
  });

  it("leaves real negative numbers alone", () => {
    expect(toCsv([[-250]])).toBe("﻿-250\r\n");
  });
});

describe("minorToDecimal", () => {
  it("formats minor units for spreadsheets, without symbols or grouping", () => {
    expect(minorToDecimal(25000000, 2)).toBe("250000.00");
    expect(minorToDecimal(7, 2)).toBe("0.07");
    expect(minorToDecimal(1500, 0)).toBe("1500");
    expect(minorToDecimal(-250, 2)).toBe("-2.50");
    expect(minorToDecimal(null, 2)).toBe("");
  });
});
