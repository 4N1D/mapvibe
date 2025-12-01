# Lambda Migration Module
# Runs database migrations from within VPC

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

# VPC access for Lambda
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
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
# SECURITY GROUP FOR LAMBDA
# ============================================

resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-migration-lambda-sg-${var.environment}"
  description = "Security group for migration Lambda"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "${var.project_name}-migration-lambda-sg-${var.environment}"
  }
}

# Allow Lambda to connect to RDS
resource "aws_security_group_rule" "lambda_to_rds" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  security_group_id        = var.db_security_group_id
  description              = "Allow Lambda to connect to RDS"
}

# ============================================
# LAMBDA FUNCTION
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
  timeout          = 300  # 5 minutes for migrations
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

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
