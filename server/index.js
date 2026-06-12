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
