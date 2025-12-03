# Common variables used across all modules

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "mvp"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "mapvibe"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID (for custom domain setup)"
  type        = string
  default     = "us-east-1_2bhVHgAvY"
}
