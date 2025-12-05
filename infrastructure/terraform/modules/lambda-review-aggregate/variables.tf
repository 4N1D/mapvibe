variable "project_name" {
  type        = string
  description = "Project name"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
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



