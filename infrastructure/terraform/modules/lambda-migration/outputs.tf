# Lambda Migration Module Outputs

output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.migration.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.migration.arn
}

output "invoke_command" {
  description = "AWS CLI command to invoke migration"
  value       = "aws lambda invoke --function-name ${aws_lambda_function.migration.function_name} --payload '{}' response.json && cat response.json"
}
