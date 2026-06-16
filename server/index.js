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
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN },
  // Default 1MB is too small for image files sent as base64 dataURLs.
  maxHttpBufferSize: 15 * 1024 * 1024
});

const rooms = createRoomManager();
const roomScenes = new Map();
const saveTimers = new Map();
const roomPresenters = new Map();
const roomTimers = new Map();

function defaultTimer() {
  return { duration: 300, remaining: 300, startedAt: 0, status: "idle", setBy: "" };
}

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
    broadcastCallParticipants(boardId);

    try {
      const scene = await loadRoomScene(boardId);
      // Omit file data here - clients fetch images on demand via "request-files"
      // once the corresponding elements are visible, instead of bulk-loading them.
      const { files, ...sceneWithoutFiles } = scene;
      socket.emit("init", { scene: sceneWithoutFiles });
    } catch (err) {
      console.error(`Failed to load scene for board ${boardId}`, err);
    }

    socket.emit("presenter-update", { presenter: roomPresenters.get(boardId) || null });
    socket.emit("timer-sync", roomTimers.get(boardId) || defaultTimer());
  });

  socket.on("timer-set", ({ duration, name }) => {
    const boardId = socket.data.boardId;
    if (!boardId || typeof duration !== "number" || duration <= 0) return;
    const timer = { duration, remaining: duration, startedAt: 0, status: "idle", setBy: name || "" };
    roomTimers.set(boardId, timer);
    io.to(boardId).emit("timer-sync", timer);
  });

  socket.on("timer-start", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    const timer = roomTimers.get(boardId) || defaultTimer();
    if (timer.status === "finished" || timer.remaining <= 0) return;
    timer.startedAt = Date.now();
    timer.status = "running";
    roomTimers.set(boardId, timer);
    io.to(boardId).emit("timer-sync", timer);
  });

  socket.on("timer-pause", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    const timer = roomTimers.get(boardId);
    if (!timer || timer.status !== "running") return;
    const elapsed = (Date.now() - timer.startedAt) / 1000;
    timer.remaining = Math.max(0, timer.remaining - elapsed);
    timer.startedAt = 0;
    timer.status = "paused";
    roomTimers.set(boardId, timer);
    io.to(boardId).emit("timer-sync", timer);
  });

  socket.on("timer-reset", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    const timer = roomTimers.get(boardId) || defaultTimer();
    timer.remaining = timer.duration;
    timer.startedAt = 0;
    timer.status = "idle";
    roomTimers.set(boardId, timer);
    io.to(boardId).emit("timer-sync", timer);
  });

  socket.on("timer-finish", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    const timer = roomTimers.get(boardId);
    if (!timer || timer.status !== "running") return;
    timer.remaining = 0;
    timer.startedAt = 0;
    timer.status = "finished";
    roomTimers.set(boardId, timer);
    io.to(boardId).emit("timer-sync", timer);
  });

  socket.on("scene-update", ({ elements }) => {
    const boardId = socket.data.boardId;
    if (!boardId || !Array.isArray(elements)) return;

    const scene = roomScenes.get(boardId) || { elements: [], appState: {} };
    const byId = new Map(scene.elements.map((element) => [element.id, element]));

    for (const element of elements) {
      const existing = byId.get(element.id);
      if (!existing || (element.version ?? 0) >= (existing.version ?? 0)) {
        byId.set(element.id, element);
      }
    }

    scene.elements = Array.from(byId.values());
    roomScenes.set(boardId, scene);

    socket.to(boardId).emit("scene-update", { elements, socketId: socket.id });
    scheduleSave(boardId);
  });

  socket.on("file-upload", ({ files }) => {
    const boardId = socket.data.boardId;
    if (!boardId || !files || typeof files !== "object") return;

    const scene = roomScenes.get(boardId) || { elements: [], appState: {} };
    scene.files = { ...(scene.files || {}), ...files };
    roomScenes.set(boardId, scene);

    socket.to(boardId).emit("file-data", { files });
    scheduleSave(boardId);
  });

  socket.on("request-files", ({ fileIds }) => {
    const boardId = socket.data.boardId;
    if (!boardId || !Array.isArray(fileIds)) return;

    const scene = roomScenes.get(boardId);
    const available = scene?.files || {};
    const files = {};
    for (const fileId of fileIds) {
      if (available[fileId]) {
        files[fileId] = available[fileId];
      }
    }

    if (Object.keys(files).length > 0) {
      socket.emit("file-data", { files });
    }
  });

  socket.on("presenter-start", ({ name }) => {
    const boardId = socket.data.boardId;
    if (!boardId) return;

    const presenter = { socketId: socket.id, name };
    roomPresenters.set(boardId, presenter);
    io.to(boardId).emit("presenter-update", { presenter });
  });

  socket.on("presenter-stop", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;

    if (roomPresenters.get(boardId)?.socketId === socket.id) {
      roomPresenters.delete(boardId);
      io.to(boardId).emit("presenter-update", { presenter: null });
    }
  });

  socket.on("presenter-section", ({ id, name, index }) => {
    const boardId = socket.data.boardId;
    if (!boardId) return;

    if (roomPresenters.get(boardId)?.socketId !== socket.id) return;
    socket.to(boardId).emit("presenter-section", { id, name, index });
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

  socket.on("call-join", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;

    const callRoom = callRoomName(boardId);
    const existingSocketIds = io.sockets.adapter.rooms.get(callRoom);
    const peers = [];
    if (existingSocketIds) {
      for (const socketId of existingSocketIds) {
        const peerSocket = io.sockets.sockets.get(socketId);
        peers.push({ socketId, ...(peerSocket?.data.identity || {}) });
      }
    }

    socket.join(callRoom);
    socket.emit("call-peers", { peers });
    socket.to(callRoom).emit("call-peer-joined", { socketId: socket.id, ...(socket.data.identity || {}) });
    broadcastCallParticipants(boardId);
  });

  socket.on("call-leave", () => {
    leaveCallRoom(socket);
  });

  socket.on("call-signal", ({ to, signal }) => {
    if (!to || typeof to !== "string") return;
    io.to(to).emit("call-signal", { from: socket.id, signal });
  });

  socket.on("disconnecting", () => {
    leaveCallRoom(socket);
  });

  socket.on("disconnect", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;

    rooms.leave(boardId, socket.id);
    socket.to(boardId).emit("collaborator-left", { socketId: socket.id });
    broadcastPresence(boardId);

    if (roomPresenters.get(boardId)?.socketId === socket.id) {
      roomPresenters.delete(boardId);
      socket.to(boardId).emit("presenter-update", { presenter: null });
    }
  });
});

function callRoomName(boardId) {
  return `${boardId}:call`;
}

function getCallParticipants(boardId) {
  const callRoom = callRoomName(boardId);
  const socketIds = io.sockets.adapter.rooms.get(callRoom);
  const participants = [];
  if (socketIds) {
    for (const socketId of socketIds) {
      const peerSocket = io.sockets.sockets.get(socketId);
      participants.push({ socketId, ...(peerSocket?.data.identity || {}) });
    }
  }
  return participants;
}

function broadcastCallParticipants(boardId) {
  io.to(boardId).emit("call-participants", { participants: getCallParticipants(boardId) });
}

function leaveCallRoom(socket) {
  const boardId = socket.data.boardId;
  if (!boardId) return;

  const callRoom = callRoomName(boardId);
  if (!socket.rooms.has(callRoom)) return;

  socket.leave(callRoom);
  socket.to(callRoom).emit("call-peer-left", { socketId: socket.id });
  broadcastCallParticipants(boardId);
}

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
