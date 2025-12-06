# Deploy and run database migrations
# Usage: pwsh ./scripts/deploy-migrate.ps1 [--rollback]

param(
    [switch]$rollback
)

$ErrorActionPreference = "Stop"

Write-Host "=== Deploy Migration Lambda ===" -ForegroundColor Cyan

# Navigate to terraform directory
Push-Location "$PSScriptRoot/../infrastructure/terraform"

try {
    # Deploy Lambda migration module
    Write-Host "Deploying Lambda migration..." -ForegroundColor Yellow
    terraform apply -target=module.lambda_migration -auto-approve

    if ($LASTEXITCODE -ne 0) {
        throw "Terraform apply failed"
    }

    Write-Host "`n=== Invoking Migration Lambda ===" -ForegroundColor Cyan
    
    # Prepare payload
    if ($rollback) {
        Write-Host "Running ROLLBACK..." -ForegroundColor Red
        $payload = '{"rollback":true}'
    } else {
        Write-Host "Running migrations..." -ForegroundColor Green
        $payload = '{}'
    }

    # Invoke Lambda
    aws lambda invoke `
        --function-name mapvibe-db-migration-mvp `
        --payload $payload `
        --cli-binary-format raw-in-base64-out `
        --region us-east-1 `
        response.json

    # Show result
    Write-Host "`n=== Migration Result ===" -ForegroundColor Cyan
    Get-Content response.json | ConvertFrom-Json | ConvertTo-Json -Depth 10

} finally {
    Pop-Location
}

Write-Host "`nDone!" -ForegroundColor Green
