# S3 + CloudFront Module
# Manages static assets and photos distribution

# ============================================
# S3 BUCKETS
# ============================================

# Static Assets Bucket (Frontend)
resource "aws_s3_bucket" "static_assets" {
  bucket = var.static_assets_bucket_name

  tags = {
    Name = var.static_assets_bucket_name
  }
}

resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Photos Bucket (User uploads)
resource "aws_s3_bucket" "photos" {
  bucket = var.photos_bucket_name

  tags = {
    Name = var.photos_bucket_name
  }
}

resource "aws_s3_bucket_public_access_block" "photos" {
  bucket = aws_s3_bucket.photos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration for presigned URL uploads
resource "aws_s3_bucket_cors_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# ============================================
# CLOUDFRONT ORIGIN ACCESS CONTROL
# ============================================

resource "aws_cloudfront_origin_access_control" "static_assets" {
  name                              = "mapvibe-static-oac"
  description                       = "OAC for static assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "photos" {
  name                              = "mapvibe-photos-oac"
  description                       = "OAC for photos"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ============================================
# S3 BUCKET POLICIES (Allow CloudFront)
# ============================================

resource "aws_s3_bucket_policy" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static_assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_policy" "photos" {
  bucket = aws_s3_bucket.photos.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.photos.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

# ============================================
# CLOUDFRONT DISTRIBUTION
# ============================================

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "MapVibe CDN - Static Assets + Photos"
  default_root_object = "index.html"
  price_class         = "PriceClass_All"
  http_version        = "http2"
  web_acl_id          = var.web_acl_arn
  aliases             = length(var.domain_aliases) > 0 ? var.domain_aliases : null

  # Origin 1: Static Assets
  origin {
    domain_name              = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id                = "S3-StaticAssets"
    origin_access_control_id = aws_cloudfront_origin_access_control.static_assets.id
  }

  # Origin 2: Photos
  origin {
    domain_name              = aws_s3_bucket.photos.bucket_regional_domain_name
    origin_id                = "S3-Photos"
    origin_access_control_id = aws_cloudfront_origin_access_control.photos.id
  }

  # Default behavior → Static Assets
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-StaticAssets"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # AWS Managed Cache Policy: CachingOptimized
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # Cache behavior for /photos/* → Photos bucket
  ordered_cache_behavior {
    path_pattern     = "/photos/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Photos"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # SPA support: redirect 403/404 to index.html
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.acm_certificate_arn == null ? true : false
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = var.acm_certificate_arn != null ? "sni-only" : null
    minimum_protocol_version       = var.acm_certificate_arn != null ? "TLSv1.2_2021" : null
  }

  tags = {
    Name = "${var.project_name}-cdn-${var.environment}"
  }
}
