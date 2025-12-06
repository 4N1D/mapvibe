output "lambda_function_name" {
  value = aws_lambda_function.s3_trigger.function_name
}

output "lambda_function_arn" {
  value = aws_lambda_function.s3_trigger.arn
}

output "function_arn" {
  description = "Lambda function ARN (alias for lambda_function_arn)"
  value       = aws_lambda_function.s3_trigger.arn
}
