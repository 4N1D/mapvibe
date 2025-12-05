# Lambda Embeddings Module
# NOTE: Lambda runs outside VPC for simplicity (MVP)

# ============================================
# SQS QUEUE (cho embedding jobs)
# ============================================

resource "aws_sqs_queue" "embedding_jobs" {
  name                       = "${var.project_name}-embedding-jobs-${var.environment}"
  message_retention_seconds  = 86400
  visibility_timeout_seconds = 300

  tags = {
    Name        = "${var.project_name}-embedding-jobs-${var.environment}"
    Environment = var.environment
  }
}

# Dead Letter Queue
resource "aws_sqs_queue" "embedding_jobs_dlq" {
  name                      = "${var.project_name}-embedding-jobs-dlq-${var.environment}"
  message_retention_seconds = 1209600

  tags = {
    Name        = "${var.project_name}-embedding-jobs-dlq-${var.environment}"
    Environment = var.environment
  }
}

# Redrive policy
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

# Custom policy: Secrets + Bedrock + SQS
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
# LAMBDA FUNCTION (No VPC - connects to public RDS)
# ============================================

resource "aws_lambda_function" "embeddings" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-embeddings-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "main.lambda_handler"
  runtime          = "python3.12"
  timeout          = 300
  memory_size      = 512
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

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
  batch_size       = 5 # Xử lý tối đa 5 messages/lần
  enabled          = true
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.embeddings.function_name}"
  retention_in_days = 14
}

