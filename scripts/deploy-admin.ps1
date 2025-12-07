# Deploy Admin Dashboard to S3 + CloudFront
$ErrorActionPreference = "Stop"

# Paths
$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$ADMIN_DIR = "$ROOT_DIR\apps\admin"

# Config
$S3_BUCKET = "mapvibe-admin-static"
$TERRAFORM_DIR = "$ROOT_DIR\infrastructure\terraform"

# Get CloudFront Distribution ID from Terraform output (or env variable for CI/CD)
if ($env:ADMIN_CLOUDFRONT_DIST_ID) {
    $CLOUDFRONT_DIST_ID = $env:ADMIN_CLOUDFRONT_DIST_ID
} else {
    Write-Host "==> Getting CloudFront Distribution ID from Terraform..." -ForegroundColor Gray
    Push-Location $TERRAFORM_DIR
    $CLOUDFRONT_DIST_ID = (terraform output -raw admin_cloudfront_distribution_id 2>$null)
    Pop-Location
}

# Find bun executable
$BUN = (Get-Command bun -ErrorAction SilentlyContinue).Source
if (-not $BUN) {
    $BUN = "$env:USERPROFILE\.bun\bin\bun.exe"
    if (-not (Test-Path $BUN)) {
        Write-Host "[ERROR] bun not found. Install: https://bun.sh" -ForegroundColor Red
        exit 1
    }
}

# Find aws cli
$AWS = (Get-Command aws -ErrorAction SilentlyContinue).Source
if (-not $AWS) {
    Write-Host "[ERROR] aws cli not found in PATH. Install: https://aws.amazon.com/cli/" -ForegroundColor Red
    exit 1
}

function Exit-OnError {
    param($msg)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] $msg" -ForegroundColor Red
        exit 1
    }
}

# Step 1: Build Admin
Write-Host "`n==> [1/3] Building Admin Dashboard..." -ForegroundColor Cyan
Push-Location $ADMIN_DIR
& $BUN run build
Exit-OnError "Build failed"
Pop-Location

# Step 2: Sync to S3
Write-Host "`n==> [2/3] Uploading to S3..." -ForegroundColor Cyan
& $AWS s3 sync "$ADMIN_DIR\dist" "s3://$S3_BUCKET" --delete
Exit-OnError "S3 sync failed"

# Step 3: Invalidate CloudFront (optional)
if ($CLOUDFRONT_DIST_ID) {
    Write-Host "`n==> [3/3] Invalidating CloudFront cache..." -ForegroundColor Cyan
    & $AWS cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/*"
    Exit-OnError "CloudFront invalidation failed"
} else {
    Write-Host "`n==> [3/3] Skipping CloudFront invalidation (ADMIN_CLOUDFRONT_DIST_ID not set)" -ForegroundColor Yellow
    Write-Host "    Set environment variable ADMIN_CLOUDFRONT_DIST_ID to enable" -ForegroundColor Yellow
}

Write-Host "`n==> Admin Dashboard deployed!" -ForegroundColor Green
Write-Host "    URL: https://admin.mapvibe.site" -ForegroundColor Cyan
