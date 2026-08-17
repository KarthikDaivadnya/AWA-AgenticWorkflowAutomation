import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

import "./db/init.js"; // ensures tables exist on boot
import authRoutes from "./routes/auth.js";
import workflowRoutes from "./routes/workflows.js";
import runRoutes from "./routes/runs.js";
import { attachSocketHandlers } from "./ws/socket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", storageMode: process.env.STORAGE_MODE || "local" });
});

app.use("/api/auth", authRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/runs", runRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || "*" },
});
attachSocketHandlers(io);
app.set("io", io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Agentic Workflow Automation API listening on port ${PORT}`);
  console.log(`Storage mode: ${process.env.STORAGE_MODE || "local"}`);
});
