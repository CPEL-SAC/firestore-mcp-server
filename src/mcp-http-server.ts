#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./lib/mcp-server.js";
import { getFirestore } from "./lib/firestore-client.js";
import { FirestoreToolExecutor } from "./lib/firestore-tools.js";

type SessionEntry = {
  transport: SSEServerTransport;
  server: Server;
};

class FirestoreSseServer {
  private readonly app = express();
  private readonly executor = new FirestoreToolExecutor(getFirestore());
  private readonly sessions = new Map<string, SessionEntry>();

  constructor() {
    this.configureMiddleware();
    this.configureRoutes();
  }

  private configureMiddleware(): void {
    this.app.use(
      cors({
        origin: "*",
        methods: ["GET", "POST", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id"],
      }),
    );

    this.app.use(express.json({ limit: "4mb" }));
  }

  private configureRoutes(): void {
    this.app.get("/health", (_req, res) => {
      res.json({
        status: "healthy",
        service: "firestore-mcp-server",
        transport: "sse",
        timestamp: new Date().toISOString(),
      });
    });

    this.app.options("/mcp", (_req, res) => {
      res.sendStatus(204);
    });

    this.app.get("/mcp", (req, res) => {
      const transport = new SSEServerTransport("/mcp", res);
      transport.onerror = (error) => {
        console.error("SSE transport error:", error);
      };

      const server = createMcpServer(this.executor);

      transport.onclose = () => {
        this.sessions.delete(transport.sessionId);
      };

      server
        .connect(transport)
        .then(() => {
          this.sessions.set(transport.sessionId, { transport, server });
        })
        .catch((error) => {
          console.error("Failed to establish SSE session:", error);
          if (!res.headersSent) {
            res.status(500).json({
              error: "Failed to establish SSE session",
            });
          }
        });
    });

    this.app.post("/mcp", (req, res) => {
      const sessionId = this.getSessionId(req);
      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId" });
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: "Unknown sessionId" });
        return;
      }

      session.transport
        .handlePostMessage(req, res, req.body)
        .catch((error) => {
          console.error("Error handling SSE POST message:", error);
          if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
          }
        });
    });

    this.app.delete("/mcp", async (req, res) => {
      const sessionId = this.getSessionId(req);
      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId" });
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: "Unknown sessionId" });
        return;
      }

      this.sessions.delete(sessionId);
      await session.transport.close().catch((error) => {
        console.error("Error closing SSE session:", error);
      });

      res.sendStatus(204);
    });

    this.app.get("/", (_req, res) => {
      res.json({
        name: "Firestore MCP Server",
        status: "operational",
        transport: "sse",
        endpoints: {
          health: "/health",
          mcp: "/mcp",
        },
      });
    });
  }

  private getSessionId(req: Request): string | undefined {
    const headerValue = req.header("mcp-session-id");
    if (headerValue && headerValue.trim() !== "") {
      return headerValue.trim();
    }

    const queryValue = req.query["sessionId"];
    if (typeof queryValue === "string" && queryValue.trim() !== "") {
      return queryValue.trim();
    }

    if (Array.isArray(queryValue) && queryValue.length > 0) {
      const first = queryValue[0];
      if (typeof first === "string" && first.trim() !== "") {
        return first.trim();
      }
    }

    return undefined;
  }

  async start(): Promise<void> {
    const port = Number(process.env.PORT ?? 3000);

    await new Promise<void>((resolve) => {
      this.app.listen(port, () => {
        console.log(`Firestore MCP Server (SSE) running on port ${port}`);
        console.log(`Health endpoint: http://localhost:${port}/health`);
        console.log(`MCP endpoint: http://localhost:${port}/mcp`);
        resolve();
      });
    });
  }
}

async function main() {
  const server = new FirestoreSseServer();
  await server.start();
}

main().catch((error) => {
  console.error("Failed to start SSE server:", error);
  process.exitCode = 1;
});
