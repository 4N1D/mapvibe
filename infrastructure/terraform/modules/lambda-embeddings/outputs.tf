output "function_name" {
  description = "Embeddings Lambda function name"
  value       = aws_lambda_function.embeddings.function_name
}

output "function_arn" {
  description = "Embeddings Lambda function ARN"
  value       = aws_lambda_function.embeddings.arn
}

output "sqs_queue_url" {
  description = "SQS queue URL for embedding jobs"
  value       = aws_sqs_queue.embedding_jobs.id
}

output "sqs_queue_arn" {
  description = "SQS queue ARN for embedding jobs"
  value       = aws_sqs_queue.embedding_jobs.arn
}

output "lambda_role_arn" {
  description = "IAM role ARN for Embeddings Lambda"
  value       = aws_iam_role.lambda.arn
}

