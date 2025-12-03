/**
 * Local development server
 * Simulates API Gateway + Lambda locally
 *
 * Run: bun run dev
 * Test: curl http://localhost:3000/places
 */

import "dotenv/config";
import http from "http";
import { URL } from "url";
import { handler } from "./index";
import type { APIGatewayEvent } from "./types";

const PORT = parseInt(process.env.PORT || "3000");

const server = http.createServer(async (req, res) => {
  // Parse URL
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // Collect body
  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    // Build event similar to API Gateway
    const event: APIGatewayEvent = {
      httpMethod: req.method || "GET",
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      pathParameters: null,
      headers: req.headers as Record<string, string>,
      body: body || null,
    };

    console.log(`\n→ ${event.httpMethod} ${event.path}`);

    try {
      const response = await handler(event);

      // Set headers
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);

      console.log(`← ${response.statusCode}`);
    } catch (err) {
      console.error("Error:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║         MapVibe API - Local Development              ║
╠══════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                        ║
║  Mode:   ${process.env.NODE_ENV || "development"}                              ║
╠══════════════════════════════════════════════════════╣
║  Available routes:                                   ║
║  GET  /places          - List places                 ║
║  GET  /places/:id      - Get place by ID             ║
║  POST /places/search   - Search places               ║
║  GET  /places/nearby   - Nearby places               ║
╚══════════════════════════════════════════════════════╝
  `);
});
