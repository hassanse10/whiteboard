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

});
