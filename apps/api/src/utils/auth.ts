import { APIGatewayEvent } from "@/types";

export function getUserIdFromEvent(event: APIGatewayEvent): string | null {
  const authorizer = event.requestContext?.authorizer;

  if (authorizer?.jwt?.claims?.sub) {
    return authorizer.jwt.claims.sub;
  }

  if (authorizer?.claims?.sub) {
    return authorizer.claims.sub;
  }

  const authHeader = event.headers?.['x-user-id'];
  if (authHeader) {
    return authHeader;
  }

  return null;
}