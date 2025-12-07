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
import type { APIGatewayEvent, APIGatewayResponse } from "./types";

// Decode JWT token to extract user info (without verification for local dev)
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// Type guard: Kiểm tra xem response có phải APIGatewayResponse không
function isAPIGatewayResponse(response: unknown): response is APIGatewayResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'statusCode' in response &&
    'body' in response
  );
}

const PORT = parseInt(process.env.PORT || "3000");

const server = http.createServer(async (req, res) => {
  // Parse URL
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // Collect body
  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    // Extract and decode JWT from Authorization header
    const authHeader = req.headers.authorization;
    let jwtClaims: Record<string, unknown> | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      jwtClaims = decodeJwt(token);
      if (jwtClaims) {
        console.log(`  Auth: User ${jwtClaims.sub}`);
      }
    }

    // Build event similar to API Gateway
    const event: APIGatewayEvent = {
      httpMethod: req.method || "GET",
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      pathParameters: null,
      headers: req.headers as Record<string, string>,
      body: body || null,
      requestContext: jwtClaims ? {
        authorizer: {
          jwt: {
            claims: jwtClaims,
          },
        },
      } : undefined,
    };

    console.log(`\n→ ${event.httpMethod} ${event.path}`);

    try {
      const response = await handler(event);

      // Local server chỉ handle API Gateway responses
      if (!isAPIGatewayResponse(response)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid response type for local server' }));
        return;
      }

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
