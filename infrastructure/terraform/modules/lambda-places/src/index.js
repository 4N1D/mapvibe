const { success, notFound, error, corsHeaders } = require('./middlewares/response');

// Import handlers
const listHandler = require('./handlers/list');
const getByIdHandler = require('./handlers/getById');
const searchHandler = require('./handlers/search');
const nearbyHandler = require('./handlers/nearby');

// Route definitions
const routes = [
  { method: 'GET', path: '/places', handler: listHandler },
  { method: 'GET', path: '/places/nearby', handler: nearbyHandler },
  { method: 'GET', path: '/places/:id', handler: getByIdHandler },
  { method: 'POST', path: '/places/search', handler: searchHandler },
];

// Match route with path parameters
function matchRoute(method, path) {
  for (const route of routes) {
    if (route.method !== method) continue;
    
    // Exact match
    if (route.path === path) {
      return { handler: route.handler, params: {} };
    }
    
    // Pattern match (e.g., /places/:id)
    const routeParts = route.path.split('/');
    const pathParts = path.split('/');
    
    if (routeParts.length !== pathParts.length) continue;
    
    const params = {};
    let match = true;
    
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    
    if (match) {
      return { handler: route.handler, params };
    }
  }
  
  return null;
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  const { httpMethod, path } = event;
  
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
      return notFound(`Route not found: ${httpMethod} ${path}`);
    }
    
    // Add path parameters to event
    event.pathParameters = { ...event.pathParameters, ...matched.params };
    
    // Execute handler
    return await matched.handler.handle(event);
    
  } catch (err) {
    console.error('Error:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
