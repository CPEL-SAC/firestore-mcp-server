#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./lib/mcp-server.js";
import { getFirestore } from "./lib/firestore-client.js";
import { FirestoreToolExecutor } from "./lib/firestore-tools.js";

async function main() {
  const firestore = getFirestore();
  const executor = new FirestoreToolExecutor(firestore);
  const server = createMcpServer(executor);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("Firestore MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start STDIO MCP server:", error);
  process.exitCode = 1;
});
