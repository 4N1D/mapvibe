# Cognito Module Variables

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "callback_urls" {
  description = "Callback URLs for OAuth"
  type        = list(string)
  default     = ["http://localhost:5173/auth/callback", "https://mapvibe.site/auth/callback"]
}

variable "logout_urls" {
  description = "Logout URLs for OAuth"
  type        = list(string)
  default     = ["http://localhost:5173/", "https://mapvibe.site/"]
}

# Google OAuth (optional)
variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}

# Custom domain (optional)
variable "custom_domain" {
  description = "Custom domain for Cognito Hosted UI (e.g., auth.mapvibe.site)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM Certificate ARN for custom domain"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 Hosted Zone ID for custom domain"
  type        = string
  default     = ""
}

# Lambda Triggers (optional)
variable "lambda_trigger_arn" {
  description = "Lambda function ARN for Cognito triggers (PostConfirmation, PostAuthentication, PreTokenGeneration)"
  type        = string
  default     = ""
}
