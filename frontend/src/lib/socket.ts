import { io } from "socket.io-client";

const SOCKET_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export const socket = io(SOCKET_BASE, {
  withCredentials: true,
  autoConnect: false
});
