# Lambda Migration Module Variables
# NOTE: VPC variables removed - Lambda runs outside VPC (MVP)

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "mapvibe"
}

variable "db_secret_arn" {
  description = "Secrets Manager ARN for DB credentials"
  type        = string
}

variable "db_host" {
  description = "RDS endpoint (public, host only, no port)"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "mapvibe"
}
