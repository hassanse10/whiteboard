# PDF Import for Collaborative Whiteboard

**Date:** 2026-06-20
**Status:** Approved

## Overview

Allow any user on the whiteboard to upload a PDF file. Each page is rendered client-side to a PNG image and placed as a moveable Excalidraw image element on the shared canvas. All collaborators in the same board session see the pages appear automatically via the existing file-upload and scene-update socket events — no new server code required.

## Architecture

The feature is entirely client-side. No new server events, no new server files.

```
User clicks "Import PDF" → file picker opens
  → pdfjs-dist renders each page to PNG (offscreen canvas, 1.5× scale)
  → api.addFiles(allPageFiles) registers images with Excalidraw
  → socket.emit("file-upload", ...) sends each page PNG to server (one per emit)
  → api.updateScene({ elements }) places image elements on canvas
  → existing onChange debounce emits scene-update with new element positions
  → other users receive file-data + scene-update → pages appear on their canvas
```

## Dependencies

- `pdfjs-dist` — PDF parsing and page rendering. Dynamically imported inside the handler so it does not affect the initial bundle size.
- Worker is configured via CDN URL pinned to the installed library version (`pdfjsLib.version`).

## Components

All changes are confined to `components/Whiteboard.tsx`.

### New icon: `pdfImport`

Added to `iconPaths`. Visually: a file with an **up** arrow (distinguishes import from the existing export button's down arrow).

### New toolbar button

Placed in the existing PDF/link toolbar group, adjacent to the export button. Label: "Import PDF".

### Hidden file input

```tsx
<input
  ref={pdfInputRef}
  type="file"
  accept=".pdf"
  style={{ display: "none" }}
  onChange={handleImportPdf}
/>
```

Triggered by the toolbar button's `onClick`. Reset after each import so the same file can be re-uploaded.

### `pdfImporting` state

```ts
const [pdfImporting, setPdfImporting] = useState<{ current: number; total: number } | null>(null);
```

`null` = idle. Non-null = show loading overlay with "Rendering PDF pages… N / Total".

### Loading overlay

Centered absolute overlay (z-index above the canvas, below the toolbar). Displays progress text. Uses existing design tokens (white background, rounded card, shadow).

## Data Flow

### `handleImportPdf(event)`

```
1. Read file as ArrayBuffer
2. Dynamic import pdfjs-dist, set GlobalWorkerOptions.workerSrc (CDN, version-pinned)
3. pdfjsLib.getDocument(arrayBuffer).promise
4. setPdfImporting({ current: 0, total: numPages })
5. For page 1..numPages:
   a. page.render({ canvasContext, viewport at scale 1.5 })
   b. canvas.toDataURL("image/png") → dataURL
   c. Build file object: { id: nanoid(), mimeType: "image/png", dataURL, created: Date.now() }
   d. setPdfImporting({ current: i, total: numPages })
6. api.addFiles(allPageFiles)
7. Add each file.id to knownFileIdsRef (prevents onChange from re-emitting)
8. For each pageFile: socket.emit("file-upload", { files: { [pageFile.id]: pageFile } })
   (one emit per page keeps each message well under the 15 MB server buffer limit)
9. Compute element positions:
   - startX = -scrollX + (viewportWidth - totalWidth) / 2
   - startY = -scrollY + (viewportHeight - maxHeight) / 2
   - pages laid out left-to-right with 24 px gap
10. api.updateScene({ elements: [...existingElements, ...newImageElements] })
    (existing onChange debounce emits scene-update to collaborators)
11. setPdfImporting(null), reset file input value
```

### Image element shape (per page)

```ts
{
  type: "image",
  id: nanoid(),
  fileId: pageFile.id,
  x, y,           // computed from viewport position
  width, height,  // rendered canvas pixel dimensions
  status: "saved",
  angle: 0,
  opacity: 100,
  isDeleted: false,
  version: 1,
  versionNonce: Math.floor(Math.random() * 1e6),
  seed: Math.floor(Math.random() * 1e6),
  groupIds: [],
  boundElements: null,
  updated: Date.now(),
  link: null,
  locked: false,
  frameId: null,
  scale: [1, 1],
}
```

## Page Layout

Pages are placed **left-to-right** at a fixed Y, centered on the current viewport:

```
totalWidth  = sum of all page widths + (numPages - 1) * 24
startX      = -appState.scrollX + (appState.width  - totalWidth) / 2
startY      = -appState.scrollY + (appState.height - maxPageHeight) / 2
page[i].x   = startX + sum of widths[0..i-1] + i * 24
page[i].y   = startY
```

## Error Handling

- Wrap the entire pipeline in `try/catch`. On failure: show a `link-toast`-styled error message "Could not read PDF" for 2 seconds.
- `finally` block always: `setPdfImporting(null)`, reset `pdfInputRef.current.value`.
- No page count limit. Large PDFs (20+ pages) take longer but the progress counter keeps the user informed.

## What Is Not Changing

- Server (`server/index.js`, `server/rooms.js`, `server/db.js`) — no changes
- Socket protocol — no new events
- Existing PDF export button — untouched
- All other Whiteboard features — untouched
