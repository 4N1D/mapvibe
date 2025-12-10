# Lambda API Module Variables
# NOTE: VPC variables removed - Lambda runs outside VPC (MVP)

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "db_host" {
  description = "Database host (public endpoint)"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_secret_arn" {
  description = "ARN of Secrets Manager secret for DB credentials"
  type        = string
}

variable "photos_bucket_name" {
  description = "S3 bucket name for photo uploads"
  type        = string
  default     = "mapvibe-photos"
}

variable "cloudfront_domain" {
  description = "CloudFront domain for CDN URLs"
  type        = string
  default     = ""
}

variable "sqs_embedding_queue_url" {
  description = "SQS queue URL for embedding jobs"
  type        = string
  default     = ""
}

variable "sqs_embedding_queue_arn" {
  description = "SQS queue ARN for embedding jobs"
  type        = string
  default     = ""
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for admin operations"
  type        = string
  default     = ""
}