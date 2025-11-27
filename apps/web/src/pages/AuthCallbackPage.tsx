import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * OAuth Callback Page
 *
 * Amplify automatically handles OAuth callback and exchanges code for tokens.
 * Redirect immediately to home page.
 */
export const AuthCallbackPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return null;
};
