# ============================================
# ZIP SOURCE CODE (main.py + libs)
# ============================================

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/lambda-rag.zip"
}

# ============================================
# IAM ROLE
# ============================================

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-rag-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Basic Lambda + VPC access
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Secrets + Bedrock + Logs
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
# SECURITY GROUP
# ============================================

resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-rag-lambda-sg-${var.environment}"
  description = "Security group for RAG search Lambda"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Cho phép Lambda truy cập RDS
resource "aws_security_group_rule" "lambda_to_rds" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  security_group_id        = var.db_security_group_id
  description              = "Allow RAG Lambda to connect to RDS"
}

# ============================================
# LAMBDA FUNCTION (Python + Mangum)
# ============================================

resource "aws_lambda_function" "rag" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-rag-search-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "main.handler"   # vì trong main.py: handler = Mangum(app)
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 512
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      AWS_REGION   = var.aws_region
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