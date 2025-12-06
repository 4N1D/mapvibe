# Lambda S3 Trigger Module Variables
# NOTE: VPC variables removed - Lambda runs outside VPC (MVP)

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "db_host" {
  type        = string
  description = "Database host (public endpoint)"
}

variable "db_name" {
  type = string
}

variable "db_secret_arn" {
  type = string
}

variable "s3_bucket_id" {
  type        = string
  description = "S3 bucket name"
}

variable "s3_bucket_arn" {
  type        = string
  description = "S3 bucket ARN"
}

variable "cloudfront_domain" {
  type        = string
  description = "CloudFront domain for CDN URLs"
}
