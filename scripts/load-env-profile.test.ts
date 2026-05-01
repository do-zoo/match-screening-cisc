import { describe, expect, it } from "vitest";

import {
  getResolvedDbProfile,
  overlayPathForProfile,
} from "./load-env-profile";

describe("getResolvedDbProfile", () => {
  it("defaults to development when unset or unrecognized", () => {
    expect(getResolvedDbProfile({})).toBe("development");
    expect(getResolvedDbProfile({ MATCH_DB_PROFILE: "" })).toBe("development");
    expect(getResolvedDbProfile({ MATCH_DB_PROFILE: "staging" })).toBe(
      "development",
    );
  });

  it("accepts production aliases", () => {
    expect(getResolvedDbProfile({ MATCH_DB_PROFILE: "production" })).toBe(
      "production",
    );
    expect(getResolvedDbProfile({ MATCH_DB_PROFILE: "PROD" })).toBe("production");
  });

  it("accepts development alias dev", () => {
    expect(getResolvedDbProfile({ MATCH_DB_PROFILE: "dev" })).toBe("development");
  });
});

describe("overlayPathForProfile", () => {
  it("resolves overlay paths under cwd", () => {
    expect(overlayPathForProfile("development", "/app")).toBe(
      "/app/.env.local",
    );
    expect(overlayPathForProfile("production", "/app")).toBe("/app/.env.prod");
  });
});
