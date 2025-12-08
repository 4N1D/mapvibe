# Cognito User Pool Module for MapVibe
# Manages user authentication with optional Google OAuth

# Get current AWS account and region for permission ARN
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-users-${var.environment}"

  # Username settings
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration (using Cognito default)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Schema attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # MFA (optional for MVP)
  mfa_configuration = "OFF"

  tags = {
    Name        = "${var.project_name}-users-${var.environment}"
    Environment = var.environment
  }
}

# Google Identity Provider (optional - only created if credentials provided)
resource "aws_cognito_identity_provider" "google" {
  count         = var.google_client_id != "" ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "profile email openid"
  }

  attribute_mapping = {
    email    = "email"
    name     = "name"
    username = "sub"
  }
}

# User Pool Client (Web App)
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-web-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth settings
  generate_secret     = false
  explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  # Identity providers - COGNITO + Google if configured
  supported_identity_providers = var.google_client_id != "" ? ["COGNITO", "Google"] : ["COGNITO"]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile", "aws.cognito.signin.user.admin"]
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls

  # Token validity
  access_token_validity  = 1  # hours
  id_token_validity      = 1  # hours
  refresh_token_validity = 30 # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"

  depends_on = [aws_cognito_identity_provider.google]
}

# User Pool Domain - Cognito prefix (fallback)
resource "aws_cognito_user_pool_domain" "prefix" {
  count        = var.custom_domain == "" ? 1 : 0
  domain       = "${var.project_name}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# User Pool Domain - Custom domain (if configured)
resource "aws_cognito_user_pool_domain" "custom" {
  count           = var.custom_domain != "" ? 1 : 0
  domain          = var.custom_domain
  certificate_arn = var.acm_certificate_arn
  user_pool_id    = aws_cognito_user_pool.main.id
}

# Route53 Record for Custom Domain
resource "aws_route53_record" "cognito_custom_domain" {
  count   = var.custom_domain != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.custom_domain
  type    = "A"

  alias {
    name                   = aws_cognito_user_pool_domain.custom[0].cloudfront_distribution
    zone_id                = aws_cognito_user_pool_domain.custom[0].cloudfront_distribution_zone_id
    evaluate_target_health = false
  }
}
