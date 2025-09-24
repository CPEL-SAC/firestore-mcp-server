# Firestore MCP Server

An MCP (Model Context Protocol) server that exposes a Firestore database as a set of read-only tools. The project ships three transports (Streamable HTTP, SSE, STDIO) so it can run locally, on traditional servers, or in serverless environments such as Vercel.

## Highlights
- Firestore-aware tools to list collections, inspect sampled schemas, and run filtered/aggregated queries
- Safe serialization for Firestore primitives (timestamps, GeoPoint, references) to avoid JSON errors
- Clean MCP server bootstrap shared across STDIO, Streamable HTTP, and SSE transports
- Ready-to-use scripts for development (`npm run dev*`) and production (`npm start`, `npm run start:*`)
- Works with Codex CLI, Claude CLI, Gemini CLI, or any MCP-compatible client

## Prerequisites
1. **Node.js 18+** (or the runtime required by your hosting provider)
2. **Firebase service account JSON** with Firestore access
3. Environment variable `FIREBASE_SERVICE_ACCOUNT` containing the JSON string (single line or escaped)

`.env` example:
```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project",...}'
PORT=3000
```

## Install & Run
```bash
npm install

# Streamable HTTP (recommended for remote/serverless)
npm run dev        # hot reload via tsx
npm start          # production build (uses dist/mcp-streamable-server.js)

# SSE HTTP (legacy long-lived connections)
npm run dev:sse
npm run start:sse

# STDIO (local CLI integrations)
npm run dev:stdio
npm run start:stdio

# Build TypeScript -> dist/
npm run build
```

## Transport Modes
### Streamable HTTP (recommended)
- File: `src/mcp-streamable-server.ts`
- Endpoints:
  - `GET /health` – readiness probe
  - `GET|POST|DELETE /mcp` – handled by `StreamableHTTPServerTransport`
- Stateless by default and deployable to Vercel, Netlify, Cloudflare, etc.

### Server-Sent Events (legacy)
- File: `src/mcp-http-server.ts`
- Workflow:
  - `GET /mcp` opens the SSE stream and returns the session id
  - `POST /mcp?sessionId=...` sends JSON-RPC messages
  - `DELETE /mcp?sessionId=...` closes the session
- Suitable for platforms such as Railway or Render that keep connections open.

### STDIO (local only)
- File: `src/index.ts`
- Exposes the same toolset over standard I/O; ideal for local CLI usage or tests.

## MCP Tools
| Tool | Purpose | Notes |
| ---- | ------- | ----- |
| `list_collections` | Lists all top-level collections. | Returns a newline-separated list. |
| `inspect_collection_schema` | Samples documents (default 10) and reports field types and examples. | Handles nested objects; Firestore special types are serialized safely. |
| `query_firestore` | Runs filters, ordering, limits, and aggregations. | Aggregations (`sum`, `avg`) ignore non-numeric entries and the response reports ignored counts.

Example `query_firestore` call:
```json
{
  "name": "query_firestore",
  "arguments": {
    "collectionPath": "users",
    "filters": [
      {"field": "age", "operator": ">=", "value": 18}
    ],
    "orderBy": [
      {"field": "createdAt", "direction": "desc"}
    ],
    "limit": 10,
    "aggregation": {
      "count": true,
      "sum": "points",
      "avg": "score"
    }
  }
}
```

## Connecting MCP Clients
### Codex CLI (STDIO)
```json
{
  "mcpServers": {
    "firestore": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "FIREBASE_SERVICE_ACCOUNT": "<service-account-json>"
      }
    }
  }
}
```

### Codex/Claude/Gemini CLI (remote Streamable HTTP)
Point the client at the deployed endpoint and set `transport` to `streamable-http`:
```json
{
  "mcpServers": {
    "firestore": {
      "url": "https://your-app.example.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Notes
- The server is read-only; mutations must be implemented separately if required.
- `FIREBASE_SERVICE_ACCOUNT` must remain private—configure it in your hosting dashboard or secrets manager.

## Deployment
### Vercel (Streamable HTTP)
1. `npm i -g vercel`
2. `vercel login`
3. `vercel env add FIREBASE_SERVICE_ACCOUNT`
4. `npm run build`
5. `vercel --prod`

### Railway/Render (SSE or Streamable)
- Build command: `npm run build`
- Start command: choose `npm start` (Streamable) or `npm run start:sse`
- Environment: set `FIREBASE_SERVICE_ACCOUNT`

## API Summary
- `GET /` – service metadata
- `GET /health` – health check
- Streamable HTTP: `GET|POST|DELETE /mcp`
- SSE: `GET /mcp`, `POST /mcp?sessionId=...`, `DELETE /mcp?sessionId=...`

## Troubleshooting
- **Missing credentials**: ensure `FIREBASE_SERVICE_ACCOUNT` is defined and valid JSON.
- **Non-numeric aggregation results**: the response indicates how many documents were ignored.
- **Session errors**: for SSE include the `sessionId` query parameter; for Streamable HTTP ensure clients send the `Mcp-Session-Id` header when required.
- **CORS**: open CORS is enabled by default; tighten if you control the client origin.

## License
MIT – see `LICENSE` for details.
