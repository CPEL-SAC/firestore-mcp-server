# Firestore MCP Server

A Model Context Protocol (MCP) server for querying Firestore databases, with support for both legacy SSE transport and modern Streamable HTTP transport (Vercel compatible).

## Features

- 🔥 **Firestore Integration**: Query collections, inspect schemas, and run aggregations
- 📡 **Multiple Transport Options**: SSE (legacy) and Streamable HTTP (modern)
- ☁️ **Vercel Compatible**: Ready for serverless deployment  
- 🚀 **Express.js Based**: RESTful API with health checks
- 🔒 **Secure**: Server-side authentication only

## Quick Start

### Prerequisites

1. **Firebase Service Account**: Get your service account JSON from Firebase Console
2. **Environment Variable**: Set `FIREBASE_SERVICE_ACCOUNT` with the complete JSON

### Installation & Development

```bash
# Install dependencies
npm install

# Development (Streamable HTTP - Vercel compatible)
npm run dev

# Development (SSE - Traditional)
npm run dev:sse

# Development (STDIO - Local only)
npm run dev:stdio

# Build
npm run build

# Production
npm start
```

### Environment Setup

```bash
# .env file
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project",...}'
PORT=3000
```

## Transport Modes

### 1. **Streamable HTTP** (Default - Vercel Compatible)
- **File**: `src/mcp-streamable-server.ts`
- **Use Case**: Serverless deployment (Vercel, Netlify, etc.)
- **Endpoints**: 
  - `POST /mcp` - JSON-RPC messages
  - `GET /mcp` - SSE streams (optional)
  - `DELETE /mcp` - Session termination
- **Benefits**: Stateless, scalable, works with serverless

### 2. **SSE Transport** (Legacy)
- **File**: `src/mcp-http-server.ts` 
- **Use Case**: Traditional servers (Railway, Render, etc.)
- **Endpoints**: `POST /mcp` - SSE connection
- **Benefits**: Real-time streaming, persistent connections

### 3. **STDIO Transport**
- **File**: `src/index.ts`
- **Use Case**: Local development, direct MCP client integration
- **Benefits**: Lowest latency, direct pipe communication

## MCP Tools Available

### 1. `list_collections`
Lists all collections in the Firestore database.

```json
{
  "name": "list_collections",
  "arguments": {}
}
```

### 2. `inspect_collection_schema`
Analyzes document structure by sampling documents from a collection.

```json
{
  "name": "inspect_collection_schema", 
  "arguments": {
    "collectionPath": "users",
    "sampleSize": 10
  }
}
```

### 3. `query_firestore`
Execute complex queries with filtering, ordering, and aggregation.

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

## Deployment

### Vercel (Recommended for Streamable HTTP)

1. **Setup Vercel**:
   ```bash
   npm i -g vercel
   vercel login
   ```

2. **Configure Environment**:
   ```bash
   vercel env add FIREBASE_SERVICE_ACCOUNT
   # Paste your complete Firebase service account JSON
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### Railway/Render (For SSE Transport)

1. **Connect GitHub repository**
2. **Set environment variables**:
   - `FIREBASE_SERVICE_ACCOUNT`: Your service account JSON
   - `PORT`: Will be set automatically
3. **Build Command**: `npm run build`
4. **Start Command**: `npm run start:sse` (for SSE) or `npm start` (for Streamable HTTP)

## MCP Client Configuration

### Claude Code (Local)
Add to your MCP settings:

```json
{
  "mcpServers": {
    "firestore": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "FIREBASE_SERVICE_ACCOUNT": "your-service-account-json"
      }
    }
  }
}
```

### Claude Code (Remote)
```json
{
  "mcpServers": {
    "firestore": {
      "url": "https://your-deployment.vercel.app/mcp",
      "transport": "streamable-http"
    }
  }
}
```

## API Endpoints

- **GET /** - Server info
- **GET /health** - Health check  
- **POST /mcp** - MCP JSON-RPC messages (Streamable HTTP)
- **GET /mcp** - SSE stream (Streamable HTTP)
- **DELETE /mcp** - Session termination (Streamable HTTP)

## Migration Guide

### From SSE to Streamable HTTP

1. **Update scripts**: Use `npm run dev` instead of `npm run dev:sse`
2. **Vercel deployment**: Use `vercel.json` configuration included
3. **Client compatibility**: Most MCP clients support both transports

### Why Streamable HTTP?

- ✅ **Serverless Compatible**: Works with Vercel, Netlify, CloudFlare
- ✅ **Better Error Handling**: More robust than SSE
- ✅ **Future Proof**: MCP specification standard since March 2025
- ✅ **Lower Costs**: Scales to zero on serverless platforms

## Troubleshooting

### Common Issues

1. **"Transport connection failed"**
   - Check `FIREBASE_SERVICE_ACCOUNT` is valid JSON
   - Verify Firestore permissions

2. **"CORS errors"**
   - Server is configured with open CORS (`origin: '*'`)
   - Check if client sends proper headers

3. **"Session errors" (Streamable HTTP)**
   - Sessions are managed automatically
   - Delete requests clear session state

### Logs
Check server logs for detailed error messages. All errors are logged with context.

## License

MIT License - see LICENSE file for details.