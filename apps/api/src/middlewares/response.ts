import type { APIGatewayResponse } from "../types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Content-Type": "application/json",
};

export function success<T>(data: T, statusCode = 200): APIGatewayResponse {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

export function error(message: string, statusCode = 500): APIGatewayResponse {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}

export function notFound(message = "Not found"): APIGatewayResponse {
  return error(message, 404);
}

export function badRequest(message = "Bad request"): APIGatewayResponse {
  return error(message, 400);
}

export function unauthorized(message = "Unauthorized"): APIGatewayResponse {
  return error(message, 401);
}

export function forbidden(message = "Forbidden"): APIGatewayResponse {
  return error(message, 403);
}

export { corsHeaders };
