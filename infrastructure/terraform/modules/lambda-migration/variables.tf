# Lambda Migration Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "mapvibe"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda"
  type        = list(string)
}

variable "db_security_group_id" {
  description = "RDS security group ID (Lambda needs access)"
  type        = string
}

variable "db_secret_arn" {
  description = "Secrets Manager ARN for DB credentials"
  type        = string
}

variable "db_host" {
  description = "RDS endpoint (host only, no port)"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "mapvibe"
}
