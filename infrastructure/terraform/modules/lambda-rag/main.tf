# Lambda RAG Module
# NOTE: Lambda runs outside VPC for simplicity (MVP)

# ============================================
# ZIP SOURCE CODE (main.py + libs)
# ============================================
# IMPORTANT: Zip file MUST be pre-built using scripts/build-lambda-rag.ps1
# This ensures dependencies are Linux-compatible (built with Docker)
# The zip file should be at: ${path.module}/lambda-rag.zip
# 
# To build: Run .\scripts\build-lambda-rag.ps1 before terraform apply

locals {
  zip_file_path = "${path.module}/lambda-rag.zip"
}

# ============================================
# IAM ROLE
# ============================================

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-rag-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Basic Lambda execution
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Secrets + Bedrock
resource "aws_iam_role_policy" "lambda_extra" {
  name = "${var.project_name}-rag-extra-policy-${var.environment}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.db_secret_arn
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      }
    ]
  })
}

# ============================================
# LAMBDA FUNCTION (No VPC - connects to public RDS)
# ============================================

resource "aws_lambda_function" "rag" {
  filename         = local.zip_file_path
  function_name    = "${var.project_name}-rag-search-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "main.handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 2048
  source_code_hash = filebase64sha256(local.zip_file_path)

  environment {
    variables = {
      DB_SECRET_ARN = var.db_secret_arn
      DB_HOST       = var.db_host
      DB_NAME       = var.db_name
    }
  }
}

# Lambda URL cho phép gọi trực tiếp (giống module lambda-api)
resource "aws_lambda_function_url" "rag" {
  function_name      = aws_lambda_function.rag.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["*"]
    allow_headers = ["*"]
    max_age       = 86400
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.rag.function_name}"
  retention_in_days = 14
}