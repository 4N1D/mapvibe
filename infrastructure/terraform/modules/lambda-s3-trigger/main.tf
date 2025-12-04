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
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
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
# LAMBDA FUNCTION
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

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

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
# SECURITY GROUP
# ============================================
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-s3-trigger-sg-${var.environment}"
  description = "Security group for S3 Trigger Lambda"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.project_name}-s3-trigger-sg-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_security_group_rule" "lambda_to_rds" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  security_group_id        = var.rds_security_group_id
  description              = "Allow S3 Trigger Lambda to connect to RDS"
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
