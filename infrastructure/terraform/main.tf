# MapVibe Infrastructure - MVP
# Main configuration file

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
# RDS MODULE
# ============================================

module "rds" {
  source = "./modules/rds"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids
  db_password        = random_password.db_password.result

  # MVP settings - tiết kiệm chi phí
  instance_class      = "db.t3.micro" # ~$15/tháng
  allocated_storage   = 20            # 20GB
  multi_az            = false         # Single AZ
  publicly_accessible = true          # MVP only - cho phép local dev & DataGrip
}

# ============================================
# LAMBDA MIGRATION MODULE
# ============================================

module "lambda_migration" {
  source = "./modules/lambda-migration"

  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  db_security_group_id = module.rds.security_group_id
  db_secret_arn        = aws_secretsmanager_secret.db_credentials.arn
  db_host              = module.rds.address
  db_name              = module.rds.database_name
}

# ============================================
# LAMBDA API MODULE
# ============================================

# Note: Run `cd apps/api && bun run build` before terraform apply

module "lambda_api" {
  source = "./modules/lambda-api"

  environment           = var.environment
  project_name          = var.project_name
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  rds_security_group_id = module.rds.security_group_id
  db_secret_arn         = aws_secretsmanager_secret.db_credentials.arn
  db_host               = module.rds.address
  db_name               = module.rds.database_name
  photos_bucket_name    = module.cdn.photos_bucket_name
  cloudfront_domain     = module.cdn.cloudfront_domain_name
}

# ============================================
# LAMBDA RAG MODULE
# ============================================

module "lambda_rag" {
  source = "./modules/lambda-rag"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  db_security_group_id = module.rds.security_group_id
  db_secret_arn        = aws_secretsmanager_secret.db_credentials.arn
  db_host              = module.rds.address
  db_name              = module.rds.database_name
}

# ============================================
# LAMBDA REVIEW AGGREGATE MODULE
# ============================================

module "lambda_review_aggregate" {
  source = "./modules/lambda-review-aggregate"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  db_security_group_id = module.rds.security_group_id
  db_secret_arn        = aws_secretsmanager_secret.db_credentials.arn
  db_host              = module.rds.address
  db_name              = module.rds.database_name
}

# ============================================
# LAMBDA OCR MENU MODULE
# ============================================

module "lambda_ocr_menu" {
  source = "./modules/lambda-ocr-menu"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  db_security_group_id = module.rds.security_group_id

  db_secret_arn = aws_secretsmanager_secret.db_credentials.arn
  db_host       = module.rds.address
  db_name       = module.rds.database_name

  photos_bucket_name = "mapvibe-photos" # Must match s3-cloudfront module default
}

# ============================================
# LAMBDA REKOGNITION MODULE
# ============================================

module "lambda_rekognition" {
  source = "./modules/lambda-rekognition"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  db_security_group_id = module.rds.security_group_id

  db_secret_arn = aws_secretsmanager_secret.db_credentials.arn
  db_host       = module.rds.address
  db_name       = module.rds.database_name

  photos_bucket_name = "mapvibe-photos" # Must match s3-cloudfront module default
}

# ============================================
# LAMBDA EMBEDDINGS MODULE
# ============================================

module "lambda_embeddings" {
  source = "./modules/lambda-embeddings"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  db_security_group_id = module.rds.security_group_id

  db_secret_arn = aws_secretsmanager_secret.db_credentials.arn
  db_host       = module.rds.address
  db_name       = module.rds.database_name
}

# ============================================
# S3 + CLOUDFRONT MODULE
# ============================================

# WAF: Sử dụng WAF hiện có (CloudFront Security Bundle yêu cầu)
# Để thêm rules, vào AWS Console > WAF > CreatedByCloudFront-a44b6ad5

module "cdn" {
  source = "./modules/s3-cloudfront"

  environment = var.environment
  web_acl_arn = "arn:aws:wafv2:us-east-1:487692781272:global/webacl/CreatedByCloudFront-a44b6ad5/06badb70-63dd-4ad2-9679-fc8e449b92f7"

  # Custom domain
  domain_aliases      = ["mapvibe.site", "www.mapvibe.site"]
  acm_certificate_arn = module.dns.certificate_arn
}

# ============================================
# S3 EVENT NOTIFICATIONS (Trigger Lambda)
# ============================================

# Data source để lấy S3 bucket
data "aws_s3_bucket" "photos" {
  bucket = "mapvibe-photos"
}

# Lambda permission: Cho phép S3 invoke Lambda OCR Menu
resource "aws_lambda_permission" "allow_s3_ocr_menu" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_ocr_menu.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = data.aws_s3_bucket.photos.arn
}



# S3 Notification: Gộp TẤT CẢ triggers vào 1 resource (AWS chỉ cho phép 1 notification config per bucket)
resource "aws_s3_bucket_notification" "photos_all" {
  bucket = data.aws_s3_bucket.photos.id

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
  cognito_user_pool_id   = var.cognito_user_pool_id
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
  cognito_user_pool_id     = var.cognito_user_pool_id
  cognito_client_id        = "3s6480dj3u1luo6ksp8sqh66sh"
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

  project_name          = var.project_name
  environment           = var.environment
  aws_region            = var.aws_region
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  db_host               = module.rds.address
  db_name               = module.rds.database_name
  db_secret_arn         = aws_secretsmanager_secret.db_credentials.arn
  rds_security_group_id = module.rds.security_group_id
  s3_bucket_id          = module.cdn.photos_bucket_name
  s3_bucket_arn         = module.cdn.photos_bucket_arn
  cloudfront_domain     = module.cdn.cloudfront_domain_name
}

# ============================================
# COGNITO LAMBDA TRIGGERS
# ============================================

# Permission cho Cognito gọi Lambda API
resource "aws_lambda_permission" "cognito_trigger" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_api.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = "arn:aws:cognito-idp:${var.aws_region}:${data.aws_caller_identity.current.account_id}:userpool/${var.cognito_user_pool_id}"
}

data "aws_caller_identity" "current" {}

# Cấu hình Lambda Trigger bằng null_resource + AWS CLI
resource "null_resource" "cognito_lambda_trigger" {
  triggers = {
    lambda_arn = module.lambda_api.function_arn
  }

  provisioner "local-exec" {
    command = "aws cognito-idp update-user-pool --region ${var.aws_region} --user-pool-id ${var.cognito_user_pool_id} --lambda-config PreTokenGeneration=${module.lambda_api.function_arn}"
  }

  depends_on = [aws_lambda_permission.cognito_trigger]
}


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
