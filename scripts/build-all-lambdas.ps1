# Build tất cả Lambda Python packages
# Chạy script này trước khi terraform apply để đảm bảo tất cả zip files đã được build

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Building All Lambda Python Packages" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$scripts = @(
    "build-lambda-rag.ps1",
    "build-lambda-review-aggregate.ps1",
    "build-lambda-ocr-menu.ps1",
    "build-lambda-rekognition.ps1",
    "build-lambda-embeddings.ps1"
)

$failed = @()

foreach ($script in $scripts) {
    $scriptPath = Join-Path $PSScriptRoot $script
    if (Test-Path $scriptPath) {
        Write-Host "`n>>> Building $script..." -ForegroundColor Yellow
        try {
            & $scriptPath
            if ($LASTEXITCODE -ne 0) {
                $failed += $script
                Write-Host "`n❌ Failed: $script" -ForegroundColor Red
            } else {
                Write-Host "`n✅ Success: $script" -ForegroundColor Green
            }
        } catch {
            $failed += $script
            Write-Host "`n❌ Error building $script : $_" -ForegroundColor Red
        }
    } else {
        Write-Host "`n⚠️  Script not found: $scriptPath" -ForegroundColor Yellow
        $failed += $script
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
if ($failed.Count -eq 0) {
    Write-Host "  ✅ All Lambda packages built successfully!" -ForegroundColor Green
    Write-Host "  Ready to deploy với Terraform!" -ForegroundColor Green
} else {
    Write-Host "  ❌ Some builds failed:" -ForegroundColor Red
    foreach ($f in $failed) {
        Write-Host "     - $f" -ForegroundColor Red
    }
    exit 1
}
Write-Host "========================================`n" -ForegroundColor Cyan


