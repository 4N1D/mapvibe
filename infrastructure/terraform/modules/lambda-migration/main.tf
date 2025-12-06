# Lambda Migration Module
# Runs database migrations
# NOTE: Lambda runs outside VPC for simplicity (MVP)

# ============================================
# IAM ROLE FOR LAMBDA
# ============================================

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-migration-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-migration-lambda-role-${var.environment}"
  }
}

# Basic Lambda execution (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Secrets Manager access
resource "aws_iam_role_policy" "secrets_access" {
  name = "${var.project_name}-migration-secrets-policy-${var.environment}"
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
      }
    ]
  })
}

# ============================================
# LAMBDA FUNCTION (No VPC - connects to public RDS)
# ============================================

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/lambda_migration.zip"
}

resource "aws_lambda_function" "migration" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-db-migration-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 300
  memory_size      = 256

  environment {
    variables = {
      DB_SECRET_ARN = var.db_secret_arn
      DB_HOST       = var.db_host
      DB_NAME       = var.db_name
    }
  }

  tags = {
    Name = "${var.project_name}-db-migration-${var.environment}"
  }
}
