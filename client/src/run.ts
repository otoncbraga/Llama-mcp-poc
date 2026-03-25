import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const mcpUrl = process.env.MCP_URL || "http://localhost:3333/mcp";

const client = new Client({
  name: "reservations-client",
  version: "0.1.0"
});

const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
await client.connect(transport);

const result = await client.callTool({
  name: "reservations.create",
  arguments: {
    chaletId: "chale-amarelo",
    checkIn: "2026-01-22",
    checkOut: "2026-01-24",
    guestName: "Janaina",
    arrivalTime: "18:00"
  }
});

console.log(JSON.stringify(result, null, 2));
await client.close();
