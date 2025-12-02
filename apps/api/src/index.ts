import type { APIGatewayEvent, APIGatewayResponse, Handler } from './types';
import { corsHeaders, notFound, error } from './middlewares/response';

// Import handlers
import {
  listHandler,
  getByIdHandler,
  searchHandler,
  nearbyHandler,
  createHandler,
  batchHandler,
} from './handlers/places';
import {
  createHandler as reviewCreateHandler,
  voteHandler as reviewVoteHandler,
  commentHandler as reviewCommentHandler,
  hotHandler as reviewHotHandler,
} from './handlers/reviews';

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
  {
    method: 'POST',
    pattern: /^\/places$/,
    paramNames: [],
    handler: createHandler,
  },
  {
    method: 'POST',
    pattern: /^\/places\/batch$/,
    paramNames: [],
    handler: batchHandler,
  },

  // Reviews routes
  {
    method: 'POST',
    pattern: /^\/reviews$/,
    paramNames: [],
    handler: reviewCreateHandler,
  },
  {
    method: 'POST',
    pattern: /^\/reviews\/vote$/,
    paramNames: [],
    handler: reviewVoteHandler,
  },
  {
    method: 'POST',
    pattern: /^\/reviews\/comment$/,
    paramNames: [],
    handler: reviewCommentHandler,
  },
  {
    method: 'GET',
    pattern: /^\/reviews\/hot$/,
    paramNames: [],
    handler: reviewHotHandler,
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
  const httpMethod =
    event.httpMethod || event.requestContext?.http?.method || 'GET';
  const path =
    event.path ||
    event.rawPath ||
    event.requestContext?.http?.path ||
    '/';

  console.log(`[API] ${httpMethod} ${path}`);

  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Find matching route
    const matched = matchRoute(httpMethod, path);

    if (!matched) {
      console.log(`[API] Route not found: ${httpMethod} ${path}`);
      return notFound(`Route not found: ${httpMethod} ${path}`);
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
