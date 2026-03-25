import http from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ReservationsCreateInput, reservationsCreate } from "./tools/reservationsCreate.js";

const port = Number(process.env.MCP_PORT || 3333);

const server = new McpServer({
  name: "reservations-mcp",
  version: "0.1.0"
});

server.tool("reservations.create", ReservationsCreateInput.shape, async (args) => {
  const result = await reservationsCreate(args);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
});

const transport = new StreamableHTTPServerTransport();
await server.connect(transport);

const httpServer = http.createServer((req, res) => {
  transport.handleRequest(req, res);
});

httpServer.listen(port, () => {
  console.log(`MCP server listening on port ${port}`);
});
