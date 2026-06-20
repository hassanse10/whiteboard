import { describe, it, expect } from "vitest";
import { computePdfPagePositions } from "./pdfLayout";

const vp = { scrollX: 0, scrollY: 0, width: 1000, height: 800 };

describe("computePdfPagePositions", () => {
  it("centers a single page in the viewport", () => {
    const result = computePdfPagePositions([{ width: 400, height: 600 }], vp);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(300);  // (1000 - 400) / 2
    expect(result[0].y).toBe(100);  // (800 - 600) / 2
    expect(result[0].width).toBe(400);
    expect(result[0].height).toBe(600);
  });

  it("places two pages side-by-side with the default 24 px gap", () => {
    const pages = [{ width: 400, height: 600 }, { width: 400, height: 600 }];
    const result = computePdfPagePositions(pages, vp);
    // totalWidth = 400 + 24 + 400 = 824; startX = (1000 - 824) / 2 = 88
    expect(result[0].x).toBe(88);
    expect(result[1].x).toBe(512);  // 88 + 400 + 24
    expect(result[0].y).toBe(result[1].y);
  });

  it("respects a custom gap", () => {
    const pages = [{ width: 200, height: 300 }, { width: 200, height: 300 }];
    const result = computePdfPagePositions(pages, vp, 50);
    // totalWidth = 200 + 50 + 200 = 450; startX = (1000 - 450) / 2 = 275
    expect(result[0].x).toBe(275);
    expect(result[1].x).toBe(525);  // 275 + 200 + 50
  });

  it("accounts for viewport scroll", () => {
    const scrolled = { scrollX: 500, scrollY: 200, width: 1000, height: 800 };
    const result = computePdfPagePositions([{ width: 400, height: 600 }], scrolled);
    // x = -500 + (1000 - 400) / 2 = -200
    // y = -200 + (800 - 600) / 2 = -100
    expect(result[0].x).toBe(-200);
    expect(result[0].y).toBe(-100);
  });

  it("handles pages with different widths and heights", () => {
    const pages = [{ width: 300, height: 400 }, { width: 500, height: 700 }];
    const result = computePdfPagePositions(pages, vp);
    // totalWidth = 300 + 24 + 500 = 824; startX = 88
    // maxHeight = 700; startY = (800 - 700) / 2 = 50
    expect(result[0].x).toBe(88);
    expect(result[1].x).toBe(88 + 300 + 24);  // 412
    expect(result[0].y).toBe(50);
    expect(result[1].y).toBe(50);
  });
});
