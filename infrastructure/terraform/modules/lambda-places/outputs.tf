# Lambda Places Module Outputs

output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.places.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.places.arn
}

output "function_url" {
  description = "Lambda function URL for direct invocation"
  value       = aws_lambda_function_url.places.function_url
}

output "invoke_arn" {
  description = "Lambda invoke ARN for API Gateway integration"
  value       = aws_lambda_function.places.invoke_arn
}

output "security_group_id" {
  description = "Lambda security group ID"
  value       = aws_security_group.lambda.id
}
