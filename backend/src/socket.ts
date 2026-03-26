import type { Server as SocketServer } from "socket.io";

let ioRef: SocketServer | null = null;

export function setIoInstance(io: SocketServer) {
  ioRef = io;
}

export function getIoInstance() {
  return ioRef;
}
