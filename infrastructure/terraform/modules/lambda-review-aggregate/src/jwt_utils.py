"""
JWT Verification Utility for AWS Cognito
Verifies JWT tokens issued by AWS Cognito User Pool
"""
import os
import json
import logging
from typing import Dict, Any, Optional
from functools import lru_cache

import boto3
import jwt
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID")
COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID")


@lru_cache(maxsize=1)
def get_jwks_client() -> Optional[PyJWKClient]:
    """Get JWKS client for Cognito User Pool (cached)"""
    if not COGNITO_USER_POOL_ID:
        logger.warning("⚠️ COGNITO_USER_POOL_ID not set, JWT verification disabled")
        return None
    
    jwks_url = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    try:
        return PyJWKClient(jwks_url)
    except Exception as e:
        logger.error(f"❌ Failed to create JWKS client: {str(e)}")
        return None


def extract_token_from_header(headers: Dict[str, Any]) -> Optional[str]:
    """Extract JWT token from Authorization header"""
    auth_header = headers.get("Authorization") or headers.get("authorization")
    if not auth_header:
        return None
    
    # Support both "Bearer <token>" and just "<token>"
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return auth_header


def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify JWT token from Cognito
    
    Returns:
        Decoded token claims if valid, None otherwise
    """
    if not COGNITO_USER_POOL_ID or not COGNITO_CLIENT_ID:
        logger.warning("⚠️ Cognito config missing, skipping JWT verification")
        return None
    
    try:
        jwks_client = get_jwks_client()
        if not jwks_client:
            return None
        
        # Get signing key from JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Verify token
        decoded = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=COGNITO_CLIENT_ID,
            issuer=f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}",
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
            }
        )
        
        logger.info(f"✅ JWT verified for user: {decoded.get('sub', 'unknown')}")
        return decoded
        
    except jwt.ExpiredSignatureError:
        logger.warning("⚠️ JWT token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"⚠️ Invalid JWT token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"❌ JWT verification error: {str(e)}")
        return None


def get_user_id_from_event(event: Dict[str, Any]) -> Optional[str]:
    """
    Extract user ID from Lambda event
    Supports both API Gateway (with authorizer) and direct invocation (with JWT in headers)
    """
    # Check if called via API Gateway with authorizer
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})
    
    logger.info(f"🔐 Authorizer context: {authorizer}")
    
    # API Gateway JWT authorizer - check jwt.claims first
    jwt_claims = authorizer.get("jwt", {}).get("claims", {})
    if jwt_claims and jwt_claims.get("sub"):
        logger.info(f"✅ Found user via jwt.claims: {jwt_claims.get('sub')}")
        return jwt_claims["sub"]
    
    # Fallback: check authorizer.claims directly (some API Gateway configs)
    direct_claims = authorizer.get("claims", {})
    if direct_claims and direct_claims.get("sub"):
        logger.info(f"✅ Found user via claims: {direct_claims.get('sub')}")
        return direct_claims["sub"]
    
    # Direct invocation: verify JWT from headers
    headers = event.get("headers", {}) or {}
    token = extract_token_from_header(headers)
    
    if token:
        logger.info("🔑 Found token in Authorization header, verifying...")
        decoded = verify_jwt_token(token)
        if decoded:
            logger.info(f"✅ JWT verified, user: {decoded.get('sub')}")
            return decoded.get("sub")
        logger.warning("⚠️ JWT verification failed")
    else:
        logger.warning("⚠️ No Authorization header found")
    
    return None


# Note: CORS is handled by Lambda Function URL config in Terraform
RESPONSE_HEADERS = {
    "Content-Type": "application/json",
}


def require_auth(event: Dict[str, Any]) -> tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Require authentication for Lambda handler
    
    Returns:
        (is_authenticated, user_id, error_response)
    """
    user_id = get_user_id_from_event(event)
    
    if not user_id:
        error_response = {
            "statusCode": 401,
            "headers": RESPONSE_HEADERS,
            "body": json.dumps({
                "error": "Unauthorized",
                "message": "JWT token required. Please include Authorization header with Bearer token."
            })
        }
        return False, None, error_response
    
    return True, user_id, None

