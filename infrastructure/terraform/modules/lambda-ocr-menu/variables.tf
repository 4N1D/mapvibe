variable "project_name" {
  type        = string
  description = "Project name"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/stage/prod)"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for Lambda"
}

variable "db_security_group_id" {
  type        = string
  description = "RDS security group ID"
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

variable "photos_bucket_name" {
  type        = string
  description = "S3 bucket name for photos"
}

