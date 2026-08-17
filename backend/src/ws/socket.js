import jwt from "jsonwebtoken";

export function attachSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Missing auth token"));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    // Client joins a room per run to receive that run's step updates live.
    socket.on("run:subscribe", (runId) => {
      socket.join(`run:${runId}`);
    });
    socket.on("run:unsubscribe", (runId) => {
      socket.leave(`run:${runId}`);
    });
  });
}
