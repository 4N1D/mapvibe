# API Gateway Module Outputs

output "api_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.main.id
}

output "api_endpoint" {
  description = "API Gateway default endpoint"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "custom_domain_url" {
  description = "Custom domain URL"
  value       = "https://api.${var.domain_name}"
}

output "stage_name" {
  description = "API Gateway stage name"
  value       = aws_apigatewayv2_stage.main.name
}
