output "function_name" {
  value       = aws_lambda_function.aggregate.function_name
  description = "Review aggregation Lambda name"
}

output "function_arn" {
  value       = aws_lambda_function.aggregate.arn
  description = "Review aggregation Lambda ARN"
}

output "invoke_arn" {
  value       = aws_lambda_function.aggregate.invoke_arn
  description = "Review aggregation Lambda invoke ARN"
}

output "function_url" {
  value       = aws_lambda_function_url.aggregate.function_url
  description = "Direct URL for review aggregation Lambda"
}

