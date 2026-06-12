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
