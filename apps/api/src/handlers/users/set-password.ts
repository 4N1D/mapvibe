import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { success, badRequest, unauthorized, error } from "../../middlewares/response";
import { getUserIdFromEvent, getEmailFromEvent } from "@/utils/auth";
import { adminSetUserPassword } from "@/services/cognito";

// POST /users/me/set-password - Set password for OAuth users
export const setPasswordHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      const email = getEmailFromEvent(event);

      if (!userId || !email) {
        return unauthorized("Authentication required");
      }

      // Parse body
      const body = event.body ? JSON.parse(event.body) : {};
      const { password } = body;

      // Validate password
      if (!password) {
        return badRequest("Password is required");
      }

      if (password.length < 8) {
        return badRequest("Password must be at least 8 characters");
      }

      // Check password complexity (Cognito default requirements)
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);

      if (!hasUpperCase || !hasLowerCase || !hasNumber) {
        return badRequest("Password must contain uppercase, lowercase letters and numbers");
      }

      // Set password using Cognito Admin API
      // Username in Cognito is the email for email-based sign up
      // For OAuth users, username might be the sub (user ID)
      // Try with email first, then userId
      try {
        await adminSetUserPassword(email, password, true);
        console.log(`[set-password] Password set successfully for user: ${userId}`);
      } catch (cognitoError) {
        // If email doesn't work, try with userId (sub)
        const err = cognitoError as Error & { name?: string };
        if (err.name === "UserNotFoundException") {
          try {
            await adminSetUserPassword(userId, password, true);
            console.log(`[set-password] Password set successfully for user (by sub): ${userId}`);
          } catch (retryError) {
            console.error("[set-password] Cognito error:", retryError);
            return badRequest((retryError as Error).message || "Failed to set password");
          }
        } else {
          console.error("[set-password] Cognito error:", cognitoError);
          return badRequest(err.message || "Failed to set password");
        }
      }

      return success({
        message: "Password set successfully",
        hasPassword: true,
      });
    } catch (err) {
      console.error("[users/me/set-password] Error:", err);
      return error((err as Error).message);
    }
  },
};
