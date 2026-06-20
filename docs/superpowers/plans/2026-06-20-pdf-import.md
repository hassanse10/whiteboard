# PDF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toolbar button that lets any user upload a PDF, renders each page as a PNG image, places them as moveable Excalidraw elements on the shared canvas, and automatically syncs them to all connected collaborators via the existing socket file-upload path.

**Architecture:** `pdfjs-dist` is dynamically imported inside the handler so it never bloats the initial bundle. Page layout is extracted to a pure function in `lib/pdfLayout.ts` (testable with vitest). All UI and handler changes live in `components/Whiteboard.tsx`. The existing `file-upload` + `scene-update` socket events carry everything to collaborators — no server changes needed.

**Tech Stack:** pdfjs-dist ^3.11.0, vitest (existing), jsdom (existing), Socket.IO (existing), Excalidraw API (existing)

## Global Constraints

- Only `components/Whiteboard.tsx` and the new `lib/pdfLayout.ts` (+ its test) are changed on the client side. Server files are untouched.
- No new socket events. Use existing `file-upload` and `scene-update`.
- Each page PNG is emitted in its own `file-upload` message to stay under the server's 15 MB `maxHttpBufferSize` per-message limit.
- Render scale: 1.5 (72 pt × 1.5 = 108 DPI — good quality, ~1–2 MB PNG per page).
- Gap between placed pages on canvas: 24 px.
- Worker configured via cdnjs CDN URL pinned to `pdfjsLib.version` at runtime.
- File IDs generated with `crypto.randomUUID()` (no new imports).
- Error toast reuses existing `.link-toast` CSS class.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/pdfLayout.ts` | Pure function: compute canvas positions for PDF pages |
| Create | `lib/pdfLayout.test.ts` | Vitest unit tests for the layout function |
| Modify | `components/Whiteboard.tsx` | Icon, refs, state, hidden input, overlay, toolbar button, handler |

---

### Task 1: Install pdfjs-dist

**Files:**
- Modify: `package.json` (via npm)

**Interfaces:**
- Produces: `pdfjs-dist` available for dynamic import in Task 4

- [ ] **Step 1: Install the package**

```bash
npm install pdfjs-dist@^3.11.0
```

Expected output ends with something like:
```
added 3 packages ...
```

- [ ] **Step 2: Verify TypeScript sees the types**

```bash
npx tsc --noEmit
```

Expected: exits 0 (no new errors). If `pdfjs-dist` type errors appear, run:
```bash
npm install --save-dev @types/pdfjs-dist
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install pdfjs-dist for PDF import"
```

---

### Task 2: Extract and test computePdfPagePositions

**Files:**
- Create: `lib/pdfLayout.ts`
- Create: `lib/pdfLayout.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function computePdfPagePositions(
    pages: Array<{ width: number; height: number }>,
    viewport: { scrollX: number; scrollY: number; width: number; height: number },
    gap?: number
  ): Array<{ x: number; y: number; width: number; height: number }>
  ```
  Consumed by `handleImportPdf` in Task 4.

- [ ] **Step 1: Write the failing tests**

Create `lib/pdfLayout.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
npm test -- lib/pdfLayout.test.ts
```

Expected: 5 failures, `Cannot find module './pdfLayout'`

- [ ] **Step 3: Implement computePdfPagePositions**

Create `lib/pdfLayout.ts`:

```typescript
export function computePdfPagePositions(
  pages: Array<{ width: number; height: number }>,
  viewport: { scrollX: number; scrollY: number; width: number; height: number },
  gap = 24
): Array<{ x: number; y: number; width: number; height: number }> {
  const totalWidth = pages.reduce((sum, p) => sum + p.width, 0) + (pages.length - 1) * gap;
  const maxHeight = Math.max(...pages.map((p) => p.height));
  const startX = -viewport.scrollX + (viewport.width - totalWidth) / 2;
  const startY = -viewport.scrollY + (viewport.height - maxHeight) / 2;

  const result: Array<{ x: number; y: number; width: number; height: number }> = [];
  let x = startX;
  for (const page of pages) {
    result.push({ x, y: startY, width: page.width, height: page.height });
    x += page.width + gap;
  }
  return result;
}
```

- [ ] **Step 4: Run tests — verify all 5 pass**

```bash
npm test -- lib/pdfLayout.test.ts
```

Expected:
```
✓ lib/pdfLayout.test.ts (5)
  ✓ computePdfPagePositions > centers a single page in the viewport
  ✓ computePdfPagePositions > places two pages side-by-side with the default 24 px gap
  ✓ computePdfPagePositions > respects a custom gap
  ✓ computePdfPagePositions > accounts for viewport scroll
  ✓ computePdfPagePositions > handles pages with different widths and heights
```

- [ ] **Step 5: Commit**

```bash
git add lib/pdfLayout.ts lib/pdfLayout.test.ts
git commit -m "feat: add computePdfPagePositions utility for PDF import layout"
```

---

### Task 3: Scaffold UI — icon, refs, state, hidden input, loading overlay, toolbar button

**Files:**
- Modify: `components/Whiteboard.tsx`

**Interfaces:**
- Consumes: none yet (handler wired in Task 4)
- Produces:
  - `pdfInputRef` — `RefObject<HTMLInputElement>` used by Task 4's handler
  - `pdfImporting` state — `{ current: number; total: number } | null` used by overlay and Task 4
  - `pdfError` state — `boolean` used by error toast and Task 4
  - `handleImportPdf` stub — wired to the hidden input's `onChange`

- [ ] **Step 1: Add the pdfImport icon to iconPaths**

In `components/Whiteboard.tsx`, find the `iconPaths` object (around line 154). The existing `pdf` entry ends with a down arrow. Add `pdfImport` with an up arrow immediately after the `pdf` entry:

```tsx
  pdf: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-5" />
      <path d="m9.5 15.5 2.5 2.5 2.5-2.5" />
    </>
  ),
  pdfImport: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M12 13v5" />
      <path d="m9.5 15.5 2.5-2.5 2.5 2.5" />
    </>
  ),
```

Also update the `IconName` type (around line 129) to include `"pdfImport"`:

```tsx
type IconName =
  | "lock"
  | "hand"
  | "pointer"
  | "square"
  | "diamond"
  | "circle"
  | "arrow"
  | "line"
  | "pencil"
  | "text"
  | "image"
  | "eraser"
  | "frame"
  | "link"
  | "sections"
  | "present"
  | "stop"
  | "video"
  | "pdf"
  | "pdfImport"
  | "layerToBack"
  | "layerBackward"
  | "layerForward"
  | "layerToFront";
```

- [ ] **Step 2: Add import for computePdfPagePositions**

At the top of `components/Whiteboard.tsx`, after the existing local imports (around line 14), add:

```tsx
import { computePdfPagePositions } from "../lib/pdfLayout";
```

- [ ] **Step 3: Add pdfInputRef, pdfImporting, and pdfError state**

Inside the `Whiteboard` function body, after the existing `cacheTimerRef` declaration (around line 356), add:

```tsx
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfImporting, setPdfImporting] = useState<{ current: number; total: number } | null>(null);
  const [pdfError, setPdfError] = useState(false);
```

- [ ] **Step 4: Add a stub handleImportPdf**

After the `handleZoomReset` function (around line 683), add this stub (the full implementation replaces it in Task 4):

```tsx
  const handleImportPdf = async (_event: React.ChangeEvent<HTMLInputElement>) => {
    // implemented in Task 4
  };
```

- [ ] **Step 5: Add hidden file input and loading overlay to JSX**

Inside the return, find the `<div className="board-wrapper">` opening tag. Add the hidden file input just inside it (before the existing `<div className="right-clock-row">`):

```tsx
        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={handleImportPdf}
        />
```

Then add the loading overlay directly after the hidden input:

```tsx
        {pdfImporting ? (
          <div className="pdf-import-overlay">
            <div className="pdf-import-card">
              <span className="pdf-import-text">
                Rendering PDF pages… {pdfImporting.current} / {pdfImporting.total}
              </span>
            </div>
          </div>
        ) : null}
```

- [ ] **Step 6: Add the Import PDF toolbar button**

Find the existing `handleExportPdf` button (around line 1054). Add the Import PDF button immediately before it, in the same toolbar group:

```tsx
            <button
              type="button"
              className="icon-btn"
              onClick={() => pdfInputRef.current?.click()}
              title="Import PDF (all pages placed on canvas)"
              aria-label="Import PDF"
            >
              <ToolIcon name="pdfImport" />
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={handleExportPdf}
              title="Export to PDF (frames, selection, or whole board)"
              aria-label="Export to PDF"
            >
              <ToolIcon name="pdf" />
            </button>
```

- [ ] **Step 7: Add error toast**

Find the existing `{linkCopied ? <span className="link-toast">Link copied</span> : null}` line (around line 1069). Add the PDF error toast immediately after it:

```tsx
          {pdfError ? <span className="link-toast">Could not read PDF</span> : null}
```

- [ ] **Step 8: Add overlay CSS**

Inside the existing `<style jsx>` block, add at the end (before the closing backtick):

```css
        .pdf-import-overlay {
          position: absolute;
          inset: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(2px);
        }

        .pdf-import-card {
          padding: 16px 24px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
        }

        .pdf-import-text {
          font-size: 0.9rem;
          font-weight: 600;
          color: #1e1e1e;
        }
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: exits 0. Fix any type errors before continuing.

- [ ] **Step 10: Commit scaffold**

```bash
git add components/Whiteboard.tsx
git commit -m "feat: scaffold PDF import UI — icon, hidden input, overlay, toolbar button"
```

---

### Task 4: Implement handleImportPdf

**Files:**
- Modify: `components/Whiteboard.tsx`

**Interfaces:**
- Consumes:
  - `computePdfPagePositions(pages, viewport, gap?)` from `lib/pdfLayout.ts`
  - `excalidrawAPI.current` — Excalidraw API instance
  - `socketRef.current` — Socket.IO socket
  - `pdfInputRef.current` — hidden file input
  - `knownFileIdsRef` — Set of file IDs already known/uploaded
  - `setPdfImporting({ current, total })` / `setPdfImporting(null)`
  - `setPdfError(true)` + `setTimeout(() => setPdfError(false), 2000)`
- Produces: PDF pages appear on canvas for all users

- [ ] **Step 1: Replace the stub with the full implementation**

Find and replace the `handleImportPdf` stub from Task 3 with:

```tsx
  const handleImportPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const api = excalidrawAPI.current;
    const socket = socketRef.current;
    if (!api || !socket) return;

    try {
      const arrayBuffer = await file.arrayBuffer();

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      setPdfImporting({ current: 0, total: numPages });

      const pageFiles: Array<{ id: string; mimeType: string; dataURL: string; created: number }> = [];
      const pageDimensions: Array<{ width: number; height: number }> = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataURL = canvas.toDataURL("image/png");
        const id = crypto.randomUUID();

        pageFiles.push({ id, mimeType: "image/png", dataURL, created: Date.now() });
        pageDimensions.push({ width: canvas.width, height: canvas.height });

        setPdfImporting({ current: i, total: numPages });
      }

      // Mark as known BEFORE addFiles so onChange doesn't re-upload them
      for (const f of pageFiles) {
        knownFileIdsRef.current.add(f.id);
      }

      api.addFiles(pageFiles);

      // Emit one file per message to stay under the 15 MB socket buffer limit
      for (const f of pageFiles) {
        socket.emit("file-upload", { files: { [f.id]: f } });
      }

      const appState = api.getAppState();
      const positions = computePdfPagePositions(pageDimensions, {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        width: appState.width,
        height: appState.height,
      });

      const existingElements = api.getSceneElements();
      const now = Date.now();
      const newElements = pageFiles.map((f, i) => ({
        id: crypto.randomUUID(),
        type: "image" as const,
        fileId: f.id,
        x: positions[i].x,
        y: positions[i].y,
        width: positions[i].width,
        height: positions[i].height,
        angle: 0,
        strokeColor: "#000000",
        backgroundColor: "transparent",
        fillStyle: "solid" as const,
        strokeWidth: 1,
        strokeStyle: "solid" as const,
        roughness: 1,
        opacity: 100,
        groupIds: [] as string[],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 1e6),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1e6),
        isDeleted: false,
        boundElements: null,
        updated: now,
        link: null,
        locked: false,
        status: "saved" as const,
        scale: [1, 1] as [number, number],
      }));

      api.updateScene({ elements: [...existingElements, ...newElements] });
    } catch {
      setPdfError(true);
      setTimeout(() => setPdfError(false), 2000);
    } finally {
      setPdfImporting(null);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = "";
      }
    }
  };
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: exits 0. Common fix if image element type errors appear — cast the whole element `as any` only on the `updateScene` call (Excalidraw's public types can be stricter than the runtime accepts):

```tsx
api.updateScene({ elements: [...existingElements, ...newElements] as any[] });
```

- [ ] **Step 3: Run all existing tests to verify no regressions**

```bash
npm test
```

Expected: all tests pass (the pdfLayout tests from Task 2 plus the existing lib tests).

- [ ] **Step 4: Commit**

```bash
git add components/Whiteboard.tsx
git commit -m "feat: implement PDF import — renders pages as canvas images, syncs to collaborators"
```

---

### Task 5: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:3000` in the browser.

- [ ] **Step 2: Verify the Import PDF button appears in the toolbar**

Look at the floating toolbar at the top center of the whiteboard. There should be two PDF-related buttons side-by-side — the new Import PDF button (file with up arrow) and the existing Export PDF button (file with down arrow). Hover over each to confirm tooltip text.

- [ ] **Step 3: Import a single-page PDF**

Click the Import PDF button. Select any single-page PDF from disk. The loading overlay should appear briefly showing "Rendering PDF pages… 1 / 1", then the page image should appear centered on the canvas.

- [ ] **Step 4: Import a multi-page PDF**

Click Import PDF again, select a multi-page PDF (3+ pages). Verify:
- Overlay counts up: "Rendering PDF pages… 1 / 3", "2 / 3", "3 / 3"
- Pages appear side-by-side on the canvas, horizontally centered in the current viewport
- All pages are moveable and resizable like any Excalidraw image

- [ ] **Step 5: Verify collaboration sync**

Open the board URL in a second browser tab (or incognito window). After importing a PDF in the first tab, the page images should appear in the second tab within a few seconds — synced via the existing file-upload / scene-update socket events.

- [ ] **Step 6: Test error path**

Click Import PDF and select a non-PDF file (rename a `.txt` to `.pdf` and try to import it, or pass a corrupted file). The "Could not read PDF" toast should appear briefly and the overlay should dismiss.

- [ ] **Step 7: Verify existing export PDF still works**

Click the Export PDF button (file with down arrow). Verify the whiteboard still exports to a PDF file as before.

- [ ] **Step 8: Final commit**

If any small fixes were made during verification:

```bash
git add -p
git commit -m "fix: PDF import verification fixes"
```

If no fixes needed:

```bash
git log --oneline -5
# confirm all commits are present, nothing to add
```
