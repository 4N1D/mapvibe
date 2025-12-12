# API Gateway HTTP API Module

# ============================================
# HTTP API (v2 - simpler & cheaper than REST API)
# ============================================

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"
  description   = "MapVibe API Gateway"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 86400
  }

  tags = {
    Name        = "${var.project_name}-api-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================
# LAMBDA INTEGRATIONS
# ============================================

# Places Lambda Integration
resource "aws_apigatewayv2_integration" "places" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.places_lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# RAG Search Lambda Integration
resource "aws_apigatewayv2_integration" "rag" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.rag_lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Review aggregate Lambda Integration
resource "aws_apigatewayv2_integration" "review_aggregate" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.aggregate_lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000  # Max 30s for HTTP API v2
}

# ============================================
# COGNITO AUTHORIZER
# ============================================

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-cognito-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# ============================================
# ROUTES
# ============================================
resource "aws_apigatewayv2_route" "places_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /places"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "places_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /places/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "places_search" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /places/search"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "places_create" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /places"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "places_batch" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /places/batch"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "places_nearby" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /places/nearby"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

# Locations routes
resource "aws_apigatewayv2_route" "locations_search" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /locations/search"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "photos_upload_url" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /photos/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/me"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_put" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /users/me"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /users/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "users_me_photos" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/me/photos"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_reviews" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/me/reviews"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_saved" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/me/saved"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_stats" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/me/stats"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_votes" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/me/votes"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_liked_comments" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /users/me/liked-comments"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_avatar_post" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/me/avatar"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_avatar_put" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /users/me/avatar"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_background_post" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /users/me/background"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "users_me_background_put" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /users/me/background"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_save" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/{id}/save"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_info" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/info"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "restaurants_similar" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/similar"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "restaurants_comments_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/comments"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "restaurants_comments_create" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/comments"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_comments_like" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/comments/{commentId}/like"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_comments_report" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/comments/{commentId}/report"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_comments_delete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /restaurants/comments/{commentId}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_reviews_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/reviews"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "restaurants_reviews_create" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/{slug}/reviews"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_reviews_like" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/reviews/{reviewId}/like"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_reviews_report" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/reviews/{reviewId}/report"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_photos_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/photos"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "restaurants_menu" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/menu"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "reviews_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /reviews"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "reviews_create" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /reviews"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "reviews_vote" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /reviews/vote"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "reviews_comment" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /reviews/comment"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "reviews_hot" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /reviews/hot"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "reviews_share" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /reviews/share"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "reviews_report" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /reviews/report"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "reviews_submit_new_place" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /reviews/submit-new-place"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "reviews_approve_location" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /reviews/approve-location"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "reviews_cleanup_expired" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /reviews/cleanup-expired"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "reviews_comments" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /reviews/{reviewId}/comments"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "reviews_detail" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /reviews/{reviewId}"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "reviews_comments_like" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /reviews/comments/{commentId}/like"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "reviews_comments_report" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /reviews/comments/{commentId}/report"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "reviews_liked_comments" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /reviews/{reviewId}/liked-comments"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# RAG Search routes
resource "aws_apigatewayv2_route" "rag_search" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /search"
  target    = "integrations/${aws_apigatewayv2_integration.rag.id}"
}

resource "aws_apigatewayv2_route" "rag_health" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /rag/health"
  target    = "integrations/${aws_apigatewayv2_integration.rag.id}"
}

resource "aws_apigatewayv2_route" "review_aggregate" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /reviews/aggregate-pending"
  target             = "integrations/${aws_apigatewayv2_integration.review_aggregate.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ============================================
# ADMIN ROUTES
# ============================================

resource "aws_apigatewayv2_route" "admin_stats" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/stats"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_places_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/places"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_places_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/places/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_places_update" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PATCH /admin/places/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_places_delete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /admin/places/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_reviews_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/reviews"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_reviews_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/reviews/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_reviews_update" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PATCH /admin/reviews/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_locations_pending" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/locations/pending"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_locations_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/locations/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_locations_reviews" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/locations/{id}/reviews"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_locations_update" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PATCH /admin/locations/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_users_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/users"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_users_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/users/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_users_update" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PATCH /admin/users/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "photos_delete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /photos/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ============================================
# ACTIVITIES ROUTES (User tracking)
# ============================================

resource "aws_apigatewayv2_route" "activities_log" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /activities"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "activities_batch" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /activities/batch"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

# Admin Activities routes
resource "aws_apigatewayv2_route" "admin_activities_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/activities"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_activities_stats" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/activities/stats"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_activities_user" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/activities/user/{userId}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Admin Reports routes
resource "aws_apigatewayv2_route" "admin_reports_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/reports"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_reports_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/reports/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_reports_update" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PATCH /admin/reports/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ============================================
# RESTAURANTS ROUTES
# ============================================

resource "aws_apigatewayv2_route" "restaurants_info" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/info"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "restaurants_comments_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/comments"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "restaurants_comments_create" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/comments"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_comments_like" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/comments/{commentId}/like"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_comments_report" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/comments/{commentId}/report"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_comments_delete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /restaurants/comments/{commentId}"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_reviews_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/reviews"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "restaurants_reviews_create" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /restaurants/{slug}/reviews"
  target             = "integrations/${aws_apigatewayv2_integration.places.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "restaurants_photos_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/photos"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

resource "aws_apigatewayv2_route" "restaurants_menu" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /restaurants/{slug}/menu"
  target    = "integrations/${aws_apigatewayv2_integration.places.id}"
}

# ============================================
# STAGE (Auto-deploy)
# ============================================

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/api-gateway/${var.project_name}-api-${var.environment}"
  retention_in_days = 14

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================
# LAMBDA PERMISSIONS
# ============================================

resource "aws_lambda_permission" "places" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.places_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "rag" {
  statement_id  = "AllowAPIGatewayInvokeRAG"
  action        = "lambda:InvokeFunction"
  function_name = var.rag_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "review_aggregate" {
  statement_id  = "AllowAPIGatewayInvokeReviewAggregate"
  action        = "lambda:InvokeFunction"
  function_name = var.aggregate_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ============================================
# CUSTOM DOMAIN
# ============================================

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = "api.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = var.acm_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# API Mapping
resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.main.id
}

# Route 53 Record
resource "aws_route53_record" "api" {
  zone_id = var.route53_zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
