import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { FIRESTORE_TOOL_DEFINITIONS, FirestoreToolExecutor } from "./firestore-tools.js";

export function createMcpServer(executor: FirestoreToolExecutor): Server {
  const server = new Server(
    {
      name: "firestore-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: FIRESTORE_TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    executor.execute(request.params.name, request.params.arguments ?? {}),
  );

  return server;
}
