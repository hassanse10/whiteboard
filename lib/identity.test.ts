import { describe, expect, it, beforeEach } from "vitest";
import { COLLABORATOR_COLORS, generateIdentity, getOrCreateIdentity } from "./identity";

describe("generateIdentity", () => {
  it("returns a name in 'Adjective Animal Number' format and a color from the palette", () => {
    const identity = generateIdentity();
    expect(identity.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/);
    expect(COLLABORATOR_COLORS).toContain(identity.color);
  });
});

describe("getOrCreateIdentity", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("creates and persists an identity in sessionStorage", () => {
    const identity = getOrCreateIdentity();
    const stored = JSON.parse(sessionStorage.getItem("whiteboard-identity") ?? "null");
    expect(stored).toEqual(identity);
  });

  it("returns the same identity on subsequent calls", () => {
    const first = getOrCreateIdentity();
    const second = getOrCreateIdentity();
    expect(second).toEqual(first);
  });
});
