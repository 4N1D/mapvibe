# MapVibe Infrastructure - MVP
# Main configuration file
# NOTE: Lambda runs outside VPC, RDS is publicly accessible

# ============================================
# PROVIDER CONFIGURATION
# ============================================

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Provider for WAF (must be us-east-1 for CloudFront)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ============================================
# SECRETS MANAGER (Database Credentials)
# ============================================

# Tự động sinh password mạnh (16 ký tự, có special chars)
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?" # Loại bỏ ký tự gây lỗi như @ / \ '
}

# Tạo Secret container
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}/db-credentials-${var.environment}"
  description = "Database credentials for MapVibe ${var.environment}"

  tags = {
    Name = "${var.project_name}-db-credentials-${var.environment}"
  }
}

# Đặt giá trị vào Secret
resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "mapvibe_admin"
    password = random_password.db_password.result
    dbname   = "mapvibe"
    engine   = "postgres"
    port     = 5432
  })
}

# ============================================
# VPC MODULE
# ============================================

module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
}

# ============================================
# COGNITO MODULE
# ============================================

module "cognito" {
  source = "./modules/cognito"

  project_name  = var.project_name
  environment   = var.environment
  callback_urls = [
    "http://localhost:5173/auth/callback",
    "http://localhost:5174/auth/callback",
    "https://d1oasw0quh6m55.cloudfront.net/auth/callback",
    "https://mapvibe.site/auth/callback",
    "https://admin.mapvibe.site/auth/callback"
  ]
  logout_urls = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://d1oasw0quh6m55.cloudfront.net",
    "https://mapvibe.site",
    "https://admin.mapvibe.site"
  ]

  # Google OAuth (optional - leave empty to disable)
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret

  # Custom domain for Cognito Hosted UI
  custom_domain       = "login.mapvibe.site"
  acm_certificate_arn = module.dns.certificate_arn
  route53_zone_id     = module.dns.zone_id

  # Lambda Triggers
  lambda_trigger_arn = module.lambda_api.function_arn

  depends_on = [module.dns, module.lambda_api]
}

# ============================================
# RDS MODULE
# ============================================

module "rds" {
  source = "./modules/rds"

  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  db_password       = random_password.db_password.result

  # MVP settings
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  multi_az          = false
}

# ============================================
# LAMBDA MIGRATION MODULE
# ============================================

module "lambda_migration" {
  source = "./modules/lambda-migration"

  environment   = var.environment
  db_secret_arn = aws_secretsmanager_secret.db_credentials.arn
  db_host       = module.rds.address
  db_name       = module.rds.database_name
}

# ============================================
# LAMBDA EMBEDDINGS MODULE
# ============================================

module "lambda_embeddings" {
  source = "./modules/lambda-embeddings"

  project_name  = var.project_name
  environment   = var.environment
  aws_region    = var.aws_region
  db_secret_arn = aws_secretsmanager_secret.db_credentials.arn
  db_host       = module.rds.address
  db_name       = module.rds.database_name
}

# ============================================
# LAMBDA API MODULE
# ============================================

# Note: Run `cd apps/api && bun run build` before terraform apply

module "lambda_api" {
  source = "./modules/lambda-api"

  environment              = var.environment
  project_name             = var.project_name
  db_secret_arn            = aws_secretsmanager_secret.db_credentials.arn
  db_host                  = module.rds.address
  db_name                  = module.rds.database_name
  photos_bucket_name       = module.cdn.photos_bucket_name
  cloudfront_domain        = module.cdn.cloudfront_domain_name
  sqs_embedding_queue_url  = module.lambda_embeddings.sqs_queue_url
  sqs_embedding_queue_arn  = module.lambda_embeddings.sqs_queue_arn
}

# ============================================
# LAMBDA RAG MODULE
# ============================================

module "lambda_rag" {
  source = "./modules/lambda-rag"

  project_name  = var.project_name
  environment   = var.environment
  aws_region    = var.aws_region
  db_secret_arn = aws_secretsmanager_secret.db_credentials.arn
  db_host       = module.rds.address
  db_name       = module.rds.database_name
}

# ============================================
# LAMBDA REVIEW AGGREGATE MODULE
# ============================================

module "lambda_review_aggregate" {
  source = "./modules/lambda-review-aggregate"

  project_name         = var.project_name
  environment          = var.environment
  db_secret_arn        = aws_secretsmanager_secret.db_credentials.arn
  db_host              = module.rds.address
  db_name              = module.rds.database_name
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
}

# ============================================
# LAMBDA OCR MENU MODULE
# ============================================

module "lambda_ocr_menu" {
  source = "./modules/lambda-ocr-menu"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  db_secret_arn      = aws_secretsmanager_secret.db_credentials.arn
  db_host            = module.rds.address
  db_name            = module.rds.database_name
  photos_bucket_name = module.cdn.photos_bucket_name
}

# ============================================
# LAMBDA REKOGNITION MODULE
# ============================================

module "lambda_rekognition" {
  source = "./modules/lambda-rekognition"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  db_secret_arn      = aws_secretsmanager_secret.db_credentials.arn
  db_host            = module.rds.address
  db_name            = module.rds.database_name
  photos_bucket_name = module.cdn.photos_bucket_name
}

# ============================================
# WAF MODULE (for CloudFront)
# ============================================

module "waf" {
  source = "./modules/waf"

  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  project_name = var.project_name
  environment  = var.environment
}

# ============================================
# S3 + CLOUDFRONT MODULE
# ============================================

module "cdn" {
  source = "./modules/s3-cloudfront"

  environment = var.environment
  web_acl_arn = module.waf.web_acl_arn

  # Custom domain
  domain_aliases      = ["mapvibe.site", "www.mapvibe.site"]
  acm_certificate_arn = module.dns.certificate_arn
}

# ============================================
# S3 EVENT NOTIFICATIONS (Trigger Lambda)
# ============================================

# Lambda permission: Cho phép S3 invoke Lambda OCR Menu
resource "aws_lambda_permission" "allow_s3_ocr_menu" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_ocr_menu.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = module.cdn.photos_bucket_arn
}

# S3 Notification: Gộp TẤT CẢ triggers vào 1 resource
resource "aws_s3_bucket_notification" "photos_all" {
  bucket = module.cdn.photos_bucket_name

  # OCR Menu triggers - chỉ cho folder menus/
  lambda_function {
    lambda_function_arn = module.lambda_ocr_menu.function_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "menus/"
    filter_suffix       = ".jpg"
  }

  lambda_function {
    lambda_function_arn = module.lambda_ocr_menu.function_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "menus/"
    filter_suffix       = ".jpeg"
  }

  lambda_function {
    lambda_function_arn = module.lambda_ocr_menu.function_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "menus/"
    filter_suffix       = ".png"
  }

  # S3 Trigger Lambda - cho tất cả ảnh (trừ menus/)
  lambda_function {
    lambda_function_arn = module.lambda_s3_trigger.function_arn
    events              = ["s3:ObjectCreated:Put"]
    filter_prefix       = "reviews/"
    filter_suffix       = ".jpg"
  }

  lambda_function {
    lambda_function_arn = module.lambda_s3_trigger.function_arn
    events              = ["s3:ObjectCreated:Put"]
    filter_prefix       = "reviews/"
    filter_suffix       = ".jpeg"
  }

  lambda_function {
    lambda_function_arn = module.lambda_s3_trigger.function_arn
    events              = ["s3:ObjectCreated:Put"]
    filter_prefix       = "reviews/"
    filter_suffix       = ".png"
  }

  depends_on = [
    aws_lambda_permission.allow_s3_ocr_menu,
    module.lambda_s3_trigger
  ]
}

# ============================================
# ROUTE 53 + ACM MODULE
# ============================================

module "dns" {
  source = "./modules/route53-acm"

  environment            = var.environment
  project_name           = var.project_name
  domain_name            = "mapvibe.site"
  cloudfront_domain_name = module.cdn.cloudfront_domain_name
}

# ============================================
# ADMIN DASHBOARD CDN MODULE
# ============================================

module "admin_cdn" {
  source = "./modules/s3-cloudfront-admin"

  environment         = var.environment
  project_name        = var.project_name
  bucket_name         = "mapvibe-admin-static"
  domain_alias        = "admin.mapvibe.site"
  acm_certificate_arn = module.dns.certificate_arn
  web_acl_arn         = module.waf.web_acl_arn

  depends_on = [module.dns]
}

# Route53 record for admin.mapvibe.site
resource "aws_route53_record" "admin" {
  zone_id = module.dns.zone_id
  name    = "admin.mapvibe.site"
  type    = "A"

  alias {
    name                   = module.admin_cdn.cloudfront_domain_name
    zone_id                = "Z2FDTNDATAQYW2"  # CloudFront global hosted zone ID
    evaluate_target_health = false
  }
}

# ============================================
# API GATEWAY MODULE
# ============================================

module "api_gateway" {
  source = "./modules/api-gateway"

  environment         = var.environment
  project_name        = var.project_name
  domain_name         = "mapvibe.site"
  acm_certificate_arn = module.dns.certificate_arn
  route53_zone_id     = module.dns.zone_id

  # Lambda integrations
  places_lambda_name       = module.lambda_api.function_name
  places_lambda_invoke_arn = module.lambda_api.invoke_arn
  aws_region               = var.aws_region
  cognito_user_pool_id     = module.cognito.user_pool_id
  cognito_client_id        = module.cognito.client_id
  # RAG Lambda integration
  rag_lambda_name       = module.lambda_rag.function_name
  rag_lambda_invoke_arn = module.lambda_rag.invoke_arn
  # Review aggregate Lambda integration
  aggregate_lambda_name       = module.lambda_review_aggregate.function_name
  aggregate_lambda_invoke_arn = module.lambda_review_aggregate.invoke_arn
}

# ============================================
# S3 TRIGGER LAMBDA
# ============================================

module "lambda_s3_trigger" {
  source = "./modules/lambda-s3-trigger"

  project_name      = var.project_name
  environment       = var.environment
  aws_region        = var.aws_region
  db_host           = module.rds.address
  db_name           = module.rds.database_name
  db_secret_arn     = aws_secretsmanager_secret.db_credentials.arn
  s3_bucket_id      = module.cdn.photos_bucket_name
  s3_bucket_arn     = module.cdn.photos_bucket_arn
  cloudfront_domain = module.cdn.cloudfront_domain_name
}

data "aws_caller_identity" "current" {}


# ============================================
# OUTPUTS
# ============================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "RDS endpoint để connect"
  value       = module.rds.endpoint
}

output "rds_database_name" {
  description = "Database name"
  value       = module.rds.database_name
}

output "db_secret_arn" {
  description = "ARN của Secret chứa DB credentials (dùng cho Lambda)"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "db_secret_name" {
  description = "Tên Secret (xem trong AWS Console)"
  value       = aws_secretsmanager_secret.db_credentials.name
}

output "cloudfront_url" {
  description = "CloudFront CDN URL"
  value       = module.cdn.cloudfront_url
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = module.cdn.cloudfront_distribution_id
}

output "migration_lambda_name" {
  description = "Lambda function name for running migrations"
  value       = module.lambda_migration.function_name
}

output "migration_invoke_command" {
  description = "Command to invoke migration Lambda"
  value       = module.lambda_migration.invoke_command
}

output "api_lambda_url" {
  description = "API Lambda URL (direct)"
  value       = module.lambda_api.function_url
}

output "api_lambda_function_name" {
  description = "API Lambda function name"
  value       = module.lambda_api.function_name
}

# DNS Outputs
output "domain_name" {
  description = "Domain name"
  value       = module.dns.domain_name
}

output "name_servers" {
  description = "Name servers"
  value       = module.dns.zone_name_servers
}

output "certificate_arn" {
  description = "ACM Certificate ARN"
  value       = module.dns.certificate_arn
}

# API Gateway Outputs
output "api_gateway_url" {
  description = "API Gateway custom domain URL"
  value       = module.api_gateway.custom_domain_url
}

output "api_gateway_endpoint" {
  description = "API Gateway default endpoint"
  value       = module.api_gateway.api_endpoint
}

output "rag_lambda_url" {
  description = "RAG search Lambda URL"
  value       = module.lambda_rag.function_url
}

# Lambda OCR Menu Outputs
output "ocr_menu_lambda_name" {
  description = "OCR Menu Lambda function name"
  value       = module.lambda_ocr_menu.function_name
}

output "ocr_menu_lambda_arn" {
  description = "OCR Menu Lambda function ARN"
  value       = module.lambda_ocr_menu.function_arn
}

# Lambda Rekognition Outputs
output "rekognition_lambda_name" {
  description = "Rekognition Lambda function name"
  value       = module.lambda_rekognition.function_name
}

output "rekognition_lambda_arn" {
  description = "Rekognition Lambda function ARN"
  value       = module.lambda_rekognition.function_arn
}

# Lambda Embeddings Outputs
output "embeddings_lambda_name" {
  description = "Embeddings Lambda function name"
  value       = module.lambda_embeddings.function_name
}

output "embeddings_sqs_queue_url" {
  description = "SQS queue URL for embedding jobs"
  value       = module.lambda_embeddings.sqs_queue_url
}

output "embeddings_sqs_queue_arn" {
  description = "SQS queue ARN for embedding jobs"
  value       = module.lambda_embeddings.sqs_queue_arn
}

# Cognito Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.cognito.client_id
}

output "cognito_hosted_ui_url" {
  description = "Cognito Hosted UI URL"
  value       = module.cognito.hosted_ui_url
}

# WAF Outputs
output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = module.waf.web_acl_arn
}

# Admin Dashboard Outputs
output "admin_cloudfront_url" {
  description = "Admin Dashboard CloudFront URL"
  value       = module.admin_cdn.cloudfront_url
}

output "admin_cloudfront_distribution_id" {
  description = "Admin CloudFront Distribution ID"
  value       = module.admin_cdn.cloudfront_distribution_id
}

output "admin_s3_bucket" {
  description = "Admin S3 bucket name"
  value       = module.admin_cdn.bucket_name
}

output "admin_domain" {
  description = "Admin Dashboard URL"
  value       = "https://admin.mapvibe.site"
}
