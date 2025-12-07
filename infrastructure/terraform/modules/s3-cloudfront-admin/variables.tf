# Admin S3 + CloudFront Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "mapvibe"
}

variable "bucket_name" {
  description = "S3 bucket name for admin static assets"
  type        = string
  default     = "mapvibe-admin-static"
}

variable "domain_alias" {
  description = "Custom domain for admin (e.g., admin.mapvibe.site)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
}

variable "web_acl_arn" {
  description = "ARN of WAF Web ACL (optional)"
  type        = string
  default     = null
}
