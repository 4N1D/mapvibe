# S3 + CloudFront Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "mapvibe"
}

variable "static_assets_bucket_name" {
  description = "S3 bucket name for static assets (frontend)"
  type        = string
  default     = "mapvibe-static-assets"
}

variable "photos_bucket_name" {
  description = "S3 bucket name for user photos"
  type        = string
  default     = "mapvibe-photos"
}

variable "web_acl_arn" {
  description = "ARN of WAF Web ACL to associate with CloudFront"
  type        = string
  default     = null
}

variable "domain_aliases" {
  description = "Custom domain aliases for CloudFront (e.g., mapvibe.site, www.mapvibe.site)"
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for custom domain (required if domain_aliases is set)"
  type        = string
  default     = null
}
