output "function_name" {
  value       = aws_lambda_function.rag.function_name
  description = "RAG Lambda function name"
}

output "function_arn" {
  value       = aws_lambda_function.rag.arn
  description = "RAG Lambda function ARN"
}

output "invoke_arn" {
  value       = aws_lambda_function.rag.invoke_arn
  description = "RAG Lambda invoke ARN (for API Gateway)"
}

output "function_url" {
  value       = aws_lambda_function_url.rag.function_url
  description = "Direct Lambda URL for RAG search"
}