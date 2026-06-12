import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { ensureSchema, getScene, saveScene, deleteInactiveBoards } from "./db.js";
import { createRoomManager } from "./rooms.js";

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const SAVE_DEBOUNCE_MS = 2000;
const INACTIVE_BOARD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

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

function broadcastPresence(boardId) {
  io.to(boardId).emit("presence", { users: rooms.getUsers(boardId) });
}

io.on("connection", (socket) => {
  socket.on("join", async ({ boardId, name, color }) => {
    if (!boardId || typeof boardId !== "string") return;

    socket.join(boardId);
    socket.data.boardId = boardId;
    socket.data.identity = { name, color };
    rooms.join(boardId, socket.id, { name, color });
    broadcastPresence(boardId);

    try {
      const scene = await loadRoomScene(boardId);
      socket.emit("init", { scene });
    } catch (err) {
      console.error(`Failed to load scene for board ${boardId}`, err);
    }
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
    broadcastPresence(boardId);
  });
});

function cleanupInactiveBoards() {
  deleteInactiveBoards(INACTIVE_BOARD_TTL_MS)
    .then((count) => {
      if (count > 0) {
        console.log(`Deleted ${count} inactive board(s)`);
      }
    })
    .catch((err) => {
      console.error("Failed to delete inactive boards", err);
    });
}

ensureSchema()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Realtime server listening on port ${PORT}`);
    });
    cleanupInactiveBoards();
    setInterval(cleanupInactiveBoards, CLEANUP_INTERVAL_MS);
  })
  .catch((err) => {
    console.error("Failed to initialize database schema", err);
    process.exit(1);
  });
