import { APIGatewayEvent } from "@/types";
import { getDb } from "@/services/db";

export function getClientIp(event: APIGatewayEvent): string | null {
  // Try various headers in order of reliability
  const headers = event.headers || {};
  
  // CloudFront / API Gateway
  const sourceIp = event.requestContext?.identity?.sourceIp;
  if (sourceIp) return sourceIp;
  
  // X-Forwarded-For header (first IP is the client)
  const xff = headers['X-Forwarded-For'] || headers['x-forwarded-for'];
  if (xff) {
    const ips = xff.split(',').map((ip: string) => ip.trim());
    return ips[0] || null;
  }
  
  // Other common headers
  return headers['X-Real-IP'] || headers['x-real-ip'] || null;
}

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

export function getEmailFromEvent(event: APIGatewayEvent): string | null {
  const authorizer = event.requestContext?.authorizer;

  if (authorizer?.jwt?.claims?.email) {
    return authorizer.jwt.claims.email;
  }

  if (authorizer?.claims?.email) {
    return authorizer.claims.email;
  }

  return null;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const db = await getDb();
  
  const user = await db
    .selectFrom("users")
    .select("roles")
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!user?.roles) {
    return false;
  }

  const roles = typeof user.roles === "string" ? JSON.parse(user.roles) : user.roles;
  return Array.isArray(roles) && roles.includes("admin");
}