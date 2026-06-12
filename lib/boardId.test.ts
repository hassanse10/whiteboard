import { describe, expect, it, beforeEach } from "vitest";
import { ensureBoardId, generateBoardId, getBoardIdFromUrl } from "./boardId";

describe("generateBoardId", () => {
  it("returns a 10-character lowercase alphanumeric id", () => {
    const id = generateBoardId();
    expect(id).toMatch(/^[a-z0-9]{10}$/);
  });

  it("returns different ids on subsequent calls", () => {
    const a = generateBoardId();
    const b = generateBoardId();
    expect(a).not.toBe(b);
  });
});

describe("getBoardIdFromUrl", () => {
  it("returns the board id when present", () => {
    expect(getBoardIdFromUrl("?board=abc123def4")).toBe("abc123def4");
  });

  it("returns null when no board param is present", () => {
    expect(getBoardIdFromUrl("?foo=bar")).toBeNull();
  });

  it("returns null for an empty query string", () => {
    expect(getBoardIdFromUrl("")).toBeNull();
  });
});

describe("ensureBoardId", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("generates and writes a board id into the URL when missing", () => {
    const id = ensureBoardId();
    expect(id).toMatch(/^[a-z0-9]{10}$/);
    expect(getBoardIdFromUrl(window.location.search)).toBe(id);
  });

  it("returns the existing board id from the URL without changing it", () => {
    window.history.replaceState(null, "", "/?board=fixedboard1");
    expect(ensureBoardId()).toBe("fixedboard1");
    expect(window.location.search).toBe("?board=fixedboard1");
  });
});
