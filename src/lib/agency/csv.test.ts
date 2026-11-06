import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE, parseCsv, validateRows } from "@/lib/agency/csv";

describe("traveler CSV", () => {
  it("reads quotes, commas inside quotes, doubled quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("accepts the downloadable template", () => { const r = validateRows(parseCsv(CSV_TEMPLATE)); expect(r.errors).toEqual([]); expect(r.ok).toHaveLength(1); expect(r.ok[0]).toMatchObject({ surname: "Eriksson", sex: "F", nationality: "SWE", passport_no: "L898902C3" }); });
  it("names the row and the problem for each bad line and keeps the good ones", () => {
    const head = CSV_TEMPLATE.split("\n")[0], good = CSV_TEMPLATE.split("\n")[1];
    const r = validateRows(parseCsv([head, good, good.replace("F,", "X,").replace("L898902C3", "A1234567"), good.replace("anna@example.com", "nope"), good, "", good.replace("L898902C3", "B7654321").replace("2031-03-08", "2020-01-01")].join("\n")));
    expect(r.ok.map((x) => x.passport_no)).toEqual(["L898902C3"]);
    expect(r.errors).toEqual([{ row: 3, message: "sex (M or F)" }, { row: 4, message: "email" }, { row: 5, message: "passport_no appears twice in the file" }, { row: 6, message: "passport dates" }]);
  });
  it("refuses a file with missing columns, no rows or too many rows", () => {
    expect(validateRows(parseCsv("given_name,surname\nA,B")).fatal).toMatch(/columns/); expect(validateRows([]).fatal).toBe("empty");
    const many = [CSV_TEMPLATE.split("\n")[0], ...Array.from({ length: 201 }, (_, i) => CSV_TEMPLATE.split("\n")[1].replace("L898902C3", `P${100000 + i}`))].join("\n");
    expect(validateRows(parseCsv(many)).fatal).toMatch(/rows/);
  });
});
