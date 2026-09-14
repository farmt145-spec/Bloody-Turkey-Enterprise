import { describe, expect, it } from "vitest";

import { getNetlifyBuildError } from "./netlify-build";

describe("getNetlifyBuildError", () => {
  it("does not require VITE_API_URL outside Netlify builds", () => {
    expect(getNetlifyBuildError({}, "build")).toBeNull();
    expect(getNetlifyBuildError({ NETLIFY: "true" }, "serve")).toBeNull();
  });

  it("accepts Netlify builds when VITE_API_URL is set", () => {
    expect(
      getNetlifyBuildError(
        { NETLIFY: "true", VITE_API_URL: "https://api.example.com/api/trpc" },
        "build",
      ),
    ).toBeNull();
  });

  it("returns a clear error for Netlify builds without VITE_API_URL", () => {
    expect(getNetlifyBuildError({ NETLIFY: "true" }, "build")).toContain(
      "VITE_API_URL",
    );
  });
});
