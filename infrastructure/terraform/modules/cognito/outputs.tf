# Cognito Module Outputs

output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Cognito User Pool endpoint"
  value       = aws_cognito_user_pool.main.endpoint
}

output "client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.web.id
}

output "domain" {
  description = "Cognito User Pool domain"
  value       = var.custom_domain != "" ? var.custom_domain : aws_cognito_user_pool_domain.prefix[0].domain
}

output "hosted_ui_url" {
  description = "Hosted UI URL"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${aws_cognito_user_pool_domain.prefix[0].domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

data "aws_region" "current" {}
