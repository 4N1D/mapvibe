# API Gateway Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "domain_name" {
  description = "Base domain name (e.g., mapvibe.site)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
}

variable "route53_zone_id" {
  description = "Route 53 Hosted Zone ID"
  type        = string
}

# Lambda integrations
variable "places_lambda_name" {
  description = "Places Lambda function name"
  type        = string
}

variable "places_lambda_invoke_arn" {
  description = "Places Lambda invoke ARN"
  type        = string
}
variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito App Client ID"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}
