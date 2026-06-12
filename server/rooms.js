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
