import { describe, expect, it } from "vitest";
import { lineHref, telHref } from "./channel-links";

describe("official channel links", () => {
  it("LINE: an official account id opens the add-friend page, a personal id uses the ~ form", () => {
    expect(lineHref("@269usddf")).toBe("https://line.me/R/ti/p/%40269usddf");
    expect(lineHref("  @thaipass.evoa ")).toBe("https://line.me/R/ti/p/%40thaipass.evoa");
    expect(lineHref("somchai_99")).toBe("https://line.me/ti/p/~somchai_99");
  });
  it("LINE: text that is not an id gives no link", () => {
    for (const bad of ["", "ab", "@", "line id: @abc", "@abc/../x", "javascript:alert(1)", "@a b", "<b>@abc</b>", "@" + "x".repeat(40)]) expect(lineHref(bad), bad).toBeNull();
  });
  it("phone: keeps digits and a leading plus only", () => {
    expect(telHref("+66-94-612-0581")).toBe("tel:+66946120581");
    expect(telHref("094 612 0581")).toBe("tel:0946120581");
    expect(telHref("(02) 123-4567")).toBe("tel:021234567");
  });
  it("phone: refuses anything that is not a phone number", () => {
    for (const bad of ["", "12", "call me", "tel:123456", "+66 94 abc", "1;2;3;4;5", "+--", "00000" + "1".repeat(40)]) expect(telHref(bad), bad).toBeNull();
  });
});
