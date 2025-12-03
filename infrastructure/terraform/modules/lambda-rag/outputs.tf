output "function_name" {
  value       = aws_lambda_function.rag.function_name
  description = "RAG Lambda function name"
}

output "function_url" {
  value       = aws_lambda_function_url.rag.function_url
  description = "Direct Lambda URL for RAG search"
}