# Deploy API to AWS Lambda via Terraform
# Usage: pwsh ./scripts/deploy-api.ps1 [-Force]
param(
    [switch]$Force  # Force replace Lambda function (slower but ensures fresh deploy)
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

# Paths
$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$API_DIR = "$ROOT_DIR\apps\api"
$TERRAFORM_DIR = "$ROOT_DIR\infrastructure\terraform"
$LAMBDA_DIR = "$TERRAFORM_DIR\modules\lambda-api"

# Find bun executable
$BUN = (Get-Command bun -ErrorAction SilentlyContinue).Source
if (-not $BUN) {
    $BUN = "$env:USERPROFILE\.bun\bin\bun.exe"
    if (-not (Test-Path $BUN)) {
        Write-Host "[ERROR] bun not found. Install: https://bun.sh" -ForegroundColor Red
        exit 1
    }
}

# Find terraform executable
$TF = (Get-Command terraform -ErrorAction SilentlyContinue).Source
if (-not $TF) {
    Write-Host "[ERROR] terraform not found in PATH. Install: https://terraform.io" -ForegroundColor Red
    exit 1
}

function Exit-OnError {
    param($msg)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] $msg" -ForegroundColor Red
        exit 1
    }
}

$TotalSteps = if ($Force) { 4 } else { 3 }

# Step 1: Build API
Write-Host "`n==> [1/$TotalSteps] Building API..." -ForegroundColor Cyan
Push-Location $API_DIR
& $BUN run build
Exit-OnError "Build failed"
Pop-Location

# Step 2: Copy dist to terraform
Write-Host "`n==> [2/$TotalSteps] Copying dist..." -ForegroundColor Cyan
$LAMBDA_DIST_DIR = "$LAMBDA_DIR\dist"
if (-not (Test-Path $LAMBDA_DIST_DIR)) {
    New-Item -ItemType Directory -Path $LAMBDA_DIST_DIR -Force | Out-Null
}
Copy-Item -Path "$API_DIR\dist\*" -Destination $LAMBDA_DIST_DIR -Recurse -Force

# Step 3: Terraform deploy
Write-Host "`n==> [3/$TotalSteps] Terraform deploy..." -ForegroundColor Cyan
Push-Location $TERRAFORM_DIR
& $TF init -upgrade
Exit-OnError "Terraform init failed"

if ($Force) {
    Write-Host "Force replacing Lambda function..." -ForegroundColor Yellow
    & $TF apply -replace="module.lambda_api.aws_lambda_function.api" -auto-approve
    Exit-OnError "Terraform apply failed"

    # Step 4: Re-apply to restore permissions (Cognito trigger permission gets lost after replace)
    Write-Host "`n==> [4/$TotalSteps] Restoring permissions..." -ForegroundColor Cyan
    & $TF apply -auto-approve
    Exit-OnError "Permission restore failed"
} else {
    & $TF apply -auto-approve
    Exit-OnError "Terraform apply failed"
}
Pop-Location

$Duration = (Get-Date) - $StartTime
Write-Host "`n==> Deploy completed in $($Duration.Minutes)m $($Duration.Seconds)s!" -ForegroundColor Green