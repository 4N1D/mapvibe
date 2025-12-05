# Cognito Module Variables

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "callback_urls" {
  description = "Callback URLs for OAuth"
  type        = list(string)
  default     = ["http://localhost:5173/callback", "https://mapvibe.site/callback"]
}

variable "logout_urls" {
  description = "Logout URLs for OAuth"
  type        = list(string)
  default     = ["http://localhost:5173", "https://mapvibe.site"]
}

# Google OAuth (optional)
variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}
