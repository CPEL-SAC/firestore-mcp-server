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

class FirestoreStreamableHttpServer {
  private readonly app = express();
  private readonly transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  private readonly server = createMcpServer(new FirestoreToolExecutor(getFirestore()));

  constructor() {
    this.transport.onerror = (error) => {
      console.error("Streamable HTTP transport error:", error);
    };

    this.transport.onclose = () => {
      console.warn("Streamable HTTP transport closed");
    };

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

    this.app.use(express.raw({ type: "application/octet-stream", limit: "4mb" }));
    this.app.use(express.json({ limit: "4mb" }));
  }

  private configureRoutes(): void {
    this.app.get("/health", (_req, res) => {
      res.json({
        status: "healthy",
        service: "firestore-mcp-server",
        transport: "streamable-http",
        timestamp: new Date().toISOString(),
      });
    });

    this.app.options("/mcp", (_req, res) => {
      res.sendStatus(204);
    });

    const handler = (req: Request, res: Response) => {
      void this.transport.handleRequest(req, res, req.body).catch((error) => {
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
      });
    };

    this.app.post("/mcp", handler);
    this.app.get("/mcp", handler);
    this.app.delete("/mcp", handler);

    this.app.get("/", (_req, res) => {
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
  }

  async start(): Promise<void> {
    const port = Number(process.env.PORT ?? 3000);

    await this.server.connect(this.transport);

    await new Promise<void>((resolve) => {
      this.app.listen(port, () => {
        console.log(`Firestore MCP Server (Streamable HTTP) running on port ${port}`);
        console.log(`Health endpoint: http://localhost:${port}/health`);
        console.log(`MCP endpoint: http://localhost:${port}/mcp`);
        resolve();
      });
    });
  }
}

async function main() {
  const server = new FirestoreStreamableHttpServer();
  await server.start();
}

main().catch((error) => {
  console.error("Failed to start Streamable HTTP server:", error);
  process.exitCode = 1;
});
