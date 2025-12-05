# Lambda Rekognition Module
# NOTE: Lambda runs outside VPC for simplicity (MVP)

# ============================================
# ZIP SOURCE CODE
# ============================================

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/lambda-rekognition.zip"
}

# ============================================
# IAM ROLE
# ============================================

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-rekognition-lambda-role-${var.environment}"

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

# Custom policy: Secrets + S3 + Rekognition
resource "aws_iam_role_policy" "lambda_extra" {
  name = "${var.project_name}-rekognition-extra-policy-${var.environment}"
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
          "s3:GetObject"
        ]
        Resource = "arn:aws:s3:::${var.photos_bucket_name}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "rekognition:DetectLabels",
          "rekognition:DetectModerationLabels",
          "rekognition:DetectFaces",
          "rekognition:DetectText"
        ]
        Resource = "*"
      }
    ]
  })
}

# ============================================
# LAMBDA FUNCTION (No VPC - connects to public RDS)
# ============================================

resource "aws_lambda_function" "rekognition" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-rekognition-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "main.lambda_handler"
  runtime          = "python3.12"
  timeout          = 60
  memory_size      = 512
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      DB_SECRET_ARN = var.db_secret_arn
      DB_HOST       = var.db_host
      DB_NAME       = var.db_name
      PHOTOS_BUCKET = var.photos_bucket_name
    }
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.rekognition.function_name}"
  retention_in_days = 14
}

