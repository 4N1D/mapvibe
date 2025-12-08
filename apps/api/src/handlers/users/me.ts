import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, unauthorized, notFound, error } from "../../middlewares/response";
import { getUserIdFromEvent } from "@/utils/auth";

// GET /users/me - Get current user profile
export const getMeHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      // Get user ID from JWT claims (set by API Gateway authorizer)
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized("Authentication required");
      }

      const db = await getDb();

      const user = await db
        .selectFrom("users")
        .select([
          "id",
          "email",
          "phone",
          "display_name",
          "avatar",
          "background",
          "bio",
          "gender",
          "reputation",
          "roles",
          "account_status",
          "email_verified",
          "created_at",
          "updated_at",
          "last_login_at",
        ])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user) {
        return notFound("User not found");
      }

      return success({ user });
    } catch (err) {
      console.error("[users/me] Error:", err);
      return error((err as Error).message);
    }
  },
};

// PUT /users/me - Update current user profile
export const updateMeHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized("Authentication required");
      }

      let body: UpdateProfileBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const allowedFields = ["display_name", "avatar", "bio", "phone", "gender"];
      const updateData: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (body[field as keyof UpdateProfileBody] !== undefined) {
          updateData[field] = body[field as keyof UpdateProfileBody];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return badRequest("No valid fields to update");
      }

      if (updateData.display_name) {
        const displayName = updateData.display_name as string;
        if (displayName.length < 2 || displayName.length > 100) {
          return badRequest("display_name must be 2-100 characters");
        }
      }

      if (updateData.phone) {
        const phone = updateData.phone as string;
        if (!/^(\+84|0)[0-9]{9,10}$/.test(phone)) {
          return badRequest("Invalid phone format");
        }
      }

      if (updateData.gender) {
        const gender = updateData.gender as string;
        const validGenders = ["Nam", "Nữ", "Khác"];
        if (!validGenders.includes(gender)) {
          return badRequest("Invalid gender. Allowed: Nam, Nữ, Khác");
        }
      }

      const db = await getDb();

      updateData.updated_at = new Date();

      const updatedUser = await db
        .updateTable("users")
        .set(updateData)
        .where("id", "=", userId)
        .returning([
          "id",
          "email",
          "phone",
          "display_name",
          "avatar",
          "bio",
          "gender",
          "reputation",
          "roles",
          "account_status",
          "email_verified",
          "created_at",
          "updated_at",
        ])
        .executeTakeFirst();

      if (!updatedUser) {
        return notFound("User not found");
      }

      return success({ user: updatedUser });
    } catch (err) {
      console.error("[users/me] Error:", err);
      return error((err as Error).message);
    }
  },
};

// GET /users/:id - Get user profile by ID (public view)
export const getUserByIdHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = event.pathParameters?.id;

      if (!userId) {
        return badRequest("User ID required");
      }

      const db = await getDb();

      // Public profile - limited fields
      const user = await db
        .selectFrom("users")
        .select(["id", "display_name", "avatar", "bio", "reputation", "created_at"])
        .where("id", "=", userId)
        .where("account_status", "=", "active")
        .executeTakeFirst();

      if (!user) {
        return notFound("User not found");
      }

      return success({ user });
    } catch (err) {
      console.error("[users/:id] Error:", err);
      return error((err as Error).message);
    }
  },
};

interface UpdateProfileBody {
  display_name?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  gender?: string;
}
