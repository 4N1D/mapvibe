# Route 53 + ACM Module Outputs

output "zone_id" {
  description = "Route 53 Hosted Zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "zone_name_servers" {
  description = "Name servers"
  value       = aws_route53_zone.main.name_servers
}

output "certificate_arn" {
  description = "ACM Certificate ARN"
  value       = aws_acm_certificate.main.arn
}

output "certificate_status" {
  description = "Certificate validation status"
  value       = aws_acm_certificate.main.status
}

output "domain_name" {
  description = "Domain name"
  value       = var.domain_name
}

output "cognito_auth_domain" {
  description = "Cognito custom domain"
  value       = var.cognito_user_pool_id != "" ? "auth.${var.domain_name}" : null
}
