// Minimal MCP server used as a deploy target when testing OneClickMCP.
// Serves both transports so it works whichever one the console picks:
//   - legacy SSE:      GET /sse  + POST /messages?sessionId=...
//   - streamable HTTP: POST /mcp (stateless, no session bookkeeping)

import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT) || 3000;
const GREETING_NAME = process.env.GREETING_NAME || "world";
const DEMO_API_KEY = process.env.DEMO_API_KEY || "";

function createServer() {
  const server = new McpServer({ name: "mcp-hello-test", version: "1.0.0" });

  server.registerTool(
    "greet",
    {
      title: "Greet",
      description: "Say hello to someone.",
      inputSchema: { name: z.string().optional() },
    },
    async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name || GREETING_NAME}!` }],
    })
  );

  server.registerTool(
    "add",
    {
      title: "Add",
      description: "Add two numbers.",
      inputSchema: { a: z.number(), b: z.number() },
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    })
  );

  // Proves env injection reached the container without leaking the whole value.
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description: "Report runtime info and whether DEMO_API_KEY was injected.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              server: "mcp-hello-test",
              node: process.version,
              port: PORT,
              greetingName: GREETING_NAME,
              demoApiKeySet: DEMO_API_KEY.length > 0,
              demoApiKeyPreview: DEMO_API_KEY.slice(0, 4),
              uptimeSeconds: Math.round(process.uptime()),
            },
            null,
            2
          ),
        },
      ],
    })
  );

  return server;
}

const app = express();

// Health check before the JSON parser so it stays cheap.
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/", (_req, res) =>
  res.json({ name: "mcp-hello-test", sse: "/sse", http: "/mcp" })
);

// --- legacy SSE transport --------------------------------------------------
// POST bodies on /messages are parsed by the transport itself, so express.json()
// is mounted only on /mcp below.

const sessions = new Map();

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  sessions.set(transport.sessionId, transport);
  res.on("close", () => sessions.delete(transport.sessionId));
  await createServer().connect(transport);
});

app.post("/messages", async (req, res) => {
  const transport = sessions.get(String(req.query.sessionId || ""));
  if (!transport) {
    res.status(400).json({ error: "unknown sessionId" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// --- streamable HTTP transport ---------------------------------------------
// Stateless: a fresh server+transport per request, closed when the response ends.

app.post("/mcp", express.json(), async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    transport.close();
  });
  await createServer().connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`mcp-hello-test listening on 0.0.0.0:${PORT}`);
  console.log(`  SSE:  GET  /sse  (+ POST /messages)`);
  console.log(`  HTTP: POST /mcp`);
});
