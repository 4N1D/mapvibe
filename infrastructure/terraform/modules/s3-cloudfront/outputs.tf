# S3 + CloudFront Module Outputs

output "static_assets_bucket_name" {
  description = "Static assets S3 bucket name"
  value       = aws_s3_bucket.static_assets.id
}

output "static_assets_bucket_arn" {
  description = "Static assets S3 bucket ARN"
  value       = aws_s3_bucket.static_assets.arn
}

output "photos_bucket_name" {
  description = "Photos S3 bucket name"
  value       = aws_s3_bucket.photos.id
}

output "photos_bucket_arn" {
  description = "Photos S3 bucket ARN"
  value       = aws_s3_bucket.photos.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_url" {
  description = "CloudFront URL"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}
