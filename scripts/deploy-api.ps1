# Deploy API to AWS Lambda via Terraform
$ErrorActionPreference = "Stop"

# Paths
$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$API_DIR = "$ROOT_DIR\apps\api"
$TERRAFORM_DIR = "$ROOT_DIR\infrastructure\terraform"
$LAMBDA_DIR = "$TERRAFORM_DIR\modules\lambda-api"
$BUN = "$env:USERPROFILE\.bun\bin\bun.exe"
$TF = "C:\Users\Minh\AppData\Local\Microsoft\WinGet\Packages\Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe\terraform.exe"

function Exit-OnError {
    param($msg)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] $msg" -ForegroundColor Red
        exit 1
    }
}

# Step 1: Build API
Write-Host "`n==> [1/3] Building API..." -ForegroundColor Cyan
Push-Location $API_DIR
& $BUN run build
Exit-OnError "Build failed"
Pop-Location

# Step 2: Copy dist to terraform
Write-Host "`n==> [2/3] Copying dist..." -ForegroundColor Cyan
$LAMBDA_DIST_DIR = "$LAMBDA_DIR\dist"
if (-not (Test-Path $LAMBDA_DIST_DIR)) {
    New-Item -ItemType Directory -Path $LAMBDA_DIST_DIR -Force | Out-Null
}
Copy-Item -Path "$API_DIR\dist\*" -Destination $LAMBDA_DIST_DIR -Recurse -Force

# Step 3: Terraform init + apply
Write-Host "`n==> [3/3] Terraform deploy..." -ForegroundColor Cyan
Push-Location $TERRAFORM_DIR
& $TF init -upgrade
Exit-OnError "Terraform init failed"
& $TF apply
Exit-OnError "Terraform apply failed"
Pop-Location

Write-Host "`n==> Deploy completed!" -ForegroundColor Green