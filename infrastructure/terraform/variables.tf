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

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "mapvibe"
}

# Google OAuth (optional - leave empty to disable Google Sign-In)
variable "google_client_id" {
  description = "Google OAuth Client ID from Google Cloud Console"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret from Google Cloud Console"
  type        = string
  sensitive   = true
  default     = ""
}
