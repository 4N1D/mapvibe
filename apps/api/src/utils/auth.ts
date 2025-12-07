import { APIGatewayEvent } from "@/types";
import { getDb } from "@/services/db";

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