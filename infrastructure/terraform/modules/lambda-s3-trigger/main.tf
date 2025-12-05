# Lambda S3 Trigger Module
# NOTE: Lambda runs outside VPC for simplicity (MVP)

# ============================================
# IAM ROLE
# ============================================
resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-s3-trigger-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = {
    Name        = "${var.project_name}-s3-trigger-role-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role_policy" "lambda" {
  name = "${var.project_name}-s3-trigger-policy-${var.environment}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.db_secret_arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${var.s3_bucket_arn}/*"
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
  output_path = "${path.module}/lambda-s3-trigger.zip"
}

resource "aws_lambda_function" "s3_trigger" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-s3-trigger-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      DB_HOST           = var.db_host
      DB_PORT           = "5432"
      DB_NAME           = var.db_name
      DB_SECRET_ARN     = var.db_secret_arn
      CLOUDFRONT_DOMAIN = var.cloudfront_domain
    }
  }

  tags = {
    Name        = "${var.project_name}-s3-trigger-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}
# ============================================
# S3 PERMISSION (Notification is managed in main.tf)
# ============================================
resource "aws_lambda_permission" "s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_trigger.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.s3_bucket_arn
}


# ============================================
# CLOUDWATCH LOGS
# ============================================
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.project_name}-s3-trigger-${var.environment}"
  retention_in_days = 14

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
