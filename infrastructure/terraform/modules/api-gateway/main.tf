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
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
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

# RAG Search Lambda Integration (if provided)
resource "aws_apigatewayv2_integration" "rag" {
  count = var.rag_lambda_invoke_arn != "" ? 1 : 0

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.rag_lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# ============================================
# ROUTES
# ============================================

# Places routes
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

# RAG Search routes
resource "aws_apigatewayv2_route" "rag_search" {
  count = var.rag_lambda_invoke_arn != "" ? 1 : 0

  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/search"
  target    = "integrations/${aws_apigatewayv2_integration.rag[0].id}"
}

resource "aws_apigatewayv2_route" "rag_health" {
  count = var.rag_lambda_invoke_arn != "" ? 1 : 0

  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/rag/health"
  target    = "integrations/${aws_apigatewayv2_integration.rag[0].id}"
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
  count = var.rag_lambda_invoke_arn != "" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvokeRAG"
  action        = "lambda:InvokeFunction"
  function_name = var.rag_lambda_name
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
