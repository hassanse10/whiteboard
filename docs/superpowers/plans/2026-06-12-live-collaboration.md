# Live Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a whiteboard to be shared via link so multiple users can draw on it simultaneously, each shown with a randomly generated name and cursor color.

**Architecture:** A new small Node.js "realtime" service (Express + socket.io + `pg`) relays scene/cursor updates between clients in a board's room and persists scene state to Postgres. The Next.js frontend gains a `lib/boardId.ts` (board ID in URL), `lib/identity.ts` (random name/color in `sessionStorage`), and `lib/socket.ts` (socket.io-client connection), wired into `components/Whiteboard.tsx` which removes the old `?scene=`/`localStorage` sharing code and uses Excalidraw's `reconcileElements` + `collaborators` prop for remote cursors.

**Tech Stack:** Next.js 15 / React 18 / `@excalidraw/excalidraw` 0.18 (frontend, existing), Node.js + Express + `socket.io` + `pg` (new realtime service), Postgres (new Railway addon), `socket.io-client` (frontend), Vitest + jsdom (frontend unit tests), `node:test` (server unit tests).

---

## File Structure

- `lib/boardId.ts` (new) — generate/read board IDs, sync with URL
- `lib/boardId.test.ts` (new)
- `lib/identity.ts` (new) — random display name + color, persisted in `sessionStorage`
- `lib/identity.test.ts` (new)
- `lib/socket.ts` (new) — singleton `socket.io-client` connection
- `vitest.config.ts` (new) — test runner config for `lib/`
- `server/package.json` (new) — realtime service manifest
- `server/rooms.js` (new) — in-memory per-board presence tracking
- `server/rooms.test.js` (new)
- `server/db.js` (new) — Postgres schema + scene persistence
- `server/index.js` (new) — Express + socket.io server, wires rooms.js + db.js
- `components/Whiteboard.tsx` (modify) — remove `?scene=`/localStorage code, add collaboration wiring, share icon, offline indicator
- `package.json` (modify) — add `socket.io-client`, `vitest`, `jsdom`, `test` script
- `.gitignore` (modify) — add `server/node_modules`

---

## Task 1: Frontend test setup + board ID module

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/boardId.ts`
- Test: `lib/boardId.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add Vitest dependencies and test script**

Edit `package.json` — add to `devDependencies` and add a `test` script:

```json
{
  "name": "whiteboard-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@excalidraw/excalidraw": "^0.18.0",
    "next": "^15.5.19",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@types/node": "20.14.2",
    "@types/react": "18.3.4",
    "@types/react-dom": "18.3.0",
    "jsdom": "^24.1.0",
    "typescript": "5.5.4",
    "vitest": "^1.6.0"
  }
}
```

Run: `cd "c:\Users\HASSAN\App2\whiteboard" && npm install`
Expected: install completes, `node_modules/vitest` and `node_modules/socket.io-client` exist.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true
  }
});
```

- [ ] **Step 3: Write the failing test for `lib/boardId.ts`**

Create `lib/boardId.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd "c:\Users\HASSAN\App2\whiteboard" && npm test`
Expected: FAIL — `Cannot find module './boardId'` (or similar resolution error), since `lib/boardId.ts` doesn't exist yet.

- [ ] **Step 5: Implement `lib/boardId.ts`**

Create `lib/boardId.ts`:

```ts
const BOARD_ID_LENGTH = 10;
const BOARD_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateBoardId(): string {
  const bytes = new Uint8Array(BOARD_ID_LENGTH);
  crypto.getRandomValues(bytes);

  let id = "";
  for (let i = 0; i < BOARD_ID_LENGTH; i++) {
    id += BOARD_ID_CHARS[bytes[i] % BOARD_ID_CHARS.length];
  }
  return id;
}

export function getBoardIdFromUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get("board");
}

export function ensureBoardId(): string {
  const existing = getBoardIdFromUrl(window.location.search);
  if (existing) {
    return existing;
  }

  const id = generateBoardId();
  const params = new URLSearchParams(window.location.search);
  params.set("board", id);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  return id;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd "c:\Users\HASSAN\App2\whiteboard" && npm test`
Expected: PASS — all `boardId` tests green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/boardId.ts lib/boardId.test.ts
git commit -m "feat: add board id generation and URL helper"
```

---

## Task 2: Random identity (name + color)

**Files:**
- Create: `lib/identity.ts`
- Test: `lib/identity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/identity.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "c:\Users\HASSAN\App2\whiteboard" && npm test`
Expected: FAIL — `Cannot find module './identity'`.

- [ ] **Step 3: Implement `lib/identity.ts`**

Create `lib/identity.ts`:

```ts
const ADJECTIVES = ["Quick", "Brave", "Calm", "Clever", "Bold", "Bright", "Gentle", "Swift"];
const ANIMALS = ["Fox", "Otter", "Hawk", "Panda", "Wolf", "Falcon", "Lynx", "Heron"];

export const COLLABORATOR_COLORS = [
  "#e03131",
  "#2f9e44",
  "#1971c2",
  "#f08c00",
  "#9c36b5",
  "#0c8599",
  "#e8590c",
  "#37b24d"
];

export type Identity = {
  name: string;
  color: string;
};

export function generateIdentity(): Identity {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const number = Math.floor(Math.random() * 99) + 1;
  const color = COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)];

  return { name: `${adjective} ${animal} ${number}`, color };
}

const STORAGE_KEY = "whiteboard-identity";

export function getOrCreateIdentity(): Identity {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Identity;
    } catch {
      // fall through and generate a fresh identity
    }
  }

  const identity = generateIdentity();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "c:\Users\HASSAN\App2\whiteboard" && npm test`
Expected: PASS — all `identity` tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/identity.ts lib/identity.test.ts
git commit -m "feat: add random collaborator identity generation"
```

---

## Task 3: Realtime server scaffold + room presence tracking

**Files:**
- Create: `server/package.json`
- Create: `server/rooms.js`
- Test: `server/rooms.test.js`
- Modify: `.gitignore`

- [ ] **Step 1: Create the server package manifest**

Create `server/package.json`:

```json
{
  "name": "whiteboard-realtime",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "node --test"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "pg": "^8.12.0",
    "socket.io": "^4.7.5"
  }
}
```

Run: `cd "c:\Users\HASSAN\App2\whiteboard\server" && npm install`
Expected: install completes, `server/node_modules` is created.

- [ ] **Step 2: Ignore the new server's node_modules**

Read `.gitignore`, then add a line for `server/node_modules`:

```
/node_modules
/server/node_modules
/.next/
/out/
/build
.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.env*.local
.env
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 3: Write the failing test for `server/rooms.js`**

Create `server/rooms.test.js`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRoomManager } from "./rooms.js";

describe("createRoomManager", () => {
  it("tracks users joining a board room", () => {
    const rooms = createRoomManager();
    rooms.join("board1", "socketA", { name: "Quick Fox 1", color: "#e03131" });

    assert.deepEqual(rooms.getUsers("board1"), [
      { socketId: "socketA", name: "Quick Fox 1", color: "#e03131" }
    ]);
  });

  it("removes a user on leave and clears empty rooms", () => {
    const rooms = createRoomManager();
    rooms.join("board1", "socketA", { name: "Quick Fox 1", color: "#e03131" });
    rooms.leave("board1", "socketA");

    assert.deepEqual(rooms.getUsers("board1"), []);
  });

  it("finds which room a socket belongs to", () => {
    const rooms = createRoomManager();
    rooms.join("board1", "socketA", { name: "Quick Fox 1", color: "#e03131" });

    assert.equal(rooms.findRoomForSocket("socketA"), "board1");
    assert.equal(rooms.findRoomForSocket("unknown"), null);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd "c:\Users\HASSAN\App2\whiteboard\server" && npm test`
Expected: FAIL — `Cannot find module './rooms.js'`.

- [ ] **Step 5: Implement `server/rooms.js`**

Create `server/rooms.js`:

```js
export function createRoomManager() {
  const rooms = new Map();

  function join(boardId, socketId, identity) {
    if (!rooms.has(boardId)) {
      rooms.set(boardId, new Map());
    }
    rooms.get(boardId).set(socketId, identity);
  }

  function leave(boardId, socketId) {
    const room = rooms.get(boardId);
    if (!room) return;

    room.delete(socketId);
    if (room.size === 0) {
      rooms.delete(boardId);
    }
  }

  function getUsers(boardId) {
    const room = rooms.get(boardId);
    if (!room) return [];

    return Array.from(room.entries()).map(([socketId, identity]) => ({
      socketId,
      ...identity
    }));
  }

  function findRoomForSocket(socketId) {
    for (const [boardId, room] of rooms.entries()) {
      if (room.has(socketId)) return boardId;
    }
    return null;
  }

  return { join, leave, getUsers, findRoomForSocket };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd "c:\Users\HASSAN\App2\whiteboard\server" && npm test`
Expected: PASS — all `rooms` tests green.

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json server/rooms.js server/rooms.test.js .gitignore
git commit -m "feat: scaffold realtime server with room presence tracking"
```

---

## Task 4: Postgres persistence module

**Files:**
- Create: `server/db.js`

- [ ] **Step 1: Implement `server/db.js`**

There is no local Postgres instance available for automated testing, so this module is verified manually against the Railway Postgres addon in Task 8. Implement it directly (no test step for this task):

Create `server/db.js`:

```js
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMPTY_SCENE = { elements: [], appState: {} };

export async function ensureSchema() {
  await pool.query(`
    create table if not exists boards (
      id text primary key,
      scene_data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);
}

export async function getScene(boardId) {
  const result = await pool.query("select scene_data from boards where id = $1", [boardId]);
  if (result.rows.length === 0) {
    return EMPTY_SCENE;
  }
  return result.rows[0].scene_data;
}

export async function saveScene(boardId, scene) {
  await pool.query(
    `insert into boards (id, scene_data, updated_at)
     values ($1, $2, now())
     on conflict (id) do update set scene_data = $2, updated_at = now()`,
    [boardId, scene]
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add server/db.js
git commit -m "feat: add Postgres scene persistence"
```

---

## Task 5: Socket.io wiring for join/init/scene-update/cursor-update/leave

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Implement `server/index.js`**

Create `server/index.js`:

```js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { ensureSchema, getScene, saveScene } from "./db.js";
import { createRoomManager } from "./rooms.js";

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const SAVE_DEBOUNCE_MS = 2000;

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CORS_ORIGIN } });

const rooms = createRoomManager();
const roomScenes = new Map();
const saveTimers = new Map();

async function loadRoomScene(boardId) {
  if (!roomScenes.has(boardId)) {
    const scene = await getScene(boardId);
    roomScenes.set(boardId, scene);
  }
  return roomScenes.get(boardId);
}

function scheduleSave(boardId) {
  if (saveTimers.has(boardId)) {
    clearTimeout(saveTimers.get(boardId));
  }

  const timer = setTimeout(() => {
    saveTimers.delete(boardId);
    const scene = roomScenes.get(boardId);
    if (scene) {
      saveScene(boardId, scene).catch((err) => {
        console.error(`Failed to save board ${boardId}`, err);
      });
    }
  }, SAVE_DEBOUNCE_MS);

  saveTimers.set(boardId, timer);
}

io.on("connection", (socket) => {
  socket.on("join", async ({ boardId, name, color }) => {
    socket.join(boardId);
    socket.data.boardId = boardId;
    socket.data.identity = { name, color };
    rooms.join(boardId, socket.id, { name, color });

    const scene = await loadRoomScene(boardId);
    socket.emit("init", { scene });
  });

  socket.on("scene-update", ({ elements }) => {
    const boardId = socket.data.boardId;
    if (!boardId) return;

    const scene = roomScenes.get(boardId) || { elements: [], appState: {} };
    scene.elements = elements;
    roomScenes.set(boardId, scene);

    socket.to(boardId).emit("scene-update", { elements, socketId: socket.id });
    scheduleSave(boardId);
  });

  socket.on("cursor-update", ({ pointer, name, color }) => {
    const boardId = socket.data.boardId;
    if (!boardId) return;

    socket.to(boardId).volatile.emit("cursor-update", {
      socketId: socket.id,
      pointer,
      name,
      color
    });
  });

  socket.on("disconnect", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;

    rooms.leave(boardId, socket.id);
    socket.to(boardId).emit("collaborator-left", { socketId: socket.id });
  });
});

ensureSchema()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Realtime server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database schema", err);
    process.exit(1);
  });
```

- [ ] **Step 2: Manually verify the health endpoint**

Run (requires a reachable Postgres — use the Railway Postgres addon's connection string from Task 8, or skip this step until Task 8 if no database is available yet):

```bash
cd "c:\Users\HASSAN\App2\whiteboard\server" && DATABASE_URL="<connection string>" node index.js
```

In another terminal:

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok"}` and the server log shows `Realtime server listening on port 3001`. Stop the server with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: wire socket.io join/init/scene-update/cursor-update events"
```

---

## Task 6: Frontend socket client

**Files:**
- Create: `lib/socket.ts`

- [ ] **Step 1: Implement `lib/socket.ts`**

Create `lib/socket.ts`:

```ts
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3001";
    socket = io(url, {
      transports: ["websocket"],
      autoConnect: true
    });
  }

  return socket;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/socket.ts
git commit -m "feat: add socket.io client singleton"
```

---

## Task 7: Integrate collaboration into Whiteboard.tsx

**Files:**
- Modify: `components/Whiteboard.tsx`

- [ ] **Step 1: Remove the old scene-sharing imports and helper**

In `components/Whiteboard.tsx`, replace the imports at the top of the file (lines 1-5):

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "@excalidraw/excalidraw/index.css";
import { ensureBoardId } from "../lib/boardId";
import { getOrCreateIdentity } from "../lib/identity";
import { getSocket } from "../lib/socket";
```

Then remove the `deserializeScene` function entirely (originally lines 46-48):

```tsx
function deserializeScene(value: string) {
  return sanitizeScene(JSON.parse(decodeURIComponent(atob(value))));
}
```

Keep `sanitizeScene` — it is still used.

- [ ] **Step 2: Load `reconcileElements` alongside the dynamic Excalidraw import**

Replace the `Excalidraw` dynamic import block (originally lines 29-37):

```tsx
let reconcileElementsFn: any = null;

const Excalidraw = dynamic<any>(
  async () => {
    const mod = await import("@excalidraw/excalidraw");
    reconcileElementsFn = mod.reconcileElements;
    return mod.Excalidraw;
  },
  {
    ssr: false
  }
);
```

- [ ] **Step 3: Add the "share" icon**

In the `IconName` type (originally lines 70-87), add `"share"`:

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
  | "shapes"
  | "share"
  | "layerToBack"
  | "layerBackward"
  | "layerForward"
  | "layerToFront";
```

In `iconPaths` (originally lines 89-175), add a `share` entry (a link/share-nodes icon) right after `shapes`:

```tsx
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5 15.4 17.5" />
      <path d="M15.4 6.5 8.6 10.5" />
    </>
  ),
```

- [ ] **Step 4: Replace component state — remove URL/localStorage scene loading, add collaboration state**

Replace the component's opening state block (originally lines 220-237):

```tsx
export default function Whiteboard() {
  const [langCode, setLangCode] = useState("en");
  const initialData = useMemo(
    () =>
      sanitizeScene({
        elements: [],
        appState: { theme: "light", exportBackground: true, viewBackgroundColor: "#ffffff", collaborators: [] }
      }),
    []
  );
  const sceneRef = useRef<any>(initialData);
  const [activeTool, setActiveTool] = useState<ToolType>("selection");
  const [toolLocked, setToolLocked] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [currentStrokeColor, setCurrentStrokeColor] = useState("#1e1e1e");
  const [currentBackgroundColor, setCurrentBackgroundColor] = useState("transparent");
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(1);
  const [currentOpacity, setCurrentOpacity] = useState(100);
  const [isOffline, setIsOffline] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const excalidrawAPI = useRef<any>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const remoteUpdateRef = useRef(false);
  const sceneUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorThrottleRef = useRef(0);
  const linkCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collaboratorsRef = useRef<Map<string, any>>(new Map());
  const boardId = useMemo(() => ensureBoardId(), []);
  const identity = useMemo(() => getOrCreateIdentity(), []);
```

- [ ] **Step 5: Remove the old `?scene=`/localStorage `useEffect`, keep only the language detection**

Replace the original `useEffect` (originally lines 258-287) with:

```tsx
  useEffect(() => {
    const browserLocale = navigator.language || navigator.languages?.[0] || "en";
    setLangCode(normalizeLanguage(browserLocale));
  }, []);
```

- [ ] **Step 6: Add the collaboration `useEffect`**

Add this new `useEffect` directly after the language-detection effect from Step 5:

```tsx
  useEffect(() => {
    if (!apiReady) return;

    const socket = getSocket();
    socketRef.current = socket;

    function applyRemoteElements(elements: any[]) {
      const api = excalidrawAPI.current;
      if (!api || !reconcileElementsFn) return;

      const localElements = api.getSceneElementsIncludingDeleted();
      const appState = api.getAppState();
      const reconciled = reconcileElementsFn(localElements, elements, appState);

      remoteUpdateRef.current = true;
      api.updateScene({ elements: reconciled });
    }

    function handleInit({ scene }: any) {
      const api = excalidrawAPI.current;
      if (!api) return;

      const sanitized = sanitizeScene(scene);
      sceneRef.current = sanitized;
      remoteUpdateRef.current = true;
      api.updateScene({ elements: sanitized.elements });
    }

    function handleSceneUpdate({ elements }: any) {
      applyRemoteElements(elements);
    }

    function handleCursorUpdate({ socketId, pointer, name, color }: any) {
      const api = excalidrawAPI.current;
      if (!api) return;

      collaboratorsRef.current.set(socketId, {
        pointer,
        username: name,
        color: { background: color, stroke: color }
      });
      api.updateScene({ collaborators: new Map(collaboratorsRef.current) });
    }

    function handleCollaboratorLeft({ socketId }: any) {
      const api = excalidrawAPI.current;
      if (!api) return;

      collaboratorsRef.current.delete(socketId);
      api.updateScene({ collaborators: new Map(collaboratorsRef.current) });
    }

    function handleConnect() {
      setIsOffline(false);
      socket.emit("join", { boardId, name: identity.name, color: identity.color });
    }

    function handleDisconnect() {
      setIsOffline(true);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("init", handleInit);
    socket.on("scene-update", handleSceneUpdate);
    socket.on("cursor-update", handleCursorUpdate);
    socket.on("collaborator-left", handleCollaboratorLeft);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("init", handleInit);
      socket.off("scene-update", handleSceneUpdate);
      socket.off("cursor-update", handleCursorUpdate);
      socket.off("collaborator-left", handleCollaboratorLeft);
    };
  }, [apiReady, boardId, identity]);
```

- [ ] **Step 7: Update the `excalidrawAPI` callback to trigger the collaboration effect**

In the `<Excalidraw>` props (originally around line 513-515), change:

```tsx
            excalidrawAPI={(api: any) => {
              excalidrawAPI.current = api;
            }}
```

to:

```tsx
            excalidrawAPI={(api: any) => {
              excalidrawAPI.current = api;
              setApiReady(true);
            }}
```

- [ ] **Step 8: Replace the `onChange` handler — remove localStorage, add debounced `scene-update` emit**

Replace the `onChange` prop (originally lines 521-535):

```tsx
            onChange={(elements: any, appState: any) => {
              const scene = sanitizeScene({ elements, appState });
              sceneRef.current = scene;

              setHasSelection(Object.values(appState.selectedElementIds || {}).some(Boolean));
              setCurrentStrokeColor(appState.currentItemStrokeColor ?? "#1e1e1e");
              setCurrentBackgroundColor(appState.currentItemBackgroundColor ?? "transparent");
              setCurrentStrokeWidth(appState.currentItemStrokeWidth ?? 1);
              setCurrentOpacity(appState.currentItemOpacity ?? 100);

              if (remoteUpdateRef.current) {
                remoteUpdateRef.current = false;
                return;
              }

              if (sceneUpdateTimerRef.current) {
                clearTimeout(sceneUpdateTimerRef.current);
              }
              sceneUpdateTimerRef.current = setTimeout(() => {
                socketRef.current?.emit("scene-update", { elements });
              }, 300);
            }}
```

- [ ] **Step 9: Add `onPointerUpdate` for throttled cursor broadcasting**

Add a new prop on `<Excalidraw>`, directly after `onPointerDown`:

```tsx
            onPointerUpdate={(payload: any) => {
              const now = Date.now();
              if (now - cursorThrottleRef.current < 50) return;
              cursorThrottleRef.current = now;

              socketRef.current?.emit("cursor-update", {
                pointer: payload.pointer,
                name: identity.name,
                color: identity.color
              });
            }}
```

- [ ] **Step 10: Remove the now-unused `boardKey` reference from `<Excalidraw>`**

In the `<Excalidraw>` props, remove the `key={boardKey}` line (originally line 509) — `initialData` is now a stable `useMemo` value and the component never needs to remount.

- [ ] **Step 11: Add the share button and offline indicator to the floating toolbar**

In the `.floating-toolbar` JSX (originally lines 458-505), add a divider, share button, and status dot at the end, right after the closing `</button>` for the "shapes"/frame button:

```tsx
          <div className="toolbar-divider" />

          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?board=${boardId}`;
              navigator.clipboard.writeText(url).then(() => {
                setLinkCopied(true);
                if (linkCopiedTimerRef.current) {
                  clearTimeout(linkCopiedTimerRef.current);
                }
                linkCopiedTimerRef.current = setTimeout(() => setLinkCopied(false), 2000);
              });
            }}
            title="Copy collaboration link"
            aria-label="Copy collaboration link"
          >
            <ToolIcon name="share" />
          </button>

          <span className={isOffline ? "status-dot offline" : "status-dot online"} title={isOffline ? "Offline" : "Connected"} />

          {linkCopied ? <span className="link-toast">Link copied</span> : null}
```

- [ ] **Step 12: Add styles for the status dot and link toast**

In the `<style jsx>` block (originally lines 540-719), add after the `.toolbar-divider` rule:

```css
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin: 0 6px;
          flex-shrink: 0;
        }

        .status-dot.online {
          background: #2f9e44;
        }

        .status-dot.offline {
          background: #e03131;
        }

        .link-toast {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          padding: 4px 10px;
          font-size: 0.8rem;
          color: #ffffff;
          background: #1e1e1e;
          border-radius: 6px;
          white-space: nowrap;
        }
```

Also add `position: relative;` to the existing `.floating-toolbar` rule so `.link-toast` positions relative to the toolbar.

- [ ] **Step 13: Run a manual smoke test in two browser tabs**

Run: `cd "c:\Users\HASSAN\App2\whiteboard" && npm run dev` (with `NEXT_PUBLIC_REALTIME_URL` left unset so it defaults to `http://localhost:3001`), and in a second terminal start the realtime server from Task 5/8 on port 3001.

1. Open `http://localhost:3000` in one browser tab. Confirm the URL gains a `?board=<id>` param.
2. Copy that URL into a second tab.
3. Draw a shape in tab 1 — confirm it appears in tab 2 within ~1 second.
4. Move the mouse in tab 1 over the canvas — confirm a labeled, colored cursor appears in tab 2.
5. Stop the realtime server — confirm the status dot turns red (offline) in both tabs and drawing still works locally.
6. Restart the realtime server — confirm the status dot turns green again and both tabs reconcile to a consistent scene.
7. Click the share icon — confirm "Link copied" appears and the clipboard contains the `?board=<id>` URL.

- [ ] **Step 14: Run the existing unit tests to confirm nothing broke**

Run: `cd "c:\Users\HASSAN\App2\whiteboard" && npm test`
Expected: PASS — `boardId` and `identity` tests still green.

- [ ] **Step 15: Commit**

```bash
git add components/Whiteboard.tsx
git commit -m "feat: wire live collaboration into Whiteboard (share link, remote cursors, scene sync)"
```

---

## Task 8: Deploy the realtime service and Postgres addon on Railway

**Files:** none (Railway dashboard configuration)

- [ ] **Step 1: Add a Postgres addon to the Railway project**

In the Railway dashboard, open the existing project (the one containing the `whiteboard` service) and click "New" → "Database" → "Add PostgreSQL". Railway provisions it and exposes a `DATABASE_URL` variable on that addon.

- [ ] **Step 2: Add a new service for the realtime server**

In the same Railway project, click "New" → "GitHub Repo" and select the same `hassanse10/whiteboard` repo again (Railway allows multiple services from one repo). After it's created:

1. Open the new service's Settings.
2. Set "Root Directory" to `server`.
3. Set the Start Command to `npm start` (Railway will run `npm install` automatically via Nixpacks since `server/package.json` exists).

- [ ] **Step 3: Configure environment variables on the realtime service**

In the realtime service's Variables tab, add:

- `DATABASE_URL` — reference the Postgres addon's connection string (Railway lets you select "Add Reference" → the Postgres service → `DATABASE_URL`)
- `CORS_ORIGIN` — the deployed frontend URL, e.g. `https://whiteboard-production.up.railway.app` (use the actual Railway-assigned domain for the `whiteboard` service)

- [ ] **Step 4: Configure the frontend to point at the realtime service**

In the `whiteboard` (Next.js) service's Variables tab, add:

- `NEXT_PUBLIC_REALTIME_URL` — the realtime service's public URL, e.g. `https://whiteboard-realtime-production.up.railway.app`

Trigger a redeploy of the `whiteboard` service so the new env var is baked into the build (Next.js inlines `NEXT_PUBLIC_*` vars at build time).

- [ ] **Step 5: Verify the deployed app**

Open the deployed frontend URL in two browser tabs and repeat the smoke test from Task 7 Step 13 (share link, live drawing sync, remote cursor, offline indicator) against the production URLs.

- [ ] **Step 6: Commit deployment notes**

No code changes are required for this task, so there is nothing to commit. If any code changes were needed to make the deploy succeed (e.g. a `server/railway.json` or build tweak), commit them with:

```bash
git add server/
git commit -m "chore: configure realtime service for Railway deployment"
```

---

## Self-Review

**Spec coverage:**
- Architecture (frontend + realtime service + Postgres, all on Railway): Tasks 3-8 ✓
- Data model (`boards` table): Task 4 ✓
- Board identity & URL (`?board=<id>`, generated via `history.replaceState`, removal of `?scene=`/localStorage): Tasks 1, 7 (Steps 1, 5) ✓
- Random identity (name + color, sessionStorage): Task 2 ✓
- Realtime sync protocol (`join`/`init`/`scene-update`/`cursor-update`/`leave`/`collaborator-left`): Task 5 ✓
- Reconciliation via `reconcileElements`: Task 7 (Steps 2, 6) ✓
- Cursor rendering via `collaborators` prop: Task 7 (Step 6, `handleCursorUpdate`/`handleCollaboratorLeft`) ✓
- UI: share icon + "Link copied" toast, no active-users list: Task 7 (Steps 3, 11, 12) ✓
- Offline/fallback behavior (status dot, local edits still work, reconnection re-joins and re-syncs): Task 7 (Steps 6, 11, 12, 13) ✓
- Out-of-scope items (auth, active-users list, board management UI) are correctly not implemented.

**Placeholder scan:** No "TBD"/"TODO"/"add error handling" placeholders — all steps include complete code or exact commands.

**Type consistency:** `boardId`/`identity` from `lib/boardId.ts`/`lib/identity.ts` are used with matching names (`ensureBoardId`, `getOrCreateIdentity`, `Identity { name, color }`) across Tasks 1, 2, and 7. Socket event names and payload shapes (`join: {boardId, name, color}`, `init: {scene}`, `scene-update: {elements}`, `cursor-update: {pointer, name, color}` / `{socketId, pointer, name, color}`, `collaborator-left: {socketId}`) match between `server/index.js` (Task 5) and `components/Whiteboard.tsx` (Task 7).
