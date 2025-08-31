#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Firestore } from "@google-cloud/firestore";
import express from "express";
import cors from "cors";

class FirestoreMCPHttpServer {
  private server: Server;
  private firestore!: Firestore;
  private app: express.Application;

  constructor() {
    this.server = new Server(
      {
        name: "firestore-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.app = express();
    this.initializeFirestore();
    this.setupToolHandlers();
    this.setupExpressApp();
  }

  private initializeFirestore() {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is required");
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (error) {
      throw new Error("Invalid JSON in FIREBASE_SERVICE_ACCOUNT environment variable");
    }

    this.firestore = new Firestore({
      credentials: credentials,
      projectId: credentials.project_id,
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "list_collections",
            description: "List all collections in the Firestore database",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: "inspect_collection_schema",
            description: "Analyze the structure and schema of documents in a collection by sampling documents",
            inputSchema: {
              type: "object",
              properties: {
                collectionPath: {
                  type: "string",
                  description: "Path to the collection to inspect",
                },
                sampleSize: {
                  type: "number",
                  description: "Number of documents to sample for schema analysis (default: 10)",
                  default: 10,
                },
              },
              required: ["collectionPath"],
              additionalProperties: false,
            },
          },
          {
            name: "query_firestore",
            description: "Execute complex queries on Firestore collections with filtering, ordering, and aggregation",
            inputSchema: {
              type: "object",
              properties: {
                collectionPath: {
                  type: "string",
                  description: "Path to the collection to query",
                },
                filters: {
                  type: "array",
                  description: "Array of filter conditions",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      operator: { 
                        type: "string", 
                        enum: ["==", "!=", "<", "<=", ">", ">=", "array-contains", "array-contains-any", "in", "not-in"]
                      },
                      value: { description: "Filter value" },
                    },
                    required: ["field", "operator", "value"],
                  },
                },
                orderBy: {
                  type: "array",
                  description: "Array of fields to order by",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      direction: { type: "string", enum: ["asc", "desc"] },
                    },
                    required: ["field", "direction"],
                  },
                },
                limit: {
                  type: "number",
                  description: "Maximum number of documents to return",
                },
                aggregation: {
                  type: "object",
                  description: "Aggregation operations to perform",
                  properties: {
                    count: { type: "boolean", description: "Count documents" },
                    sum: { type: "string", description: "Field to sum" },
                    avg: { type: "string", description: "Field to average" },
                  },
                },
              },
              required: ["collectionPath"],
              additionalProperties: false,
            },
          },
        ] satisfies Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_collections":
            return await this.listCollections();

          case "inspect_collection_schema":
            return await this.inspectCollectionSchema(
              (args?.collectionPath as string) || "",
              (args?.sampleSize as number) || 10
            );

          case "query_firestore":
            return await this.queryFirestore(args || {});

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupExpressApp() {
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'firestore-mcp-server',
        timestamp: new Date().toISOString()
      });
    });

    // MCP endpoint with SSE
    this.app.post('/mcp', async (req, res) => {
      try {
        const transport = new SSEServerTransport('/mcp', res);
        await this.server.connect(transport);
      } catch (error) {
        console.error('MCP Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Generic root
    this.app.get('/', (req, res) => {
      res.json({ 
        name: 'Internal API Service',
        status: 'operational' 
      });
    });
  }

  private async listCollections() {
    const collections = await this.firestore.listCollections();
    const collectionNames = collections.map(collection => collection.id);

    return {
      content: [
        {
          type: "text",
          text: `Found ${collectionNames.length} collections:\n${collectionNames.join('\n')}`,
        },
      ],
    };
  }

  private async inspectCollectionSchema(collectionPath: string, sampleSize: number) {
    const collection = this.firestore.collection(collectionPath);
    const snapshot = await collection.limit(sampleSize).get();
    
    if (snapshot.empty) {
      return {
        content: [
          {
            type: "text",
            text: `Collection '${collectionPath}' is empty or does not exist.`,
          },
        ],
      };
    }

    const schema: Record<string, Set<string>> = {};
    const examples: Record<string, any> = {};

    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      this.analyzeDocumentSchema(data, schema, examples);
    });

    const schemaInfo = Object.entries(schema).map(([field, types]) => ({
      field,
      types: Array.from(types),
      example: examples[field],
    }));

    return {
      content: [
        {
          type: "text",
          text: `Schema analysis for collection '${collectionPath}' (sampled ${snapshot.docs.length} documents):\n\n` +
            schemaInfo.map(({ field, types, example }) => 
              `Field: ${field}\n  Types: ${types.join(', ')}\n  Example: ${JSON.stringify(example)}`
            ).join('\n\n'),
        },
      ],
    };
  }

  private analyzeDocumentSchema(data: any, schema: Record<string, Set<string>>, examples: Record<string, any>, prefix = '') {
    Object.entries(data).forEach(([key, value]) => {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if (!schema[fieldPath]) {
        schema[fieldPath] = new Set();
        examples[fieldPath] = value;
      }

      const type = this.getValueType(value);
      schema[fieldPath].add(type);

      if (type === 'object' && value !== null) {
        this.analyzeDocumentSchema(value, schema, examples, fieldPath);
      }
    });
  }

  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'timestamp';
    if (typeof value === 'object' && value.constructor.name === 'DocumentReference') return 'reference';
    if (typeof value === 'object' && value.constructor.name === 'GeoPoint') return 'geopoint';
    return typeof value;
  }

  private async queryFirestore(args: any) {
    const { collectionPath, filters = [], orderBy = [], limit, aggregation } = args;
    
    let query: any = this.firestore.collection(collectionPath);

    filters.forEach((filter: any) => {
      query = query.where(filter.field, filter.operator, filter.value);
    });

    orderBy.forEach((order: any) => {
      query = query.orderBy(order.field, order.direction);
    });

    if (limit) {
      query = query.limit(limit);
    }

    if (aggregation) {
      if (aggregation.count) {
        const countSnapshot = await query.count().get();
        return {
          content: [
            {
              type: "text",
              text: `Count: ${countSnapshot.data().count}`,
            },
          ],
        };
      }

      if (aggregation.sum || aggregation.avg) {
        const snapshot = await query.get();
        const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        
        let result = `Found ${docs.length} documents`;
        
        if (aggregation.sum) {
          const sum = docs.reduce((acc: number, doc: any) => acc + (doc[aggregation.sum] || 0), 0);
          result += `\nSum of ${aggregation.sum}: ${sum}`;
        }
        
        if (aggregation.avg) {
          const sum = docs.reduce((acc: number, doc: any) => acc + (doc[aggregation.avg] || 0), 0);
          const avg = docs.length > 0 ? sum / docs.length : 0;
          result += `\nAverage of ${aggregation.avg}: ${avg}`;
        }

        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }
    }

    const snapshot = await query.get();
    const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    return {
      content: [
        {
          type: "text",
          text: `Found ${docs.length} documents:\n\n${JSON.stringify(docs, null, 2)}`,
        },
      ],
    };
  }

  async start() {
    const port = process.env.PORT || 3000;
    
    this.app.listen(port, () => {
      console.log(`🔥 Firestore MCP Server running on port ${port}`);
      console.log(`🚀 Health check: http://localhost:${port}/health`);
      console.log(`📡 MCP endpoint: http://localhost:${port}/mcp`);
    });
  }
}

const server = new FirestoreMCPHttpServer();
server.start().catch(console.error);