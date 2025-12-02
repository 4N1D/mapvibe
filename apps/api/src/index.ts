import type { APIGatewayEvent, APIGatewayResponse, Handler } from './types';
import { corsHeaders, notFound, error } from './middlewares/response';

// Import handlers
import {
  listHandler,
  getByIdHandler,
  searchHandler,
  nearbyHandler,
} from './handlers/places';

// Route definitions
interface RouteDefinition {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

const routes: RouteDefinition[] = [
  // Places routes
  {
    method: 'GET',
    pattern: /^\/places$/,
    paramNames: [],
    handler: listHandler,
  },
  {
    method: 'GET',
    pattern: /^\/places\/nearby$/,
    paramNames: [],
    handler: nearbyHandler,
  },
  {
    method: 'GET',
    pattern: /^\/places\/([^/]+)$/,
    paramNames: ['id'],
    handler: getByIdHandler,
  },
  {
    method: 'POST',
    pattern: /^\/places\/search$/,
    paramNames: [],
    handler: searchHandler,
  },

  // Add more routes here as you build them:
  // { method: 'GET', pattern: /^\/reviews$/, paramNames: [], handler: reviewsListHandler },
  // { method: 'POST', pattern: /^\/reviews$/, paramNames: [], handler: reviewsCreateHandler },
  // { method: 'POST', pattern: /^\/auth\/login$/, paramNames: [], handler: authLoginHandler },
];

// Find matching route
function matchRoute(
  method: string,
  path: string
): { handler: Handler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;

    const match = path.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      return { handler: route.handler, params };
    }
  }
  return null;
}

// Lambda handler
export async function handler(
  event: APIGatewayEvent
): Promise<APIGatewayResponse> {
  console.log(`[API] ${event.httpMethod} ${event.path}`);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Find matching route
    const matched = matchRoute(event.httpMethod, event.path);

    if (!matched) {
      console.log(`[API] Route not found: ${event.httpMethod} ${event.path}`);
      return notFound(`Route not found: ${event.httpMethod} ${event.path}`);
    }

    // Add path parameters to event
    event.pathParameters = { ...event.pathParameters, ...matched.params };

    // Execute handler
    return await matched.handler.handle(event);
  } catch (err) {
    console.error('[API] Unhandled error:', err);
    return error((err as Error).message || 'Internal server error', 500);
  }
}

// Export for Lambda
export { handler as lambdaHandler };
