import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { registerHandlers } from "./room/handlers.js";

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "http://127.0.0.1:5500,http://localhost:5500"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

app.get("/health", (_, res) => res.json({ ok: true }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
});

io.on("connection", (socket) => registerHandlers(io, socket));

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log("Allowed origins:", ALLOWED_ORIGINS);
});
