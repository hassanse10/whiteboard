# Live Collaboration Design

## Goal

Allow a whiteboard to be shared via link with other users, who can draw on the
same board in real time. Each connected user is identified by a randomly
generated name and cursor color, shown next to their cursor as they move/draw.

## Architecture

Three pieces, all hosted on Railway within the same project:

1. **Frontend** — existing Next.js app (`whiteboard` service). Gains a
   `socket.io-client` connection to the realtime service.
2. **Realtime service** (new) — small Node.js service running Express +
   `socket.io`. Acts as the relay between connected clients for a given board,
   and as the persistence layer.
3. **Postgres** (new Railway addon) — stores board state.

This mirrors the architecture of Excalidraw's own open-source collab server
(`excalidraw-room`): clients broadcast scene diffs through a socket.io room
keyed by board ID, and the server persists periodically. This was chosen over
a CRDT-based approach (Yjs) because per-element "last write wins" with
Excalidraw's built-in `reconcileElements` is sufficient for a whiteboard and
far simpler to implement and operate. A hosted realtime provider (Liveblocks,
Supabase Realtime) was ruled out because it introduces an external dependency
and account/cost outside of Railway, which the project is deliberately
consolidated on.

## Data model (Postgres)

```sql
create table boards (
  id text primary key,
  scene_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

- `id`: short random board ID (nanoid, ~10 chars, URL-safe)
- `scene_data`: `{ elements: [...], appState: {...} }` — same shape already
  produced by `sanitizeScene()` in the frontend
- Row is created on first save for a board (upsert)

## Board identity & URL

- Visiting `/` with no `?board=` param:
  - Frontend generates a new short random board ID
  - URL is updated to `/?board=<id>` via `history.replaceState` (no reload)
- Visiting `/?board=<id>`:
  - Frontend joins socket.io room `<id>`
  - Realtime service loads `scene_data` for that board from Postgres (or
    empty scene if the board doesn't exist yet) and sends it to the joining
    client
- The existing scene-in-URL share mechanism (`serializeScene`/`deserializeScene`,
  `?scene=` param) is removed entirely and replaced by the board-ID link.
- `localStorage` autosave (`whiteboard-scene` key) is removed — Postgres is
  now the source of truth for board content. (If the realtime service is
  unreachable, see "Offline / fallback behavior" below.)

## Random identity (name + color)

- On first connection in a tab, the client generates:
  - A display name: `"<Adjective> <Animal> <Number>"` (e.g. "Quick Fox 42"),
    from small local word lists plus a random 1-99 suffix
  - A cursor color: random from a small fixed palette of distinguishable
    colors
- Both are stored in `sessionStorage` so they remain stable for that tab
  across reconnects/navigation, but a new tab/session gets a new identity
- Sent to the realtime service on connect as part of the join payload

## Realtime sync protocol

Socket.io events, all scoped to the board's room:

- **`join`** (client → server): `{ boardId, name, color }`
  - Server adds the socket to room `boardId`, replies with `init`
- **`init`** (server → client): `{ scene: { elements, appState } }`
  - The persisted scene for this board (empty if new)
- **`scene-update`** (client → server, debounced ~300ms on local changes):
  `{ elements }`
  - Server broadcasts `scene-update` to all other sockets in the room
  - Server also schedules a debounced (~2s) write of the merged scene to
    Postgres
- **`cursor-update`** (client → server, volatile emit, throttled ~50ms):
  `{ pointer: { x, y }, name, color }`
  - Server broadcasts to other sockets in the room via volatile emit
    (no persistence, drops are fine)
- **`leave`** / disconnect: server removes the collaborator from the room's
  presence list and broadcasts a `collaborator-left` event so others can
  remove that cursor

### Reconciliation

Incoming `scene-update` elements are merged into the local scene using
Excalidraw's built-in `reconcileElements(localElements, remoteElements,
localAppState)`, which resolves conflicts per-element via version/seed
comparison — this is the same mechanism Excalidraw's own collab feature uses.

### Cursor rendering

Remote cursors are rendered via Excalidraw's existing `collaborators` prop
(passed to `updateScene` / `excalidrawAPI`), keyed by socket ID, each with
`{ username, pointer, color }`. No custom cursor UI needs to be built —
Excalidraw already renders labeled cursors from this prop.

## UI changes

- **Share icon**: added to the floating top-center toolbar (alongside the
  existing tool icons). Clicking it copies the current page URL
  (`/?board=<id>`) to the clipboard and shows a brief "Link copied" toast.
- No persistent "active users" list — presence is conveyed only via visible
  cursors, per the agreed scope.

## Offline / fallback behavior

- If the socket connection to the realtime service fails or drops:
  - The board remains usable in local-only mode (edits apply locally via
    Excalidraw as normal)
  - A small, unobtrusive status indicator (e.g. a dot near the share icon)
    shows "Offline" / "Reconnecting"
  - `socket.io-client`'s built-in reconnection (exponential backoff) is used;
    on reconnect, the client re-sends `join` and receives a fresh `init`,
    then reconciles local changes made while offline against the server's
    current scene

## Out of scope (explicitly deferred)

- Authentication / per-user accounts (random names only)
- Active-users list / avatar stack
- Board listing/management UI (boards are only accessible via their link)
- Conflict-free offline editing guarantees beyond `reconcileElements`'
  per-element resolution
