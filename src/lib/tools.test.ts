import { describe, expect, test } from "bun:test";
import { stripTracking, buildUtm, slugify, contrastRatio, phishingHeuristics, csvToJson } from "./tools";

describe("toolkit", () => {
  test("stripTracking removes utm and fbclid, keeps real params", () => {
    expect(stripTracking("https://a.com/p?id=4&utm_source=x&fbclid=y")).toBe("https://a.com/p?id=4");
  });
  test("buildUtm adds campaign params", () => {
    expect(buildUtm("a.com", { source: "s", medium: "m", campaign: "c" })).toBe(
      "https://a.com/?utm_source=s&utm_medium=m&utm_campaign=c",
    );
  });
  test("slugify", () => {
    expect(slugify("Hello World — Café!")).toBe("hello-world-cafe");
  });
  test("black on white contrast is 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  });
  test("phishing heuristics flag http + sensitive keyword + abuse TLD", () => {
    const r = phishingHeuristics("http://secure-login.example.xyz");
    expect(r.flags.length).toBe(3);
    expect(phishingHeuristics("https://stripe.com").flags.length).toBe(0);
  });
  test("csvToJson", () => {
    expect(csvToJson("a,b\n1,2")).toEqual([{ a: "1", b: "2" }]);
  });
});
