output "function_name" {
  description = "OCR Menu Lambda function name"
  value       = aws_lambda_function.ocr_menu.function_name
}

output "function_arn" {
  description = "OCR Menu Lambda function ARN"
  value       = aws_lambda_function.ocr_menu.arn
}

output "lambda_role_arn" {
  description = "IAM role ARN for OCR Menu Lambda"
  value       = aws_iam_role.lambda.arn
}

