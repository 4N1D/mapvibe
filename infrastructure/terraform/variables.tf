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
