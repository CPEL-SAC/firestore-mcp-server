#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./lib/mcp-server.js";
import { getFirestore } from "./lib/firestore-client.js";
import { FirestoreToolExecutor } from "./lib/firestore-tools.js";

const app = express();
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});
const server = createMcpServer(new FirestoreToolExecutor(getFirestore()));
const serverReady = server.connect(transport).catch((error) => {
  console.error("Failed to initialize MCP server:", error);
  throw error;
});

transport.onerror = (error) => {
  console.error("Streamable HTTP transport error:", error);
};

transport.onclose = () => {
  console.warn("Streamable HTTP transport closed");
};

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id"],
  }),
);

app.use(express.raw({ type: "application/octet-stream", limit: "4mb" }));
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "firestore-mcp-server",
    transport: "streamable-http",
    timestamp: new Date().toISOString(),
  });
});

app.options("/mcp", (_req, res) => {
  res.sendStatus(204);
});

async function handleMcpRequest(req: Request, res: Response) {
  try {
    await serverReady;
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling Streamable HTTP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
}

app.post("/mcp", (req, res) => {
  void handleMcpRequest(req, res);
});

app.get("/mcp", (req, res) => {
  void handleMcpRequest(req, res);
});

app.delete("/mcp", (req, res) => {
  void handleMcpRequest(req, res);
});

app.get("/", (_req, res) => {
  res.json({
    name: "Firestore MCP Server",
    status: "operational",
    transport: "streamable-http",
    endpoints: {
      health: "/health",
      mcp: "/mcp",
    },
  });
});

async function startLocalServer() {
  const port = Number(process.env.PORT ?? 3000);
  await serverReady;

  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Firestore MCP Server (Streamable HTTP) running on port ${port}`);
      console.log(`Health endpoint: http://localhost:${port}/health`);
      console.log(`MCP endpoint: http://localhost:${port}/mcp`);
      resolve();
    });
  });
}

if (!process.env.VERCEL) {
  startLocalServer().catch((error) => {
    console.error("Failed to start Streamable HTTP server:", error);
    process.exitCode = 1;
  });
}

export default app;
