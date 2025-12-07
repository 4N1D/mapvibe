variable "project_name" {
  type        = string
  description = "Project name"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
}

variable "db_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for DB credentials"
}

variable "db_host" {
  type        = string
  description = "Database host"
}

variable "db_name" {
  type        = string
  description = "Database name"
}

variable "cognito_user_pool_id" {
  type        = string
  description = "Cognito User Pool ID for JWT verification"
}

variable "cognito_client_id" {
  type        = string
  description = "Cognito App Client ID for JWT verification"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

