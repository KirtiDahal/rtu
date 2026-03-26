import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./config.js";
import { setIoInstance } from "./socket.js";

const app = createApp();
const server = createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: env.FRONTEND_ORIGIN,
    credentials: true
  }
});

setIoInstance(io);

io.on("connection", (socket) => {
  socket.on("join-channel", (channelId: string) => {
    if (typeof channelId === "string" && channelId.length > 0) {
      socket.join(channelId);
    }
  });
});

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`RTU backend running on http://localhost:${env.PORT}`);
});
