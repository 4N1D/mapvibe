# ============================================
# SQS QUEUE (cho embedding jobs)
# ============================================

resource "aws_sqs_queue" "embedding_jobs" {
  name                      = "${var.project_name}-embedding-jobs-${var.environment}"
  message_retention_seconds = 86400  # 24 hours
  visibility_timeout_seconds = 300   # 5 minutes (Lambda timeout)
  
  tags = {
    Name        = "${var.project_name}-embedding-jobs-${var.environment}"
    Environment = var.environment
  }
}

# Dead Letter Queue (nếu job fail nhiều lần)
resource "aws_sqs_queue" "embedding_jobs_dlq" {
  name                      = "${var.project_name}-embedding-jobs-dlq-${var.environment}"
  message_retention_seconds = 1209600  # 14 days
  
  tags = {
    Name        = "${var.project_name}-embedding-jobs-dlq-${var.environment}"
    Environment = var.environment
  }
}

# Redrive policy: sau 3 lần fail thì chuyển sang DLQ
resource "aws_sqs_queue_redrive_policy" "embedding_jobs" {
  queue_url = aws_sqs_queue.embedding_jobs.id
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.embedding_jobs_dlq.arn
    maxReceiveCount     = 3
  })
}

# ============================================
# ZIP SOURCE CODE
# ============================================

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/lambda-embeddings.zip"
}

# ============================================
# IAM ROLE
# ============================================

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-embeddings-lambda-role-${var.environment}"

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

# Custom policy: Secrets + Bedrock + SQS + DB access
resource "aws_iam_role_policy" "lambda_extra" {
  name = "${var.project_name}-embeddings-extra-policy-${var.environment}"
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
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.embedding_jobs.arn,
          aws_sqs_queue.embedding_jobs_dlq.arn
        ]
      }
    ]
  })
}

# ============================================
# SECURITY GROUP
# ============================================

resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-embeddings-lambda-sg-${var.environment}"
  description = "Security group for Embeddings Lambda"
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
  description              = "Allow Embeddings Lambda to connect to RDS"
}

# ============================================
# LAMBDA FUNCTION
# ============================================

resource "aws_lambda_function" "embeddings" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-embeddings-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "main.lambda_handler"
  runtime          = "python3.12"
  timeout          = 300  # 5 minutes (cho embedding lớn)
  memory_size      = 512
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

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
}

# ============================================
# SQS EVENT SOURCE MAPPING
# ============================================

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.embedding_jobs.arn
  function_name    = aws_lambda_function.embeddings.arn
  batch_size       = 5  # Xử lý tối đa 5 messages/lần
  enabled          = true
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.embeddings.function_name}"
  retention_in_days = 14
}

