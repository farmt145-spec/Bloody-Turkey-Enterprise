import { describe, expect, it } from "vitest";

import { parseAllowedOrigins, resolveCorsOrigin } from "./cors";

describe("parseAllowedOrigins", () => {
  it("splits, trims, and deduplicates configured origins", () => {
    expect(
      parseAllowedOrigins(" https://a.example ,https://b.example,https://a.example "),
    ).toEqual(["https://a.example", "https://b.example"]);
  });
});

describe("resolveCorsOrigin", () => {
  it("accepts configured production origins", () => {
    expect(
      resolveCorsOrigin("https://site.netlify.app", ["https://site.netlify.app"], true),
    ).toBe("https://site.netlify.app");
  });

  it("allows common localhost origins in development", () => {
    expect(resolveCorsOrigin("http://localhost:5173", [], false)).toBe("http://localhost:5173");
  });

  it("rejects unknown origins", () => {
    expect(resolveCorsOrigin("https://evil.example", [], true)).toBeNull();
  });
});
