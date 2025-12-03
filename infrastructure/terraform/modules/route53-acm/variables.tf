# Route 53 + ACM Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "domain_name" {
  description = "Domain name (e.g., mapvibe.site)"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  type        = string
}

variable "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID (always Z2FDTNDATAQYW2)"
  type        = string
  default     = "Z2FDTNDATAQYW2"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for custom domain setup"
  type        = string
  default     = ""
}
