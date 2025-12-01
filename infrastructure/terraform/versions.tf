# Terraform và Provider versions

terraform {
  required_version = ">= 1.0"

  # Terraform Cloud - lưu state và quản lý runs
  cloud {
    organization = "aws-firstcloudjourney"

    workspaces {
      name = "mapvibe"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}
