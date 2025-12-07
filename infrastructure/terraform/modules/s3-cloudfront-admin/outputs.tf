# Admin S3 + CloudFront Module Outputs

output "bucket_name" {
  description = "Admin S3 bucket name"
  value       = aws_s3_bucket.admin.id
}

output "bucket_arn" {
  description = "Admin S3 bucket ARN"
  value       = aws_s3_bucket.admin.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.admin.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.admin.domain_name
}

output "cloudfront_url" {
  description = "CloudFront URL"
  value       = "https://${aws_cloudfront_distribution.admin.domain_name}"
}
