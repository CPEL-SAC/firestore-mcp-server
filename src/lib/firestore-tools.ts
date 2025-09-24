import { Firestore } from "@google-cloud/firestore";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

const WHERE_OPERATORS = [
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "array-contains",
  "array-contains-any",
  "in",
  "not-in",
] as const;

type WhereOperator = typeof WHERE_OPERATORS[number];

const WHERE_OPERATOR_SET = new Set<WhereOperator>(WHERE_OPERATORS);

const ORDER_DIRECTIONS = ["asc", "desc"] as const;

type OrderDirection = typeof ORDER_DIRECTIONS[number];

const ORDER_DIRECTION_SET = new Set<OrderDirection>(ORDER_DIRECTIONS);

export const FIRESTORE_TOOL_DEFINITIONS: Tool[] = [
  {
    name: "list_collections",
    description: "List all top-level collections in the Firestore database.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "inspect_collection_schema",
    description: "Analyze the structure of documents in a collection by sampling documents.",
    inputSchema: {
      type: "object",
      properties: {
        collectionPath: {
          type: "string",
          description: "Path to the collection to inspect (required).",
        },
        sampleSize: {
          type: "number",
          description: "Number of documents to sample for schema analysis (default: 10).",
          default: 10,
        },
      },
      required: ["collectionPath"],
      additionalProperties: false,
    },
  },
  {
    name: "query_firestore",
    description: "Execute queries on a Firestore collection with optional filters, ordering, limits, and aggregations.",
    inputSchema: {
      type: "object",
      properties: {
        collectionPath: {
          type: "string",
          description: "Path to the collection to query (required).",
        },
        filters: {
          type: "array",
          description: "Optional array of filter conditions to apply before executing the query.",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: {
                type: "string",
                enum: [...WHERE_OPERATORS],
              },
              value: {
                description: "Value for the filter condition.",
              },
            },
            required: ["field", "operator", "value"],
          },
        },
        orderBy: {
          type: "array",
          description: "Optional array of order by clauses.",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              direction: { type: "string", enum: [...ORDER_DIRECTIONS] },
            },
            required: ["field", "direction"],
          },
        },
        limit: {
          type: "number",
          description: "Optional maximum number of documents to return (must be > 0).",
        },
        aggregation: {
          type: "object",
          description: "Optional aggregation operations to perform on the result set.",
          properties: {
            count: { type: "boolean", description: "Return the number of matching documents." },
            sum: { type: "string", description: "Compute the sum for the provided field name." },
            avg: { type: "string", description: "Compute the average for the provided field name." },
          },
        },
      },
      required: ["collectionPath"],
      additionalProperties: false,
    },
  },
];

type FilterArg = {
  field: string;
  operator: WhereOperator;
  value: unknown;
};

type OrderByArg = {
  field: string;
  direction: OrderDirection;
};

type AggregationArg = {
  count?: boolean;
  sum?: string;
  avg?: string;
};

type QueryArgs = {
  collectionPath: string;
  filters: FilterArg[];
  orderBy: OrderByArg[];
  limit?: number;
  aggregation?: AggregationArg;
};

export class FirestoreToolExecutor {
  constructor(private readonly firestore: Firestore) {}

  async execute(name: string, rawArgs: unknown): Promise<CallToolResult> {
    try {
      switch (name) {
        case "list_collections":
          return await this.listCollections();
        case "inspect_collection_schema":
          return await this.inspectCollectionSchema(rawArgs);
        case "query_firestore":
          return await this.queryFirestore(rawArgs);
        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult(message);
    }
  }

  private async listCollections(): Promise<CallToolResult> {
    const collections = await this.firestore.listCollections();
    const names = collections.map((collection) => collection.id).sort();

    if (names.length === 0) {
      return successResult("No collections found in the Firestore project.");
    }

    const text = [`Found ${names.length} collections:`, "", names.join("\n")].join("\n");

    return successResult(text);
  }

  private async inspectCollectionSchema(rawArgs: unknown): Promise<CallToolResult> {
    const { collectionPath, sampleSize } = this.parseInspectArgs(rawArgs);

    const snapshot = await this.firestore
      .collection(collectionPath)
      .limit(sampleSize)
      .get();

    if (snapshot.empty) {
      return successResult(`Collection '${collectionPath}' is empty or does not exist.`);
    }

    const schema: Record<string, Set<string>> = {};
    const examples: Record<string, unknown> = {};

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data && typeof data === "object") {
        this.collectSchema(data as Record<string, unknown>, schema, examples);
      }
    });

    const summaryLines = Object.entries(schema)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([field, types]) => {
        const example = sanitizeFirestoreValue(examples[field]);
        return [
          `Field: ${field}`,
          `  Types: ${Array.from(types).join(", ")}`,
          `  Example: ${JSON.stringify(example, null, 2)}`,
        ].join("\n");
      });

    const text = [
      `Schema analysis for collection '${collectionPath}' (sampled ${snapshot.size} documents):`,
      "",
      ...summaryLines,
    ].join("\n\n");

    return successResult(text);
  }

  private async queryFirestore(rawArgs: unknown): Promise<CallToolResult> {
    const args = this.parseQueryArgs(rawArgs);

    let query: FirebaseFirestore.Query = this.firestore.collection(args.collectionPath);

    for (const filter of args.filters) {
      query = query.where(filter.field, filter.operator, filter.value);
    }

    for (const order of args.orderBy) {
      query = query.orderBy(order.field, order.direction);
    }

    if (typeof args.limit === "number") {
      query = query.limit(args.limit);
    }

    let aggregateCount: number | undefined;
    if (args.aggregation?.count) {
      const countSnapshot = await query.count().get();
      const count = countSnapshot.data().count;
      aggregateCount = typeof count === "number" ? count : undefined;
    }

    const snapshot = await query.get();
    const rawDocs = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as Record<string, unknown>,
    }));

    const sanitizedDocs = rawDocs.map(({ id, data }) => ({
      id,
      ...(sanitizeFirestoreValue(data) as Record<string, unknown>),
    }));

    const lines: string[] = [`Found ${rawDocs.length} documents.`];

    if (typeof aggregateCount === "number") {
      lines.push(`Aggregate count: ${aggregateCount}`);
    }

    if (args.aggregation?.sum) {
      const stats = collectNumericStats(rawDocs, args.aggregation.sum);
      lines.push(
        formatNumericLine(
          `Sum of '${args.aggregation.sum}'`,
          stats.sum,
          stats.validCount,
          stats.invalidCount,
        ),
      );
    }

    if (args.aggregation?.avg) {
      const stats = collectNumericStats(rawDocs, args.aggregation.avg);
      lines.push(
        formatNumericLine(
          `Average of '${args.aggregation.avg}'`,
          stats.average,
          stats.validCount,
          stats.invalidCount,
        ),
      );
    }

    if (sanitizedDocs.length > 0) {
      lines.push("", JSON.stringify(sanitizedDocs, null, 2));
    }

    return successResult(lines.join("\n"));
  }

  private collectSchema(
    data: Record<string, unknown>,
    schema: Record<string, Set<string>>,
    examples: Record<string, unknown>,
    prefix = "",
  ): void {
    for (const [key, value] of Object.entries(data)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const type = describeValueType(value);

      if (!schema[fieldPath]) {
        schema[fieldPath] = new Set<string>();
        examples[fieldPath] = value;
      }

      schema[fieldPath]!.add(type);

      if (type === "object" && isPlainObject(value)) {
        this.collectSchema(value as Record<string, unknown>, schema, examples, fieldPath);
      }
    }
  }

  private parseInspectArgs(rawArgs: unknown): { collectionPath: string; sampleSize: number } {
    if (!isPlainObject(rawArgs)) {
      throw new Error("inspect_collection_schema expects an object with collectionPath (string) and optional sampleSize (number).");
    }

    const collectionPathRaw = rawArgs["collectionPath"];
    if (typeof collectionPathRaw !== "string" || collectionPathRaw.trim() === "") {
      throw new Error("collectionPath must be a non-empty string.");
    }

    const sampleSizeRaw = rawArgs["sampleSize"];
    let sampleSize = 10;
    if (sampleSizeRaw !== undefined) {
      if (typeof sampleSizeRaw !== "number" || !Number.isInteger(sampleSizeRaw) || sampleSizeRaw <= 0) {
        throw new Error("sampleSize must be a positive integer when provided.");
      }
      sampleSize = sampleSizeRaw;
    }

    return {
      collectionPath: collectionPathRaw.trim(),
      sampleSize,
    };
  }

  private parseQueryArgs(rawArgs: unknown): QueryArgs {
    if (!isPlainObject(rawArgs)) {
      throw new Error("query_firestore expects an object with query parameters.");
    }

    const { collectionPath, filters, orderBy, limit, aggregation } = rawArgs;

    if (typeof collectionPath !== "string" || collectionPath.trim() === "") {
      throw new Error("collectionPath must be a non-empty string.");
    }

    const parsedFilters = this.parseFilters(filters);
    const parsedOrderBy = this.parseOrderBy(orderBy);
    const parsedLimit = this.parseLimit(limit);
    const parsedAggregation = this.parseAggregation(aggregation);

    return {
      collectionPath: collectionPath.trim(),
      filters: parsedFilters,
      orderBy: parsedOrderBy,
      limit: parsedLimit,
      aggregation: parsedAggregation,
    };
  }

  private parseFilters(value: unknown): FilterArg[] {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new Error("filters must be an array when provided.");
    }

    return value.map((item, index) => {
      if (!isPlainObject(item)) {
        throw new Error(`filters[${index}] must be an object with field, operator, and value.`);
      }

      const field = item["field"];
      const operator = item["operator"];

      if (typeof field !== "string" || field.trim() === "") {
        throw new Error(`filters[${index}].field must be a non-empty string.`);
      }

      if (typeof operator !== "string" || !WHERE_OPERATOR_SET.has(operator as WhereOperator)) {
        throw new Error(`filters[${index}].operator must be one of: ${WHERE_OPERATORS.join(", ")}.`);
      }

      if (!Object.prototype.hasOwnProperty.call(item, "value")) {
        throw new Error(`filters[${index}] must include a value property.`);
      }

      return {
        field: field.trim(),
        operator: operator as WhereOperator,
        value: item["value"],
      };
    });
  }

  private parseOrderBy(value: unknown): OrderByArg[] {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new Error("orderBy must be an array when provided.");
    }

    return value.map((item, index) => {
      if (!isPlainObject(item)) {
        throw new Error(`orderBy[${index}] must be an object with field and direction.`);
      }

      const field = item["field"];
      const direction = item["direction"];

      if (typeof field !== "string" || field.trim() === "") {
        throw new Error(`orderBy[${index}].field must be a non-empty string.`);
      }

      if (typeof direction !== "string" || !ORDER_DIRECTION_SET.has(direction as OrderDirection)) {
        throw new Error(`orderBy[${index}].direction must be either 'asc' or 'desc'.`);
      }

      return {
        field: field.trim(),
        direction: direction as OrderDirection,
      };
    });
  }

  private parseLimit(value: unknown): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new Error("limit must be a positive integer when provided.");
    }

    return value;
  }

  private parseAggregation(value: unknown): AggregationArg | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!isPlainObject(value)) {
      throw new Error("aggregation must be an object when provided.");
    }

    const result: AggregationArg = {};

    if (Object.prototype.hasOwnProperty.call(value, "count")) {
      result.count = Boolean(value["count"]);
    }

    if (Object.prototype.hasOwnProperty.call(value, "sum")) {
      const field = value["sum"];
      if (typeof field !== "string" || field.trim() === "") {
        throw new Error("aggregation.sum must be a non-empty string when provided.");
      }
      result.sum = field.trim();
    }

    if (Object.prototype.hasOwnProperty.call(value, "avg")) {
      const field = value["avg"];
      if (typeof field !== "string" || field.trim() === "") {
        throw new Error("aggregation.avg must be a non-empty string when provided.");
      }
      result.avg = field.trim();
    }

    return Object.keys(result).length === 0 ? undefined : result;
  }
}

function successResult(text: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

function errorResult(message: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
  };
}

function describeValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (value instanceof Date) {
    return "timestamp";
  }

  if (value && typeof value === "object") {
    const ctorName = value.constructor?.name;

    if (ctorName === "Timestamp" && typeof (value as { toDate?: () => Date }).toDate === "function") {
      return "timestamp";
    }

    if (ctorName === "GeoPoint") {
      return "geopoint";
    }

    if (ctorName === "DocumentReference") {
      return "reference";
    }

    return "object";
  }

  return typeof value;
}

function sanitizeFirestoreValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFirestoreValue(item, seen));
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return value.toString("base64");
  }

  if (value && typeof value === "object") {
    const ctorName = value.constructor?.name;

    if (ctorName === "Timestamp" && typeof (value as { toDate?: () => Date }).toDate === "function") {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString();
      } catch {
        const seconds = (value as { seconds?: number }).seconds;
        const nanoseconds = (value as { nanoseconds?: number }).nanoseconds;
        return { seconds, nanoseconds };
      }
    }

    if (ctorName === "GeoPoint") {
      const point = value as { latitude: number; longitude: number };
      return { latitude: point.latitude, longitude: point.longitude };
    }

    if (ctorName === "DocumentReference") {
      const ref = value as { path?: string; id?: string };
      return {
        path: ref.path,
        id: ref.id,
      };
    }

    if (typeof (value as { toJSON?: () => unknown }).toJSON === "function") {
      try {
        const jsonValue = (value as { toJSON: () => unknown }).toJSON();
        return sanitizeFirestoreValue(jsonValue, seen);
      } catch {
        // fall through to object traversal
      }
    }

    if (seen.has(value as object)) {
      return "[Circular]";
    }

    seen.add(value as object);

    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = sanitizeFirestoreValue(nestedValue, seen);
    }

    return result;
  }

  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type NumericStats = {
  sum: number;
  average: number;
  validCount: number;
  invalidCount: number;
};

function collectNumericStats(
  docs: Array<{ data: Record<string, unknown> }>,
  field: string,
): NumericStats {
  let sum = 0;
  let validCount = 0;
  let invalidCount = 0;

  for (const doc of docs) {
    const value = doc.data[field];

    if (typeof value === "number" && Number.isFinite(value)) {
      sum += value;
      validCount += 1;
    } else if (value !== undefined) {
      invalidCount += 1;
    }
  }

  const average = validCount > 0 ? sum / validCount : 0;

  return {
    sum,
    average,
    validCount,
    invalidCount,
  };
}

function formatNumericLine(label: string, value: number, validCount: number, invalidCount: number): string {
  const base = `${label}: ${value}`;

  if (invalidCount === 0) {
    return base;
  }

  return `${base} (ignored ${invalidCount} document${invalidCount === 1 ? "" : "s"} with non-numeric values)`;
}
