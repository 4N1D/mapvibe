# WAF requires us-east-1 for CloudFront
# This provider alias must be passed from root module

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}
