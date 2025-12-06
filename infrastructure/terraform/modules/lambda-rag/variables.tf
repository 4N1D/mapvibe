# Lambda RAG Module Variables
# NOTE: VPC variables removed - Lambda runs outside VPC (MVP)

variable "project_name" {
  type        = string
  description = "Project name"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/stage/prod)"
}

variable "db_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for DB credentials"
}

variable "db_host" {
  type        = string
  description = "Database host (public endpoint)"
}

variable "db_name" {
  type        = string
  description = "Database name"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}