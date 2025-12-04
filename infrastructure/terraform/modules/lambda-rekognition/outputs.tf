output "function_name" {
  description = "Rekognition Lambda function name"
  value       = aws_lambda_function.rekognition.function_name
}

output "function_arn" {
  description = "Rekognition Lambda function ARN"
  value       = aws_lambda_function.rekognition.arn
}

output "lambda_role_arn" {
  description = "IAM role ARN for Rekognition Lambda"
  value       = aws_iam_role.lambda.arn
}

